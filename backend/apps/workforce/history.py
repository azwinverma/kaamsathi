"""Employment history: one newest-first event list for ``GET /org/employments/{id}/history``.

Sources: the audit log (``employment.create|update|end``, ``advance.create``) for who changed what
and the before → after values, plus the domain tables (employer ratings, appointment-letter
versions, disputes, advances). Only the employer's own rating of this employment is included —
never the worker's rating of the employer.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.translation import pgettext_lazy

from apps.audit.models import AuditLog
from apps.core import labels
from apps.core.bs import bs_str

from .models import Employment

CTX = "history1"

WAGE_FIELDS = (
    "wage_type",
    "basic_salary",
    "dearness_allowance",
    "other_allowance",
    "daily_wage",
    "hourly_wage",
    "part_time",
    "ssf_enrolled",
)
MONEY_FIELDS = {"basic_salary", "dearness_allowance", "other_allowance", "daily_wage", "hourly_wage"}

TITLES = {
    "employment_started": pgettext_lazy(CTX, "Started work"),
    "employment_ended": pgettext_lazy(CTX, "Employment ended"),
    "wage_changed": pgettext_lazy(CTX, "Wage or terms changed"),
    "site_changed": pgettext_lazy(CTX, "Moved to another site"),
    "designation_changed": pgettext_lazy(CTX, "Designation changed"),
    "rating_given": pgettext_lazy(CTX, "Rated by the employer"),
    "contract_issued": pgettext_lazy(CTX, "Appointment letter issued"),
    "contract_accepted": pgettext_lazy(CTX, "Appointment letter accepted"),
    "dispute_opened": pgettext_lazy(CTX, "Dispute raised"),
    "dispute_resolved": pgettext_lazy(CTX, "Dispute decided"),
    "advance_given": pgettext_lazy(CTX, "Advance given"),
}


def _money(value) -> str | None:
    if value in (None, ""):
        return None
    try:
        return f"{Decimal(str(value)):.2f}"
    except (InvalidOperation, ValueError):
        return None


def _dec(value) -> Decimal | None:
    m = _money(value)
    return Decimal(m) if m is not None else None


def _gross(state: dict) -> str:
    emp = Employment(
        wage_type=state.get("wage_type") or "monthly",
        basic_salary=_dec(state.get("basic_salary")),
        dearness_allowance=_dec(state.get("dearness_allowance")),
        other_allowance=_dec(state.get("other_allowance")) or Decimal("0"),
        daily_wage=_dec(state.get("daily_wage")),
        hourly_wage=_dec(state.get("hourly_wage")),
    )
    return f"{Decimal(str(emp.monthly_gross)):.2f}"


def _norm(field, value):
    return _money(value) if field in MONEY_FIELDS else value


def _local_date(value: dt.datetime) -> dt.date:
    return timezone.localtime(value).date() if timezone.is_aware(value) else value.date()


def _day_start(day: dt.date, end_of_day=False) -> dt.datetime:
    t = dt.time.max if end_of_day else dt.time.min
    return timezone.make_aware(dt.datetime.combine(day, t))


class _Builder:
    def __init__(self):
        self.events: list[tuple[dt.datetime, int, dict]] = []
        self._n = 0
        self._actor_ids: set = set()

    def add(self, type_, at, detail, actor_id=None, *, sort=None):
        """``at`` is a date (dated facts) or an aware datetime."""
        if isinstance(at, dt.datetime):
            at_str = timezone.localtime(at).isoformat()
            at_bs = bs_str(_local_date(at))
            key = at
        else:
            at_str = at.isoformat()
            at_bs = bs_str(at)
            key = sort or _day_start(at)
        if actor_id:
            self._actor_ids.add(actor_id)
        self._n += 1
        self.events.append(
            (
                key,
                self._n,
                {
                    "type": type_,
                    "at": at_str,
                    "at_bs": at_bs,
                    "title": str(TITLES[type_]),
                    "detail": detail,
                    "actor": actor_id,
                },
            )
        )

    def result(self) -> list[dict]:
        User = get_user_model()
        names = dict(User.objects.filter(id__in=self._actor_ids).values_list("id", "full_name"))
        out = []
        for _, _, ev in sorted(self.events, key=lambda e: (e[0], e[1]), reverse=True):
            aid = ev["actor"]
            ev["actor"] = {"id": str(aid), "full_name": names.get(aid, "")} if aid and aid in names else None
            out.append(ev)
        return out


def employment_history(emp: Employment) -> list[dict]:
    from apps.compliance.models import EmploymentContract
    from apps.orgs.models import Site
    from apps.trust.labels import DISPUTE_KIND, DISPUTE_STATUS
    from apps.trust.models import Dispute
    from apps.workers import labels as worker_labels
    from apps.workers.models import Rating

    b = _Builder()
    logs = list(
        AuditLog.objects.filter(
            organization_id=emp.organization_id,
            object_type="employment",
            object_id=str(emp.id),
            action__in=["employment.create", "employment.update", "employment.end", "employment.rate"],
        ).order_by("seq")
    )
    first = {}
    for row in logs:
        first.setdefault(row.action, row)

    # Started / ended -------------------------------------------------------------------------
    if emp.end_date and emp.status != "active":
        ended = first.get("employment.end")
        b.add(
            "employment_ended",
            emp.end_date,
            {
                "end_reason": emp.end_reason,
                "end_reason_label": labels.label(labels.END_REASON, emp.end_reason),
            },
            ended.actor_id if ended else None,
            sort=_day_start(emp.end_date, end_of_day=True),
        )

    # Updates: reconstruct the full state after each update by walking back from today ----------
    updates = [r for r in logs if r.action == "employment.update" and isinstance(r.changes, dict)]
    state = {f: _norm(f, getattr(emp, f)) for f in WAGE_FIELDS}
    states_after = []
    for row in reversed(updates):
        after = dict(state)
        for field, change in row.changes.items():
            if field in WAGE_FIELDS and isinstance(change, dict):
                after[field] = _norm(field, change.get("to"))
        before = dict(after)
        for field, change in row.changes.items():
            if field in WAGE_FIELDS and isinstance(change, dict):
                before[field] = _norm(field, change.get("from"))
        states_after.append((row, before, after))
        state = before
    site_ids = set()
    for row in updates:
        ch = row.changes.get("site_id")
        if isinstance(ch, dict):
            site_ids.update(v for v in (ch.get("from"), ch.get("to")) if v)
    site_names = {
        str(k): v
        for k, v in Site.objects.filter(organization_id=emp.organization_id, id__in=site_ids).values_list(
            "id", "name"
        )
    }

    def site_ref(sid):
        return {"id": str(sid), "name": site_names.get(str(sid), "")} if sid else None

    for row, before, after in states_after:
        wage_changes = {
            f: {"from": before[f], "to": after[f]}
            for f in WAGE_FIELDS
            if f in row.changes and before[f] != after[f]
        }
        if wage_changes:
            b.add(
                "wage_changed",
                row.created_at,
                {
                    "changes": wage_changes,
                    "monthly_gross": {"from": _gross(before), "to": _gross(after)},
                    "wage_type": {
                        "from": before["wage_type"],
                        "to": after["wage_type"],
                        "from_label": labels.label(labels.WAGE_TYPE, before["wage_type"]),
                        "to_label": labels.label(labels.WAGE_TYPE, after["wage_type"]),
                    },
                },
                row.actor_id,
            )
        site = row.changes.get("site_id")
        if isinstance(site, dict) and site.get("from") != site.get("to"):
            b.add(
                "site_changed",
                row.created_at,
                {"from": site_ref(site.get("from")), "to": site_ref(site.get("to"))},
                row.actor_id,
            )
        des = row.changes.get("designation")
        if isinstance(des, dict) and des.get("from") != des.get("to"):
            b.add(
                "designation_changed",
                row.created_at,
                {"from": des.get("from") or None, "to": des.get("to") or None},
                row.actor_id,
            )

    # Started: site and designation as they were on day one (before any logged change).
    start_site, start_designation = emp.site_id, emp.designation
    for row in reversed(updates):
        for field in ("site_id", "designation"):
            ch = row.changes.get(field)
            if isinstance(ch, dict):
                if field == "site_id":
                    start_site = ch.get("from")
                else:
                    start_designation = ch.get("from")
    if start_site and str(start_site) not in site_names:
        site_names.update(
            {
                str(k): v
                for k, v in Site.objects.filter(
                    id=start_site, organization_id=emp.organization_id
                ).values_list("id", "name")
            }
        )
    created = first.get("employment.create")
    b.add(
        "employment_started",
        emp.start_date,
        {"site": site_ref(start_site), "designation": start_designation or None},
        created.actor_id if created else None,
    )

    # The employer's own rating of this employment ------------------------------------------
    rated = first.get("employment.rate")
    for r in Rating.objects.filter(employment=emp, rater="employer"):
        b.add(
            "rating_given",
            r.created_at,
            {
                "id": str(r.id),
                "score_a": r.score_a,
                "score_b": r.score_b,
                "comment": r.comment or None,
                "comment_status": r.comment_status,
                "comment_status_label": labels.label(worker_labels.COMMENT_STATUS, r.comment_status),
                "voided": r.voided,
            },
            rated.actor_id if rated else None,
        )

    # Appointment letters ---------------------------------------------------------------------
    for c in EmploymentContract.objects.filter(employment=emp).order_by("version"):
        gross = c.terms.get("monthly_gross") if isinstance(c.terms, dict) else None
        b.add(
            "contract_issued",
            c.generated_at,
            {"id": str(c.id), "version": c.version, "monthly_gross": _money(gross)},
            c.generated_by_id,
        )
        if c.accepted_at:
            b.add(
                "contract_accepted",
                c.accepted_at,
                {"id": str(c.id), "version": c.version, "channel": c.accepted_channel},
            )

    # Disputes about this job (raised by the worker; decided by KaamSathi) ---------------------
    for d in Dispute.objects.filter(employment=emp, organization_id=emp.organization_id):
        base = {
            "id": str(d.id),
            "kind": d.kind,
            "kind_label": labels.label(DISPUTE_KIND, d.kind),
            "status": d.status,
            "status_label": labels.label(DISPUTE_STATUS, d.status),
        }
        b.add("dispute_opened", d.raised_at, {**base, "description": d.description})
        if d.resolved_at:
            b.add("dispute_resolved", d.resolved_at, {**base, "appeal": False, "note": d.resolution_note})
        if d.appeal_resolved_at:
            b.add(
                "dispute_resolved",
                d.appeal_resolved_at,
                {**base, "appeal": True, "outcome": d.appeal_outcome, "note": d.appeal_resolution_note},
            )

    # Advances ---------------------------------------------------------------------------------
    advances = list(emp.advances.all())
    adv_actor = dict(
        AuditLog.objects.filter(
            organization_id=emp.organization_id,
            action="advance.create",
            object_id__in=[str(a.id) for a in advances],
        ).values_list("object_id", "actor_id")
    )
    for a in advances:
        b.add(
            "advance_given",
            a.given_on,
            {
                "id": str(a.id),
                "amount": _money(a.amount),
                "recover_per_month": _money(a.recover_per_month),
                "recovered_amount": _money(a.recovered_amount),
                "note": a.note or None,
            },
            adv_actor.get(str(a.id)),
            sort=timezone.localtime(a.created_at)
            if a.created_at and _local_date(a.created_at) == a.given_on
            else _day_start(a.given_on),
        )

    return b.result()
