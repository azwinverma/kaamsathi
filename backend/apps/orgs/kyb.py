"""Employer verification (KYB): documents, signed-URL access rule, labels and the shortlist gate."""

from __future__ import annotations

from django.utils.translation import pgettext_lazy

from apps.core.files import register_check, signed_url


def _(text):
    return pgettext_lazy("trustops", text)


STATUS = {
    "unverified": _("Not verified"),
    "pending": _("Under review"),
    "verified": _("Verified employer"),
    "rejected": _("Verification rejected"),
}

MESSAGES = {
    "already_verified": _("This employer is already verified."),
    "doc_required": _("Upload this document."),
    "note_required": _("Explain why the verification was rejected."),
    "not_verified_shortlist": _("Employer is not verified yet"),
    "kyb_submitted_title": _("Verification documents received"),
    "kyb_submitted_body": _("{org} submitted documents for employer verification."),
    "kyb_verified_title": _("Your organization is verified"),
    "kyb_verified_body": _("{org} is now a Verified employer on KaamSathi."),
    "kyb_rejected_title": _("Verification needs attention"),
    "kyb_rejected_body": _(
        "{org}: verification was rejected. Open KaamSathi → Verification to fix and resubmit."
    ),
}

DOC_FIELDS = ("registration_doc", "pan_doc")


def kyb_required_for_shortlist(organization=None) -> bool:
    """Settings ``KYB_REQUIRED_FOR_SHORTLIST``, overridable by the ``kyb_required_for_shortlist`` flag."""
    from apps.core.flags import is_enabled

    return is_enabled("kyb_required_for_shortlist", organization=organization)


def is_verified(org) -> bool:
    return org is not None and org.verification_status == "verified"


def can_view_kyb_doc(user, org) -> bool:
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_staff:
        return True
    from .models import Membership

    return Membership.objects.filter(
        user=user, organization=org, is_active=True, role__in=["owner", "admin"]
    ).exists()


def doc_url(request, org, field: str) -> str | None:
    """Short-lived signed URL for a KYB document, only for staff and the org's owner/admin."""
    from apps.core.files import request_user

    file_field = getattr(org, field, None)
    if not file_field:
        return None
    user = request_user(request)
    if not can_view_kyb_doc(user, org):
        return None
    return signed_url(file_field, user, request, check=f"kyb:{org.pk}:{field}")


def _recheck(rest: str, user, name: str) -> bool:
    from .models import Organization

    org_id, _sep, field = rest.partition(":")
    if field not in DOC_FIELDS:
        return False
    org = Organization.objects.filter(pk=org_id).first()
    if org is None:
        return False
    current = getattr(org, field, None)
    if not current or current.name != name:  # replaced document → old links die
        return False
    return can_view_kyb_doc(user, org)


register_check("kyb", _recheck)


def verification_payload(org, request, *, staff: bool = False) -> dict:
    from apps.core.crypto import mask
    from apps.core.labels import label

    data = {
        "verification_status": org.verification_status,
        "verification_status_label": label(STATUS, org.verification_status),
        "registration_no": org.registration_no or "",
        "pan_no": org.pan_no if staff else None,
        "pan_no_masked": mask(org.pan_no) if org.pan_no else "",
        "registration_doc_url": doc_url(request, org, "registration_doc"),
        "pan_doc_url": doc_url(request, org, "pan_doc"),
        "has_registration_doc": bool(org.registration_doc),
        "has_pan_doc": bool(org.pan_doc),
        "registration_doc_name": _basename(org.registration_doc),
        "pan_doc_name": _basename(org.pan_doc),
        "verified_at": org.verified_at.isoformat() if org.verified_at else None,
        "verification_note": org.verification_note or "",
    }
    if staff:
        data["verified_by"] = (
            {"id": str(org.verified_by_id), "full_name": org.verified_by.full_name}
            if org.verified_by_id
            else None
        )
    return data


def _basename(file_field) -> str | None:
    name = getattr(file_field, "name", None)
    return name.rsplit("/", 1)[-1] if name else None
