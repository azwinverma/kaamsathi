"""Localised labels for training enums (``*_label`` fields)."""

from django.utils.translation import gettext_lazy as _
from django.utils.translation import pgettext_lazy

PROVIDER_VERIFICATION = {
    "unverified": pgettext_lazy("complete1", "Not verified"),
    "pending": pgettext_lazy("complete1", "Verification pending"),
    "verified": pgettext_lazy("complete1", "Verified provider"),
    "rejected": pgettext_lazy("complete1", "Verification rejected"),
}

PROVIDER_KIND = {
    "ctevt_affiliated": _("CTEVT affiliated"),
    "private": _("Private institute"),
    "ngo": _("NGO"),
    "employer": _("Employer"),
    "government": _("Government"),
}
LEVEL = {
    "basic": _("Basic"),
    "level1": _("Level 1"),
    "level2": _("Level 2"),
    "level3": _("Level 3"),
    "refresher": _("Refresher"),
}
MODE = {"classroom": _("Classroom"), "on_site": _("On site"), "online": _("Online")}
COURSE_STATUS = {"open": _("Open"), "closed": _("Closed"), "completed": _("Completed")}
ENROLLMENT_STATUS = {
    "applied": _("Applied"),
    "enrolled": _("Enrolled"),
    "completed": _("Completed"),
    "dropped": _("Dropped out"),
    "rejected": _("Not selected"),
}
