"""The free pilot ends after ``PILOT_DAYS`` (90) days.

Pilot start = the day the org got ``plan="pilot"`` (new orgs start on it, so normally the day the
org was created; ``Organization.save`` sets ``pilot_started_on`` / ``pilot_ends_on``). The daily
beat task ``pilot_expiry`` (also run by the serverless cron):

* ``PILOT_REMINDER_DAYS`` (14) days before ``pilot_ends_on``: inbox + SMS to the org's owners and
  admins, inbox to finance ops (and superadmins); once per window (``pilot_reminder_sent_on``);
* on ``pilot_ends_on``: ``end_pilot`` moves the org to ``plan="standard"`` (audited
  ``billing.pilot.end``, actor = system) so new charges are no longer waived; everyone is told.

The billing price list (``Subscription``, default = the phase-1 terms) is left as it is. Ops can push
the end date out with ``extend`` (``POST /ops/billing/subscriptions/{org}/extend-pilot``).
"""

from __future__ import annotations

import datetime as dt
import logging

from django.conf import settings
from django.db import transaction
from django.utils.translation import pgettext_lazy

from apps.audit.services import log
from apps.core.bs import bs_str, format_bs_en, today_ad
from apps.core.exceptions import InvalidState

logger = logging.getLogger("kaamsathi.billing")


def _(text):
    return pgettext_lazy("harden", text)


MESSAGES = {
    "ending_title": _("Your free pilot ends soon"),
    "ending_body": _(
        "{org}: your free KaamSathi pilot ends in {days} days ({date}). After that, the standard "
        "monthly charges apply. See Billing for prices."
    ),
    "ending_ops_title": _("Pilot ending soon"),
    "ending_ops_body": _("{org}: the free pilot ends in {days} days ({date})."),
    "ended_title": _("Your free pilot has ended"),
    "ended_body": _(
        "{org}: your free KaamSathi pilot has ended. The standard monthly charges apply from today. "
        "See Billing for prices."
    ),
    "ended_ops_title": _("Pilot ended"),
    "ended_ops_body": _("{org} moved from the free pilot to the standard plan."),
    "not_on_pilot": _("This organization is not on the free pilot."),
}


def days_left(org, today: dt.date | None = None) -> int | None:
    """Days until the pilot ends (0 = ends today); None when not on the pilot."""
    if getattr(org, "plan", None) != "pilot" or org.pilot_ends_on is None:
        return None
    return max(0, (org.pilot_ends_on - (today or today_ad())).days)


def pilot_dict(org) -> dict | None:
    if getattr(org, "plan", None) != "pilot":
        return None
    return {
        "started_on": org.pilot_started_on.isoformat() if org.pilot_started_on else None,
        "ends_on": org.pilot_ends_on.isoformat() if org.pilot_ends_on else None,
        "ends_on_bs": bs_str(org.pilot_ends_on) if org.pilot_ends_on else None,
        "days_left": days_left(org),
    }


def _admins(org):
    from django.contrib.auth import get_user_model

    return (
        get_user_model()
        .objects.filter(
            memberships__organization=org,
            memberships__is_active=True,
            memberships__role__in=["owner", "admin"],
            is_active=True,
        )
        .distinct()
    )


def _notify(org, key: str, *, days: int | None = None) -> None:
    from apps.support import hooks

    fmt = {"org": org.name}
    if days is not None:
        fmt.update(days=days, date=format_bs_en(org.pilot_ends_on))
    data = {"organization_id": str(org.pk)}
    for user in _admins(org):
        hooks.notify_user(
            user,
            f"pilot_{key}",
            MESSAGES[f"{key}_title"],
            MESSAGES[f"{key}_body"],
            fmt=fmt,
            link="/app/billing",
            data=data,
            sms=True,
        )
    for user in hooks.staff_with_role("finance_ops"):
        hooks.notify_user(
            user,
            f"pilot_{key}_ops",
            MESSAGES[f"{key}_ops_title"],
            MESSAGES[f"{key}_ops_body"],
            fmt=fmt,
            link="/ops/billing",
            data=data,
        )


def end_pilot(org, request=None) -> None:
    """Move the org to the standard plan (charges stop being waived). Audited; idempotent."""
    from apps.orgs.models import Organization

    with transaction.atomic():
        org = Organization.objects.select_for_update().get(pk=org.pk)
        if org.plan != "pilot":
            return
        org.plan = "standard"
        org.save(update_fields=["plan"])
        log(
            request,
            "billing.pilot.end",
            org,
            organization=org,
            changes={
                "plan": {"from": "pilot", "to": "standard"},
                "pilot_started_on": str(org.pilot_started_on),
                "pilot_ends_on": str(org.pilot_ends_on),
            },
        )
    _notify(org, "ended")


def extend(org, days: int, note: str, request) -> None:
    if org.plan != "pilot":
        raise InvalidState(message=str(MESSAGES["not_on_pilot"]))
    before = org.pilot_ends_on
    start = max(org.pilot_ends_on or today_ad(), today_ad())
    org.pilot_ends_on = start + dt.timedelta(days=days)
    org.pilot_reminder_sent_on = None  # remind again before the new end
    org.save(update_fields=["pilot_ends_on", "pilot_reminder_sent_on"])
    log(
        request,
        "billing.pilot.extend",
        org,
        organization=org,
        changes={
            "pilot_ends_on": {"from": str(before), "to": str(org.pilot_ends_on)},
            "days": days,
            "note": note,
        },
    )


def run(today: dt.date | None = None) -> dict:
    from apps.orgs.models import Organization

    today = today or today_ad()
    remind_by = today + dt.timedelta(days=settings.PILOT_REMINDER_DAYS)
    out = {"reminded": 0, "ended": 0}
    pilots = Organization.objects.filter(plan="pilot", is_active=True, pilot_ends_on__isnull=False)
    for org in pilots.filter(pilot_ends_on__lte=today):
        try:
            end_pilot(org)
            out["ended"] += 1
        except Exception:  # noqa: BLE001 - one org must not stop the rest
            logger.exception("Ending the pilot for %s failed", org.pk)
    for org in pilots.filter(
        pilot_ends_on__gt=today, pilot_ends_on__lte=remind_by, pilot_reminder_sent_on__isnull=True
    ):
        org.pilot_reminder_sent_on = today
        org.save(update_fields=["pilot_reminder_sent_on"])
        _notify(org, "ending", days=(org.pilot_ends_on - today).days)
        out["reminded"] += 1
    return out
