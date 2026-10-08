"""Localised labels for risk flags (msgctxt "trustops" in locale/ne/LC_MESSAGES/django.po)."""

from django.utils.translation import pgettext_lazy

from apps.core.labels import choices, label  # noqa: F401 - re-exported for callers


def _(text):
    return pgettext_lazy("trustops", text)


SUBJECT_TYPE = {
    "worker": _("Worker"),
    "organization": _("Employer"),
    "employment": _("Employment"),
    "attendance": _("Attendance record"),
    "credential": _("Credential"),
    "work_history": _("Work history entry"),
    "travel_document": _("Travel document"),
}

KIND = {
    "duplicate_identity": _("Duplicate identity"),
    "shared_bank_account": _("Shared bank account"),
    "document_reuse": _("Document reused"),
    "attendance_anomaly": _("Attendance anomaly"),
    "geo_anomaly": _("Location anomaly"),
    "velocity": _("Unusual onboarding speed"),
    "reference_mismatch": _("Reference mismatch"),
    "manual": _("Raised by staff"),
}

SEVERITY = {
    "low": _("Low"),
    "medium": _("Medium"),
    "high": _("High"),
}

STATUS = {
    "open": _("Open"),
    "confirmed": _("Confirmed"),
    "dismissed": _("Dismissed"),
}

REASON = {
    "same_citizenship": _("Same citizenship number as another worker"),
    "same_nid": _("Same national ID number as another worker"),
    "same_bank_account": _("Same bank account as another worker"),
    "same_document": _("Same document file uploaded for another worker"),
    "outside_geofence": _("Repeated check-ins outside the site geofence"),
    "buddy_punching": _("Several workers checked in from identical coordinates within a minute"),
    "checkout_before_checkin": _("Check-out recorded before check-in"),
    "onboarded_by_many": _("Onboarded by several employers within a week"),
}

MESSAGES = {
    "subject_not_found": _("The flagged record was not found."),
    "flag_closed": _("This flag is already resolved."),
}
