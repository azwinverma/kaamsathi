"""Localised labels for billing enums (``*_label`` fields). Nepali: msgctxt "billing2"."""

from django.utils.translation import gettext_lazy as _
from django.utils.translation import pgettext_lazy

from apps.core.labels import choices, label  # noqa: F401  (re-exported)


def b(text):
    return pgettext_lazy("billing2", text)


CHARGE_STATUS = {
    "unpaid": _("Unpaid"),
    "paid": _("Paid"),
    "waived": _("Waived"),
    "refunded": b("Refunded"),
}
CHARGE_KIND = {
    "placement": _("Placement fee"),
    "subscription": _("Subscription"),
    "verification_fee": b("Verification service fee"),
    "training_commission": b("Training commission"),
    "partner_referral_fee": b("Partner referral fee"),
    # Bolau: paid by the Ghardhani (``payer_user``) only — never by a Sipalu/worker.
    "booking_fee": b("Bolau booking fee"),
}
# Kinds billed to an individual user (``payer_user``); never invoiced (a receipt PDF per paid fee).
USER_KINDS = frozenset({"booking_fee"})
# Kinds that may only be billed to a partner / training provider (never a worker, never an org).
PARTNER_KINDS = frozenset({"training_commission", "partner_referral_fee"})

PLAN_CODE = {
    "pilot": b("Pilot"),
    "starter": b("Starter"),
    "growth": b("Growth"),
    "business": b("Business"),
    "enterprise": b("Enterprise"),
}
SUBSCRIPTION_STATUS = {"active": b("Active"), "paused": b("Paused"), "cancelled": b("Cancelled")}
INVOICE_STATUS = {"draft": b("Draft"), "issued": b("Issued"), "paid": b("Paid"), "void": b("Void")}
PAYMENT_METHOD = {
    "bank": b("Bank transfer"),
    "cheque": b("Cheque"),
    "esewa": b("eSewa"),
    "khalti": b("Khalti"),
    "cash": b("Cash"),
    "other": b("Other"),
}
