"""Localised labels for the crews app (msgctxt "crews" in locale/ne/LC_MESSAGES/django.po)."""

from django.utils.translation import pgettext_lazy

from apps.core.labels import choices, label  # noqa: F401 - re-exported for callers


def _(text):
    return pgettext_lazy("crews", text)


REFERRAL_STATUS = {
    "pending": _("Pending"),
    "eligible": _("Eligible"),
    "paid": _("Paid"),
    "void": _("Void"),
}

MESSAGES = {
    "no_crew": _("You do not lead a crew yet."),
    "already_lead": _("You already lead a crew."),
    "in_other_crew": _("This worker is already in another naike's crew."),
    "self_member": _("You cannot add yourself to your own crew."),
    "not_member": _("This worker is not in your crew."),
    "crew_inactive": _("Your crew is not active."),
    "not_eligible": _("Only eligible referrals can be marked paid."),
    "cannot_void": _("Only pending or eligible referrals can be voided."),
    "void_ended_early": _("Employment ended before the hold period."),
    "void_no_employment": _("No employment found for this placement."),
    "invalid_phone": _("Enter a valid 10-digit mobile number (97/98…)."),
}
