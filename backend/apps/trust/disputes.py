"""Dispute evidence (N006) and appeals (N008).

Evidence: a photo or PDF (``validate_upload``) in private storage, served by signed URL. The worker,
the employer (any manager of the dispute's organization) and ops can add and see evidence while the
dispute is open, employer_responded or appealed.

Appeal: after a first decision (``resolved`` / ``rejected``) either party may appeal **once** within
14 days → ``appealed``; ops then decides (``upheld`` | ``overturned``) → ``appeal_resolved``. The
second decision must come from a different staff member than the first (enforced).
"""

from __future__ import annotations

import os

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import APIError, InvalidState

from . import labels
from .models import Dispute, DisputeEvidence

EVIDENCE_OPEN = {"open", "employer_responded", "appealed"}


def _file_type(name: str) -> str:
    return "pdf" if os.path.splitext(name or "")[1].lower() == ".pdf" else "image"


@transaction.atomic
def add_evidence(dispute: Dispute, file, *, user, party: str, note: str | None = None) -> DisputeEvidence:
    dispute = Dispute.objects.select_for_update().get(pk=dispute.pk)
    if dispute.status not in EVIDENCE_OPEN:
        raise InvalidState(message=str(labels.MESSAGES["evidence_closed"]))
    if dispute.evidence.count() >= DisputeEvidence.MAX_PER_DISPUTE:
        raise InvalidState(message=str(labels.MESSAGES["evidence_limit"]))
    return DisputeEvidence.objects.create(
        dispute=dispute,
        file=file,
        file_type=_file_type(getattr(file, "name", "")),
        uploaded_by=user,
        party=party,
        note=note or None,
    )


@transaction.atomic
def appeal(dispute: Dispute, *, user, party: str, reason: str) -> Dispute:
    dispute = Dispute.objects.select_for_update().get(pk=dispute.pk)
    if not dispute.can_appeal():
        raise InvalidState(message=str(labels.MESSAGES["appeal_not_allowed"]))
    dispute.appeal_reason = reason
    dispute.appealed_by = user
    dispute.appealed_by_party = party
    dispute.appealed_at = timezone.now()
    dispute.status = "appealed"
    dispute.save()
    return dispute


@transaction.atomic
def decide_appeal(dispute: Dispute, *, user, outcome: str, note: str) -> Dispute:
    dispute = Dispute.objects.select_for_update().get(pk=dispute.pk)
    if dispute.status != "appealed":
        raise InvalidState(message=str(labels.MESSAGES["not_appealed"]))
    if dispute.resolved_by_id and dispute.resolved_by_id == user.pk:
        raise APIError(
            "permission_denied", message=str(labels.MESSAGES["appeal_same_staff"]), status_code=403
        )
    dispute.appeal_outcome = outcome
    dispute.appeal_resolution_note = note
    dispute.appeal_resolved_by = user
    dispute.appeal_resolved_at = timezone.now()
    dispute.status = "appeal_resolved"
    dispute.save()
    return dispute


def can_view_dispute(user, dispute: Dispute) -> bool:
    """Ops, the disputing worker, or a manager of the dispute's organization."""
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_staff:
        return True
    if dispute.worker.user_id and dispute.worker.user_id == user.pk:
        return True
    if dispute.organization_id:
        from apps.core.permissions import MANAGERS
        from apps.orgs.models import Membership

        return Membership.objects.filter(
            user=user, organization_id=dispute.organization_id, is_active=True, role__in=MANAGERS
        ).exists()
    return False


def can_download_evidence(rest: str, user, name: str) -> bool:
    ev = DisputeEvidence.objects.select_related("dispute__worker").filter(pk=rest).first()
    if ev is None or not ev.file or ev.file.name != name:
        return False
    return can_view_dispute(user, ev.dispute)


def notify_parties(dispute: Dispute, title: str, body: str, *, title_ne=None, body_ne=None) -> None:
    """Inbox (+SMS to the worker) for appeal events; never includes personal details."""
    try:
        from apps.notifications.services import notify
    except ImportError:  # pragma: no cover
        return
    if dispute.worker.user_id:
        notify(
            dispute.worker.user,
            "dispute_appeal",
            title,
            body,
            title_ne=title_ne,
            body_ne=body_ne,
            data={"dispute_id": str(dispute.id)},
            link="/me/disputes",
            sms=True,
        )
    if dispute.organization_id:
        from apps.orgs.models import Membership

        for m in Membership.objects.filter(
            organization_id=dispute.organization_id, is_active=True, role__in=["owner", "hr"]
        ).select_related("user"):
            notify(
                m.user,
                "dispute_appeal",
                title,
                body,
                title_ne=title_ne,
                body_ne=body_ne,
                data={"dispute_id": str(dispute.id)},
                link="/app/disputes",
            )
