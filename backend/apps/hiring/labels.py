"""Localised labels for hiring enums added by the worker-growth extension."""

from django.utils.translation import pgettext_lazy

SOURCE = {
    "ops": pgettext_lazy("growth", "KaamSathi match"),
    "worker_interest": pgettext_lazy("growth", "Worker applied"),
    "employer_invite": pgettext_lazy("growth", "Employer invite"),
}
WORKER_RESPONSE = {
    "pending": pgettext_lazy("growth", "Awaiting worker"),
    "interested": pgettext_lazy("growth", "Worker interested"),
    "declined": pgettext_lazy("growth", "Worker declined"),
}
OFFER_STATUS = {
    "sent": pgettext_lazy("growth", "Offer sent"),
    "accepted": pgettext_lazy("growth", "Offer accepted"),
    "declined": pgettext_lazy("growth", "Offer declined"),
    "expired": pgettext_lazy("growth", "Offer expired"),
    "withdrawn": pgettext_lazy("growth", "Offer withdrawn"),
}
CONTRACT_TYPE = {
    "permanent": pgettext_lazy("growth", "Permanent"),
    "fixed_term": pgettext_lazy("growth", "Fixed term"),
    "daily": pgettext_lazy("growth", "Daily wage"),
    "probation": pgettext_lazy("growth", "Probation"),
}
ALERT_FREQUENCY = {
    "instant": pgettext_lazy("growth", "Instant"),
    "daily": pgettext_lazy("growth", "Daily"),
    "weekly": pgettext_lazy("growth", "Weekly"),
}
