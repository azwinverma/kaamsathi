"""Mobility services: document payloads, verification, agency eligibility, shares, partner summary.

docs/CONTRACT-EXTENSIONS.md §5. Never recruit or match for jobs abroad — we only hold documents and
share their verification status with a licensed agency the worker chooses.
"""

from __future__ import annotations

import logging
import os

from django.db.models import Q
from django.utils import timezone
from django.utils.translation import pgettext

from apps.core import labels as core_labels
from apps.core.bs import bs_str, today_ad
from apps.core.crypto import mask
from apps.core.exceptions import APIError, InvalidState
from apps.core.files import request_user, signed_url

from . import labels
from .models import ClearanceDocument, TravelDocument

logger = logging.getLogger("kaamsathi.mobility")

GROUPS = {"travel": TravelDocument, "clearance": ClearanceDocument}
SHARE_MAX_DAYS = 90
SHARE_SCOPES = ["mobility.read", "passport.read"]
ALLOWED_DOC_EXT = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_MB = 8


# --------------------------------------------------------------------------- lookups
def get_document(pk, *, worker=None):
    """Find a document of either group by id (optionally owned by ``worker``)."""
    for model in GROUPS.values():
        qs = model.objects.select_related("worker", "verified_by")
        if worker is not None:
            qs = qs.filter(worker=worker)
        doc = qs.filter(pk=pk).first()
        if doc is not None:
            return doc
    return None


def worker_documents(worker) -> list:
    docs = [*TravelDocument.objects.filter(worker=worker), *ClearanceDocument.objects.filter(worker=worker)]
    docs.sort(key=lambda d: d.created_at, reverse=True)
    return docs


# --------------------------------------------------------------------------- uploads
def validate_document_upload(file):
    """Shared upload validator when available (apps.core.uploads), else a conservative fallback."""
    if file is None:
        return None
    try:
        from apps.core.uploads import validate_upload
    except ImportError:
        validate_upload = None
    if validate_upload is not None:
        return validate_upload(file, kinds={"image", "pdf"}, max_mb=MAX_UPLOAD_MB)
    ext = os.path.splitext(getattr(file, "name", "") or "")[1].lower()
    if ext not in ALLOWED_DOC_EXT:
        raise APIError(
            "upload_rejected",
            message=pgettext("mobility", "Upload a PDF or a photo (JPG, PNG)."),
            fields={"document": [pgettext("mobility", "Upload a PDF or a photo (JPG, PNG).")]},
        )
    if getattr(file, "size", 0) and file.size > MAX_UPLOAD_MB * 1024 * 1024:
        raise APIError(
            "upload_rejected",
            message=pgettext("mobility", "File is too large (maximum %(mb)s MB).") % {"mb": MAX_UPLOAD_MB},
            fields={
                "document": [
                    pgettext("mobility", "File is too large (maximum %(mb)s MB).") % {"mb": MAX_UPLOAD_MB}
                ]
            },
        )
    return file


# --------------------------------------------------------------------------- payloads
def _date(d):
    return d.isoformat() if d else None


def _bs(d):
    try:
        return bs_str(d) if d else None
    except Exception:  # noqa: BLE001 - outside the BS table
        return None


def number_of(doc) -> str | None:
    return doc.number if isinstance(doc, TravelDocument) else doc.reference_no


def document_type(doc) -> str | None:
    if not doc.document:
        return None
    return "pdf" if os.path.splitext(doc.document.name)[1].lower() == ".pdf" else "image"


def days_to_expiry(doc, today=None) -> int | None:
    if not doc.expires_on:
        return None
    return (doc.expires_on - (today or today_ad())).days


def is_valid(doc, today=None) -> bool:
    """Verified and not past its expiry date."""
    today = today or today_ad()
    return doc.status == "verified" and (doc.expires_on is None or doc.expires_on >= today)


def document_dict(doc, request=None, *, for_ops: bool = False) -> dict:
    """Worker/ops representation. Full numbers only for ops; the file URL is signed for the caller,
    who must be the owner or staff (enforced again at download time by ``can_download``)."""
    group = doc.KIND_GROUP
    number = number_of(doc)
    data = {
        "id": str(doc.id),
        "kind_group": group,
        "kind_group_label": core_labels.label(labels.KIND_GROUP, group),
        "kind": doc.kind,
        "kind_label": core_labels.label(labels.KIND, doc.kind),
        "title": doc.title,
        "issuer": getattr(doc, "issuer", None),
        "issuing_country": getattr(doc, "issuing_country", None),
        "number_masked": mask(number) or None,
        "score_or_level": getattr(doc, "score_or_level", None),
        "issued_on": _date(doc.issued_on),
        "issued_on_bs": _bs(doc.issued_on),
        "expires_on": _date(doc.expires_on),
        "expires_on_bs": _bs(doc.expires_on),
        "days_to_expiry": days_to_expiry(doc),
        "status": doc.status,
        "status_label": core_labels.label(labels.STATUS, doc.status),
        "note": doc.note,
        "verified_at": doc.verified_at.isoformat() if doc.verified_at else None,
        "document_url": signed_url(
            doc.document, request_user(request), request, check=f"mobility:{group}:{doc.pk}"
        ),
        "document_type": document_type(doc),
        "created_at": doc.created_at.isoformat(),
    }
    if for_ops:
        w = doc.worker
        data["number"] = number
        data["worker"] = {
            "id": str(w.id),
            "full_name": w.full_name,
            "phone": w.phone,
            "verification_status": w.verification_status,
        }
        data["verified_by"] = (
            {"id": str(doc.verified_by.id), "full_name": doc.verified_by.full_name}
            if doc.verified_by_id
            else None
        )
        data["duplicate_number"] = has_duplicate_number(doc)
    return data


def has_duplicate_number(doc) -> bool:
    model = type(doc)
    field = "number_hash" if model is TravelDocument else "reference_no_hash"
    value = getattr(doc, field)
    if not value:
        return False
    return model.objects.filter(**{field: value}).exclude(worker_id=doc.worker_id).exists()


def can_download(rest: str, user, name: str) -> bool:
    """Download-time re-check for ``check="mobility:<group>:<id>"``: owner or staff only."""
    group, _sep, pk = rest.partition(":")
    model = GROUPS.get(group)
    if model is None:
        return False
    doc = model.objects.select_related("worker").filter(pk=pk).first()
    if doc is None or not doc.document or doc.document.name != name:
        return False
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    return bool(user.is_staff or (doc.worker.user_id and doc.worker.user_id == user.pk))


# --------------------------------------------------------------------------- verification
def verify_document(doc, *, status: str, note: str = "", user=None):
    if status not in ("verified", "rejected"):
        raise APIError(
            "validation_error", fields={"status": [pgettext("mobility", "Choose verified or rejected.")]}
        )
    if status == "verified" and doc.expires_on and doc.expires_on < today_ad():
        raise InvalidState(
            message=pgettext("mobility", "This document has already expired and cannot be verified.")
        )
    if status == "verified" and not doc.document:
        raise InvalidState(
            message=pgettext("mobility", "Upload of the document is missing; it cannot be verified.")
        )
    doc.status = status
    doc.note = note or None
    doc.verified_by = user if getattr(user, "is_authenticated", False) else None
    doc.verified_at = timezone.now()
    doc.save(update_fields=["status", "note", "verified_by", "verified_at", "updated_at"])
    if status == "verified" and has_duplicate_number(doc):
        _flag_duplicate(doc)
    return doc


def _flag_duplicate(doc) -> None:
    try:
        from apps.risk.services import flag
    except ImportError:
        return
    try:
        flag(doc, "duplicate_identity", "high", {"reason": "same document number on another worker"})
    except Exception:  # noqa: BLE001 - risk flagging must never block verification
        logger.exception("risk.flag failed for mobility document %s", doc.pk)


# --------------------------------------------------------------------------- agencies
def eligible_agencies_qs(on=None):
    from apps.partners.models import Partner

    on = on or timezone.localdate()
    return Partner.objects.filter(
        is_active=True,
        kind="recruitment_agency",
        compliance_status="verified",
        license_valid_until__gte=on,
    ).order_by("name")


def agency_public(p) -> dict:
    from apps.partners import labels as plabels

    return {
        "id": str(p.id),
        "name": p.name,
        "license_no": p.license_no or None,
        "license_valid_until": _date(p.license_valid_until),
        "license_valid_until_bs": _bs(p.license_valid_until),
        "regulator": p.regulator or None,
        "regulator_label": core_labels.label(plabels.REGULATOR, p.regulator),
        "contact_phone": p.contact_phone or None,
        "contact_email": p.contact_email or None,
    }


def agency_ops_dict(p, *, active_shares: int | None = None) -> dict:
    from apps.partners import labels as plabels

    today = timezone.localdate()
    days_left = (p.license_valid_until - today).days if p.license_valid_until else None
    return {
        **agency_public(p),
        "is_active": p.is_active,
        "compliance_status": p.compliance_status,
        "compliance_status_label": core_labels.label(plabels.COMPLIANCE_STATUS, p.compliance_status),
        "compliance_verified_at": p.compliance_verified_at.isoformat() if p.compliance_verified_at else None,
        "compliance_verified_by": (
            {"id": str(p.compliance_verified_by.id), "full_name": p.compliance_verified_by.full_name}
            if p.compliance_verified_by_id
            else None
        ),
        "compliance_note": p.compliance_note or None,
        "license_valid": p.license_valid_on(today),
        "license_days_left": days_left,
        "eligible": p.is_eligible_agency(today),
        "active_shares": active_shares,
    }


def set_compliance(
    partner, *, status: str, license_valid_until=None, license_no=None, note: str = "", user=None
):
    if partner.kind != "recruitment_agency":
        raise InvalidState(message=pgettext("mobility", "Only recruitment agencies have licence compliance."))
    if license_no:
        partner.license_no = license_no.strip()
    if status == "verified":
        if not partner.license_no:
            raise APIError(
                "validation_error",
                fields={
                    "license_no": [pgettext("mobility", "Record the agency's DoFE licence number first.")]
                },
            )
        valid = license_valid_until or partner.license_valid_until
        if valid is None or valid < timezone.localdate():
            raise APIError(
                "validation_error",
                fields={
                    "license_valid_until": [
                        pgettext("mobility", "A verified licence must be valid today or later.")
                    ]
                },
            )
    if license_valid_until is not None:
        partner.license_valid_until = license_valid_until
    partner.compliance_status = status
    partner.compliance_note = note or ""
    partner.compliance_verified_by = user if getattr(user, "is_authenticated", False) else None
    partner.compliance_verified_at = timezone.now()
    partner.save(
        update_fields=[
            "license_no",
            "license_valid_until",
            "compliance_status",
            "compliance_note",
            "compliance_verified_by",
            "compliance_verified_at",
        ]
    )
    return partner


# --------------------------------------------------------------------------- shares
def create_share(worker, partner, days: int):
    from apps.partners.services import create_grant, ensure_eligible_agency

    days = int(days)
    if days < 1 or days > SHARE_MAX_DAYS:
        raise APIError(
            "validation_error",
            fields={
                "days": [
                    pgettext("mobility", "Must be between 1 and %(max)s days.") % {"max": SHARE_MAX_DAYS}
                ]
            },
        )
    ensure_eligible_agency(partner)
    return create_grant(worker, partner, purpose="recruitment", scopes=SHARE_SCOPES, days=days, channel="app")


def worker_shares_qs(worker):
    from apps.partners.models import ConsentGrant

    return ConsentGrant.objects.filter(worker=worker, purpose="recruitment").select_related("partner")


# --------------------------------------------------------------------------- partner API
SUMMARY_KINDS = ("passport", "labour_permit", "visa", "police_clearance", "medical_fitness")


def partner_summary(worker) -> dict:
    """What a licensed agency sees: kinds, verified flags, expiry dates, masked numbers. Never files
    or full numbers. Rejected documents are omitted."""
    today = today_ad()
    docs = [d for d in worker_documents(worker) if d.status != "rejected"]
    items = []
    for d in docs:
        items.append(
            {
                "kind_group": d.KIND_GROUP,
                "kind": d.kind,
                "kind_label": core_labels.label(labels.KIND, d.kind),
                "title": d.title,
                "issuer": getattr(d, "issuer", None),
                "issuing_country": getattr(d, "issuing_country", None),
                "number_masked": mask(number_of(d)) or None,
                "score_or_level": getattr(d, "score_or_level", None),
                "issued_on": _date(d.issued_on),
                "expires_on": _date(d.expires_on),
                "status": d.status,
                "verified": d.status == "verified",
                "valid": is_valid(d, today),
                "verified_at": d.verified_at.isoformat() if d.verified_at else None,
            }
        )
    flags = {f"{k}_valid": any(i["kind"] == k and i["valid"] for i in items) for k in SUMMARY_KINDS}
    return {
        "worker": {"id": str(worker.id), "full_name": worker.full_name},
        "documents": items,
        "flags": flags,
        "generated_at": timezone.now().isoformat(),
    }


# --------------------------------------------------------------------------- ops queue
def ops_documents(params) -> list:
    status = params.get("status")
    group = params.get("kind_group")
    kind = params.get("kind")
    q = params.get("q")
    out = []
    for g, model in GROUPS.items():
        if group and group != g:
            continue
        qs = model.objects.select_related("worker", "verified_by")
        if status:
            qs = qs.filter(status__in=status.split(","))
        if kind:
            qs = qs.filter(kind__in=kind.split(","))
        if params.get("worker"):
            qs = qs.filter(worker_id=params["worker"])
        if q:
            cond = Q(worker__full_name__icontains=q) | Q(worker__phone__contains=q)
            if model is ClearanceDocument:
                cond |= Q(title__icontains=q) | Q(issuer__icontains=q)
            qs = qs.filter(cond)
        out.extend(qs)
    # Pending is a queue: oldest first. Otherwise newest first.
    out.sort(key=lambda d: d.created_at, reverse=status != "pending")
    return out
