"""Localised labels for experience enums (``*_label`` fields)."""

from django.utils.translation import pgettext_lazy

STATUS = {
    "self_reported": pgettext_lazy("growth", "Self-reported"),
    "reference_pending": pgettext_lazy("growth", "Reference check pending"),
    "verified": pgettext_lazy("growth", "Verified"),
    "unverifiable": pgettext_lazy("growth", "Could not verify"),
    "rejected": pgettext_lazy("growth", "Rejected"),
}
METHOD = {
    "reference_call": pgettext_lazy("growth", "Reference call"),
    "document": pgettext_lazy("growth", "Document checked"),
    "employer_confirmed": pgettext_lazy("growth", "Confirmed by employer"),
}
# passport ``verified_by`` value per verification method
PASSPORT_SOURCE = {"reference_call": "reference", "employer_confirmed": "employer", "document": "document"}
