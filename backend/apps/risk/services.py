"""Risk service API (other apps call ``flag`` through a lazy import — keep the signature exact).

    apps.risk.services.flag(subject, kind, severity, details=None) -> None

``subject`` is a model instance (Worker, Organization, Employment, Attendance, Credential,
WorkHistoryEntry, TravelDocument) or a ``(subject_type, subject_id)`` tuple. Idempotent per open
``(subject, kind)``: a second call merges ``details`` into the open flag and only ever raises the
severity, it never creates a duplicate or reopens a dismissed flag's decision.
"""

from __future__ import annotations

import logging

from django.db import IntegrityError, transaction

from .models import FraudFlag

logger = logging.getLogger("kaamsathi.risk")

# model label (app_label.ModelName, lower-case) → FraudFlag.subject_type
MODEL_SUBJECT_TYPES = {
    "workers.worker": "worker",
    "orgs.organization": "organization",
    "workforce.employment": "employment",
    "workforce.attendance": "attendance",
    "credentials.credential": "credential",
    "experience.workhistoryentry": "work_history",
    "mobility.traveldocument": "travel_document",
}
SUBJECT_MODELS = {v: k for k, v in MODEL_SUBJECT_TYPES.items()}


def subject_ref(subject) -> tuple[str, str]:
    if isinstance(subject, (tuple, list)):
        subject_type, subject_id = subject
        if subject_type not in SUBJECT_MODELS:
            raise ValueError(f"Unknown risk subject type: {subject_type}")
        return subject_type, str(subject_id)
    key = subject._meta.label_lower
    if key not in MODEL_SUBJECT_TYPES:
        raise ValueError(f"Model {key} cannot be a risk subject")
    return MODEL_SUBJECT_TYPES[key], str(subject.pk)


def _merge(old: dict, new: dict) -> dict:
    out = dict(old or {})
    for key, value in (new or {}).items():
        if isinstance(value, list) and isinstance(out.get(key), list):
            merged = list(out[key])
            for item in value:
                if item not in merged:
                    merged.append(item)
            out[key] = merged
        else:
            out[key] = value
    return out


def flag(subject, kind: str, severity: str, details: dict | None = None) -> None:
    """Raise (or refresh) an open flag on ``subject``; ValueError on an unknown kind or severity."""
    subject_type, subject_id = subject_ref(subject)
    if kind not in dict(FraudFlag.KINDS):
        raise ValueError(f"Unknown risk flag kind: {kind}")
    if severity not in FraudFlag.SEVERITY_RANK:
        raise ValueError(f"Unknown severity: {severity}")
    details = details or {}
    for _attempt in range(2):
        existing = (
            FraudFlag.objects.filter(
                subject_type=subject_type, subject_id=subject_id, kind=kind, status="open"
            )
            .order_by("created_at")
            .first()
        )
        if existing is not None:
            changed = []
            merged = _merge(existing.details, details)
            if merged != existing.details:
                existing.details = merged
                changed.append("details")
            if FraudFlag.SEVERITY_RANK[severity] > FraudFlag.SEVERITY_RANK[existing.severity]:
                existing.severity = severity
                changed.append("severity")
            if changed:
                existing.save(update_fields=[*changed, "updated_at"])
            return None
        try:
            with transaction.atomic():
                FraudFlag.objects.create(
                    subject_type=subject_type,
                    subject_id=subject_id,
                    kind=kind,
                    severity=severity,
                    details=details,
                )
            return None
        except IntegrityError:  # raced with another detector run → merge into that one
            continue
    return None


def open_flag_count(subject) -> int:
    subject_type, subject_id = subject_ref(subject)
    return FraudFlag.objects.filter(subject_type=subject_type, subject_id=subject_id, status="open").count()


def get_subject(subject_type: str, subject_id: str):
    """The flagged object, or None when it no longer exists / its app is not installed."""
    from django.apps import apps

    label = SUBJECT_MODELS.get(subject_type)
    if label is None:
        return None
    try:
        model = apps.get_model(label)
    except (LookupError, ValueError):
        return None
    try:
        return model.objects.filter(pk=subject_id).first()
    except (ValueError, Exception):  # noqa: BLE001 - malformed id for the pk type
        return None


def describe_subject(subject_type: str, subject_id: str, cache: dict | None = None) -> dict:
    """``{label, worker_id?, organization_id?, link}`` for the ops UI (no sensitive identifiers)."""
    key = (subject_type, subject_id)
    if cache is not None and key in cache:
        return cache[key]
    obj = get_subject(subject_type, subject_id)
    out: dict = {"label": None, "worker_id": None, "organization_id": None, "link": None}
    if obj is not None:
        worker = None
        org = None
        if subject_type == "worker":
            worker = obj
        elif subject_type == "organization":
            org = obj
            out["label"] = obj.name
            out["link"] = f"/ops/organizations/{obj.pk}"
        elif subject_type == "employment":
            worker, org = obj.worker, obj.organization
            out["label"] = f"{obj.worker.full_name} · {obj.organization.name}"
        elif subject_type == "attendance":
            emp = obj.employment
            worker, org = emp.worker, emp.organization
            out["label"] = f"{worker.full_name} · {obj.date.isoformat()}"
        else:
            worker = getattr(obj, "worker", None)
            title = getattr(obj, "title", None) or getattr(obj, "role_title", None) or obj.__class__.__name__
            out["label"] = f"{worker.full_name} · {title}" if worker else str(title)
        if worker is not None:
            out["worker_id"] = str(worker.pk)
            out["label"] = out["label"] or worker.full_name
            out["link"] = f"/ops/workers/{worker.pk}"
        if org is not None:
            out["organization_id"] = str(org.pk)
    if cache is not None:
        cache[key] = out
    return out


# --------------------------------------------------------------------------- KYC four-eyes
def kyc_four_eyes_enabled() -> bool:
    from apps.core.flags import is_enabled

    return is_enabled("kyc_four_eyes")


def pending_first_review(worker):
    """The open first "verified" review awaiting a second verifier, or None."""
    from .models import VerificationReview

    if worker.verification_status != "pending":
        return None
    latest = VerificationReview.objects.filter(worker=worker).select_related("reviewer").first()
    if latest and latest.stage == "first" and latest.decision == "verified":
        return latest
    return None


def record_kyc_decision(worker, user, decision: str, note=None) -> str:
    """Record an ops KYC decision; return the status the worker should now have.

    Four-eyes off → the decision is final. On → a first "verified" leaves the worker ``pending``
    until a *different* verifier confirms; the same verifier confirming again → 400 invalid_state.
    A rejection is always final (it ends any open first review).
    """
    from django.utils.translation import pgettext

    from apps.core.exceptions import InvalidState

    from .models import VerificationReview

    stage = "final"
    status = decision
    if decision == "verified" and kyc_four_eyes_enabled():
        first = pending_first_review(worker)
        if first is None:
            stage, status = "first", "pending"
        elif first.reviewer_id == getattr(user, "pk", None):
            raise InvalidState(
                message=pgettext(
                    "complete2", "A different verifier must confirm this worker (four-eyes check)."
                )
            )
    VerificationReview.objects.create(worker=worker, reviewer=user, decision=decision, stage=stage, note=note)
    return status


def kyc_review_state(worker) -> dict | None:
    """``{required, first_review_by: {id, full_name}, first_review_at}`` while awaiting a 2nd verifier."""
    first = pending_first_review(worker)
    if first is None:
        return None
    return {
        "required": True,
        "first_review_by": (
            {"id": str(first.reviewer_id), "full_name": first.reviewer.full_name} if first.reviewer_id else None
        ),
        "first_review_at": first.created_at.isoformat(),
    }
