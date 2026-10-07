"""Localised labels for credentials enums (``*_label`` fields)."""

from django.utils.translation import gettext_lazy as _

KIND = {
    "nstb": _("NSTB skill certificate"),
    "ctevt_training": _("CTEVT training"),
    "training_course": _("Training course"),
    "license": _("License"),
    "safety": _("Safety training"),
    "language": _("Language"),
    "other": _("Other"),
}
STATUS = {
    "pending": _("Pending"),
    "verified": _("Verified"),
    "rejected": _("Rejected"),
    "expired": _("Expired"),
}
METHOD = {
    "document": _("Document checked"),
    "issuer_registry": _("Issuer registry"),
    "issuer_partner": _("Issuing partner"),
    "ops_call": _("Phone call to issuer"),
}
RESULT = {"pass": _("Passed"), "fail": _("Not passed")}
SHARE_PURPOSE = {
    "job": _("Job application"),
    "recruitment_agency": _("Recruitment agency"),
    "bank": _("Bank"),
    "other": _("Other"),
}
NSTB_LEVEL = {
    "none": _("None"),
    "elementary": _("Elementary"),
    "level1": _("Level 1"),
    "level2": _("Level 2"),
    "level3": _("Level 3"),
}
