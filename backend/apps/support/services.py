"""Support case lifecycle: numbering, SLA, replies, notifications, escalation."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from . import hooks, labels
from .models import CaseMessage, SupportCase, format_number, sla_due


def create_case(
    *,
    requester,
    subject,
    description,
    category="other",
    priority="normal",
    channel="app",
    worker=None,
    organization=None,
    created_at=None,
    safety_kind=None,
    anonymous=False,
    emergency=False,
) -> SupportCase:
    """Create a case with the next ``KS-000123`` number (retries on a concurrent insert).

    Safety incidents (category ``safety``) are always confidential, at least ``high`` priority
    (24 h SLA); ``emergency`` makes them ``urgent`` and alerts every support staff member now.
    """
    created_at = created_at or timezone.now()
    safety = category == "safety"
    if safety:
        priority = "urgent" if emergency else ("urgent" if priority == "urgent" else "high")
    else:
        safety_kind, anonymous, emergency = None, False, False
    for _attempt in range(5):
        seq = (SupportCase.objects.aggregate(m=Max("seq"))["m"] or 0) + 1
        try:
            with transaction.atomic():
                case = SupportCase.objects.create(
                    seq=seq,
                    number=format_number(seq),
                    requester=requester,
                    worker=worker,
                    organization=organization,
                    channel=channel,
                    category=category,
                    subject=subject,
                    description=description,
                    priority=priority,
                    sla_due_at=sla_due(created_at, priority),
                    created_at=created_at,
                    safety_kind=safety_kind,
                    confidential=safety,
                    anonymous=bool(anonymous),
                    emergency=bool(emergency),
                )
            break
        except IntegrityError:
            continue
    else:  # pragma: no cover - five concurrent collisions in a row
        raise IntegrityError("Could not allocate a support case number")
    if case.emergency:
        alert_emergency(case)
    emit_update(case, "created")
    return case


def set_priority(case: SupportCase, priority: str) -> None:
    case.priority = priority
    case.sla_due_at = sla_due(case.created_at, priority)
    if case.sla_due_at > timezone.now():
        case.escalated = False


def set_status(case: SupportCase, status: str) -> None:
    case.status = status
    if status in ("resolved", "closed"):
        case.resolved_at = case.resolved_at or timezone.now()
    else:
        case.resolved_at = None


def add_message(
    case: SupportCase, author, body: str, *, internal: bool = False, staff: bool = False, channel: str = "app"
):
    """Append a message. Staff replies set ``first_response_at`` and notify the requester;
    a requester reply re-opens a case that was waiting on them or resolved."""
    msg = CaseMessage.objects.create(
        case=case, author=author, body=body, internal=internal and staff, from_staff=staff, channel=channel
    )
    fields = ["updated_at"]
    if staff and not msg.internal:
        if case.first_response_at is None:
            case.first_response_at = msg.created_at
            fields.append("first_response_at")
        hooks.notify_user(
            case.requester,
            "support_reply",
            labels.MESSAGES["notify_reply_title"],
            labels.MESSAGES["notify_reply_body"],
            fmt={"number": case.number, "subject": case.subject},
            link=case_link(case),
            data={"case_id": str(case.id), "number": case.number},
            sms=case.worker_id is not None,
        )
    elif not staff and case.status in ("pending_user", "resolved"):
        set_status(case, "open")
        fields += ["status", "resolved_at"]
    case.save(update_fields=fields)
    if not msg.internal:
        emit_update(case, "message")
    return msg


def case_link(case: SupportCase) -> str:
    return f"/app/support/{case.id}" if case.organization_id else f"/support/{case.id}"


def notify_status(case: SupportCase) -> None:
    hooks.notify_user(
        case.requester,
        "support_status",
        labels.MESSAGES["notify_status_title"],
        labels.MESSAGES["notify_status_body"],
        fmt={"number": case.number, "status": labels.STATUS.get(case.status, case.status)},
        link=case_link(case),
        data={"case_id": str(case.id), "number": case.number, "status": case.status},
    )


def alert_emergency(case: SupportCase) -> None:
    """Immediate in-app + SMS alert to every support staff member (no reporter details in SMS)."""
    kind = labels.SAFETY_KIND.get(case.safety_kind or "other", case.safety_kind)
    for user in hooks.staff_with_role("support"):
        hooks.notify_user(
            user,
            "safety_emergency",
            labels.MESSAGES["emergency_title"],
            labels.MESSAGES["emergency_body"],
            fmt={"number": case.number, "kind": kind},
            link=f"/ops/support?case={case.id}",
            data={"case_id": str(case.id), "number": case.number},
            sms=True,
        )
    SupportCase.objects.filter(pk=case.pk).update(escalated=True)
    case.escalated = True


def org_can_see(case: SupportCase) -> bool:
    """Employers never see confidential (safety) cases unless ops shared them."""
    return not case.confidential or case.shared_with_org


def require_identity_check(case: SupportCase) -> None:
    """Account-sensitive changes via support need an identity check in the last 15 minutes."""
    from apps.core.exceptions import APIError

    if not case.identity_verified:
        raise APIError(
            "identity_check_required",
            message=str(labels.MESSAGES["identity_check_required"]),
            status_code=403,
        )


def record_identity_check(case: SupportCase, user, method: str, passed: bool) -> SupportCase:
    """Store the result as an internal note; only a pass opens the 15-minute change window."""
    method_label = labels.IDENTITY_METHOD.get(method, method)
    CaseMessage.objects.create(
        case=case,
        author=user,
        body=f"Identity check ({method_label}): {'passed' if passed else 'FAILED'}",
        internal=True,
        from_staff=True,
        channel="phone",
    )
    if passed:
        case.identity_verified_at = timezone.now()
        case.identity_method = method
        case.identity_checked_by = user
    else:
        case.identity_verified_at = None
    case.save(update_fields=["identity_verified_at", "identity_method", "identity_checked_by", "updated_at"])
    return case


WORKER_SENSITIVE_FIELDS = (
    "phone",
    "payment_method",
    "bank_name",
    "bank_account_no",
    "bank_account_name",
    "wallet_id",
)


def update_worker_sensitive(case: SupportCase, user, changes: dict) -> dict:
    """Change a worker's phone / payment details on the caller's behalf (identity-checked).

    Returns ``{field: {"from": masked, "to": masked}}`` for the audit log (never plaintext).
    """
    from apps.core.crypto import mask
    from apps.core.exceptions import APIError
    from apps.workers.models import Worker

    require_identity_check(case)
    worker = case.worker
    if worker is None:
        raise APIError("invalid_state", message=str(labels.MESSAGES["case_has_no_worker"]))
    changes = {k: v for k, v in changes.items() if k in WORKER_SENSITIVE_FIELDS}
    audit = {}
    with transaction.atomic():
        if "phone" in changes and changes["phone"] != worker.phone:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            new = changes["phone"]
            taken = Worker.objects.filter(phone=new).exclude(pk=worker.pk).exists() or (
                User.objects.filter(phone=new).exclude(pk=worker.user_id).exists()
            )
            if taken:
                raise APIError("duplicate", fields={"phone": [str(labels.MESSAGES["phone_taken"])]})
            if worker.user_id:
                User.objects.filter(pk=worker.user_id).update(phone=new)
        for field, value in changes.items():
            old = getattr(worker, field)
            if old != value:
                audit[field] = {"from": mask(old) if old else None, "to": mask(value) if value else None}
                setattr(worker, field, value)
        if audit:
            worker.save(update_fields=[*audit, "updated_at"])
            CaseMessage.objects.create(
                case=case,
                author=user,
                body="Updated on caller's request: " + ", ".join(sorted(audit)),
                internal=True,
                from_staff=True,
                channel="phone",
            )
    return audit


def emit_update(case: SupportCase, change: str) -> None:
    if case.organization_id is None or not org_can_see(case):
        return
    hooks.emit(
        case.organization,
        "support_case.updated",
        {
            "id": str(case.id),
            "number": case.number,
            "status": case.status,
            "priority": case.priority,
            "category": case.category,
            "change": change,
            "updated_at": timezone.localtime(case.updated_at or timezone.now()).isoformat(),
        },
    )


def escalate_overdue(now=None) -> dict:
    """Mark open cases / disputes past their SLA as escalated (once) and notify support staff."""
    from apps.trust.models import Dispute

    now = now or timezone.now()
    staff = hooks.staff_with_role("support")
    cases = list(
        SupportCase.objects.filter(status="open", escalated=False, sla_due_at__lt=now).order_by("sla_due_at")
    )
    for case in cases:
        SupportCase.objects.filter(pk=case.pk).update(escalated=True)
        for user in staff:
            hooks.notify_user(
                user,
                "support_escalated",
                labels.MESSAGES["escalated_case_title"],
                labels.MESSAGES["escalated_case_body"],
                fmt={
                    "number": case.number,
                    "priority": labels.PRIORITY.get(case.priority, case.priority),
                    "subject": case.subject,
                },
                link=f"/ops/support?case={case.id}",
                data={"case_id": str(case.id)},
            )
    disputes = list(
        Dispute.objects.filter(
            status__in=["open", "employer_responded", "appealed"], escalated=False, sla_due_at__lt=now
        )
    )
    from apps.trust import labels as trust_labels

    for dispute in disputes:
        Dispute.objects.filter(pk=dispute.pk).update(escalated=True)
        for user in staff:
            hooks.notify_user(
                user,
                "dispute_escalated",
                labels.MESSAGES["escalated_dispute_title"],
                labels.MESSAGES["escalated_dispute_body"],
                fmt={
                    "kind": trust_labels.DISPUTE_KIND.get(dispute.kind, dispute.kind),
                    "status": trust_labels.DISPUTE_STATUS.get(dispute.status, dispute.status),
                },
                link="/ops/disputes",
                data={"dispute_id": str(dispute.id)},
            )
    return {"cases": len(cases), "disputes": len(disputes)}
