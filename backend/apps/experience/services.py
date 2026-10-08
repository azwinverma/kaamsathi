"""External work history: submission, reference checks, employer confirmation, passport/trust facts."""

from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone
from django.utils.translation import pgettext

from apps.core.exceptions import InvalidState

from . import labels
from .models import WorkHistoryEntry

logger = logging.getLogger("kaamsathi.experience")

DECISIONS = ("verified", "unverifiable", "rejected")


# --------------------------------------------------------------------------- lazy cross-app calls
def validate_document(file):
    """``apps.core.uploads.validate_upload`` when available (security agent); else pass through."""
    if file is None:
        return None
    try:
        from apps.core.uploads import validate_upload  # noqa: PLC0415
    except ImportError:
        return file
    return validate_upload(file, kinds={"image", "pdf"}, max_mb=8)


def _notify(user, kind, title, body, *, title_ne=None, body_ne=None, link=None, data=None, sms=False):
    if user is None:
        return
    try:
        from apps.notifications.services import notify  # noqa: PLC0415
    except ImportError:
        return
    try:
        notify(user, kind, title, body, title_ne=title_ne, body_ne=body_ne, data=data, link=link, sms=sms)
    except Exception:  # noqa: BLE001 - a notification must never break the decision
        logger.exception("notify(%s) failed", kind)


def _recompute_trust(worker) -> None:
    try:
        from apps.trust.services import schedule_recompute  # noqa: PLC0415
    except ImportError:
        return
    schedule_recompute(worker.pk)


def _flag_mismatch(entry: WorkHistoryEntry, note: str) -> None:
    try:
        from apps.risk.services import flag  # noqa: PLC0415
    except ImportError:
        return
    try:
        flag(entry, "reference_mismatch", "medium", {"employer_name": entry.employer_name, "note": note})
    except Exception:  # noqa: BLE001
        logger.exception("risk flag for work history %s failed", entry.pk)


# --------------------------------------------------------------------------- worker submissions
def initial_status(*, reference_phone, employer_org) -> str:
    """With a reference phone or an on-platform employer there is something to check."""
    return "reference_pending" if (reference_phone or employer_org) else "self_reported"


def ensure_editable(entry: WorkHistoryEntry) -> None:
    if entry.status == "verified":
        raise InvalidState(
            message=pgettext("growth", "Verified work history cannot be changed. Contact support.")
        )


# --------------------------------------------------------------------------- decisions
def _decide(entry: WorkHistoryEntry, *, status: str, method: str | None, note: str, user) -> WorkHistoryEntry:
    entry.status = status
    entry.verification_method = method if status == "verified" else (method or None)
    entry.note = note or None
    entry.verified_by = user
    entry.verified_at = timezone.now()
    entry.save(
        update_fields=["status", "verification_method", "note", "verified_by", "verified_at", "updated_at"]
    )
    _recompute_trust(entry.worker)
    worker_user = entry.worker.user
    if status == "verified":
        _notify(
            worker_user,
            "work_history_verified",
            f"Work history verified: {entry.role_title} at {entry.employer_name}",
            "It now shows on your Skill Passport.",
            title_ne=f"कामको अनुभव प्रमाणित भयो: {entry.employer_name}",
            body_ne="यो अब तपाईंको सीप पासपोर्टमा देखिन्छ।",
            link="/me/work-history",
            data={"work_history_id": str(entry.pk)},
        )
    else:
        _notify(
            worker_user,
            "work_history_not_verified",
            f"Could not verify: {entry.role_title} at {entry.employer_name}",
            note or "Please check the reference details and try again.",
            title_ne=f"प्रमाणित गर्न सकिएन: {entry.employer_name}",
            body_ne=note or "सन्दर्भ व्यक्तिको विवरण जाँचेर फेरि पठाउनुहोस्।",
            link="/me/work-history",
            data={"work_history_id": str(entry.pk)},
        )
    if status == "rejected":
        _flag_mismatch(entry, note)
    return entry


@transaction.atomic
def ops_verify(entry: WorkHistoryEntry, *, status: str, method: str | None, note: str, user):
    if status not in DECISIONS:
        raise InvalidState()
    return _decide(entry, status=status, method=method, note=note, user=user)


@transaction.atomic
def employer_decide(entry: WorkHistoryEntry, *, confirm: bool, note: str, user):
    if entry.status not in WorkHistoryEntry.OPEN:
        raise InvalidState(message=pgettext("growth", "This work history has already been reviewed."))
    return _decide(
        entry,
        status="verified" if confirm else "rejected",
        method="employer_confirmed" if confirm else None,
        note=note,
        user=user,
    )


# --------------------------------------------------------------------------- facts for other apps
def verified_entries(worker):
    return WorkHistoryEntry.objects.filter(worker=worker, status="verified")


def passport_entries(worker) -> list[dict]:
    """``work.external`` of the Skill Passport — verified entries only."""
    from apps.core.bs import bs_str

    rows = []
    for e in verified_entries(worker).order_by("-start_date"):
        rows.append(
            {
                "employer_name": e.employer_name,
                "role_title": e.role_title,
                "from": e.start_date.isoformat(),
                "from_bs": bs_str(e.start_date),
                "to": e.end_date.isoformat() if e.end_date else None,
                "to_bs": bs_str(e.end_date),
                "months": e.months,
                "verified_by": labels.PASSPORT_SOURCE.get(e.verification_method or "", "reference"),
            }
        )
    return rows


def can_download_document(rest: str, user, name: str) -> bool:
    """Signed-URL re-check: only the worker themself and ops staff see reference documents."""
    entry = WorkHistoryEntry.objects.select_related("worker").filter(pk=rest).first()
    if entry is None or not entry.document or entry.document.name != name:
        return False
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    return bool(user.is_staff or (entry.worker.user_id and entry.worker.user_id == user.pk))
