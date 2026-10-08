"""Localised labels for mobility enums (``*_label`` fields). Context "mobility" in the ne catalog."""

from django.utils.translation import pgettext_lazy

TRAVEL_KIND = {
    "passport": pgettext_lazy("mobility", "Passport"),
    "labour_permit": pgettext_lazy("mobility", "Labour permit"),
    "visa": pgettext_lazy("mobility", "Visa"),
}
CLEARANCE_KIND = {
    "police_clearance": pgettext_lazy("mobility", "Police clearance"),
    "medical_fitness": pgettext_lazy("mobility", "Medical fitness"),
    "pre_departure_orientation": pgettext_lazy("mobility", "Pre-departure orientation"),
    "insurance": pgettext_lazy("mobility", "Insurance"),
    "language_test": pgettext_lazy("mobility", "Language test"),
}
KIND = {**TRAVEL_KIND, **CLEARANCE_KIND}
KIND_GROUP = {
    "travel": pgettext_lazy("mobility", "Travel document"),
    "clearance": pgettext_lazy("mobility", "Clearance"),
}
STATUS = {
    "pending": pgettext_lazy("mobility", "Waiting for verification"),
    "verified": pgettext_lazy("mobility", "Verified"),
    "rejected": pgettext_lazy("mobility", "Rejected"),
    "expired": pgettext_lazy("mobility", "Expired"),
}
