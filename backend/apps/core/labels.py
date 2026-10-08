"""Localised labels for enum values (``*_label`` fields) and error messages.

Translations live in ``locale/ne/LC_MESSAGES/django.po``; the active language is
picked from ``Accept-Language`` by Django's LocaleMiddleware.
"""

from django.utils.translation import gettext_lazy as _
from django.utils.translation import pgettext_lazy

JOB_STATUS = {
    "draft": _("Draft"),
    "open": _("Open"),
    "filled": _("Filled"),
    "closed": _("Closed"),
}
STAGE = {
    "sourced": _("Sourced"),
    "shortlisted": _("Shortlisted"),
    "interview": _("Interview"),
    "selected": _("Selected"),
    "joined": _("Joined"),
    "rejected": _("Not selected"),
    "dropped": _("Dropped out"),
}
PAYROLL_STATUS = {
    "draft": _("Draft"),
    "approved": _("Approved"),
    "paid": _("Paid"),
}
PAYMENT_STATUS = {"pending": _("Pending"), "paid": _("Paid")}
ATTENDANCE_STATUS = {
    "present": _("Present"),
    "absent": _("Absent"),
    "half_day": _("Half day"),
    "leave": _("On leave"),
    "holiday": _("Public holiday"),
    "weekly_off": _("Weekly off"),
}
LEAVE_TYPE = {
    "home": _("Home leave"),
    "sick": _("Sick leave"),
    "maternity": _("Maternity leave"),
    "paternity": _("Paternity leave"),
    "mourning": _("Mourning leave"),
    "unpaid": _("Unpaid leave"),
}
LEAVE_STATUS = {"pending": _("Pending"), "approved": _("Approved"), "rejected": _("Rejected")}
EMPLOYMENT_STATUS = {"active": _("Active"), "ended": _("Ended")}
END_REASON = {
    "resigned": _("Resigned"),
    "terminated": _("Terminated"),
    "contract_end": _("Contract ended"),
    "absconded": _("Absconded"),
    "other": _("Other"),
}
WAGE_TYPE = {
    "monthly": _("Monthly salary"),
    "daily": _("Daily wage (Jyala)"),
    "hourly": pgettext_lazy("complete2", "Hourly wage"),
}
PAYMENT_METHOD = {
    "bank": _("Bank transfer"),
    "esewa": _("eSewa"),
    "khalti": _("Khalti"),
    "cash": _("Cash"),
}
VERIFICATION_STATUS = {
    "unverified": _("Unverified"),
    "pending": _("Pending"),
    "verified": _("Verified"),
    "rejected": _("Rejected"),
}
ROLE = {
    "owner": _("Owner"),
    "admin": _("Admin"),
    "hr": _("HR"),
    "supervisor": _("Supervisor"),
}
INDUSTRY = {
    "hospitality": _("Hospitality"),
    "healthcare": _("Healthcare"),
    "security": _("Security"),
    "construction": _("Construction"),
    "manufacturing": _("Manufacturing"),
    "retail": _("Retail"),
    "other": _("Other"),
}
CHARGE_STATUS = {"unpaid": _("Unpaid"), "paid": _("Paid"), "waived": _("Waived")}
CHARGE_KIND = {"placement": _("Placement fee"), "subscription": _("Subscription")}

ERROR_MESSAGES = {
    "validation_error": _("Some fields are invalid."),
    "not_authenticated": _("Please log in to continue."),
    "permission_denied": _("You do not have permission to do this."),
    "org_forbidden": _("You do not have access to this organization."),
    "not_found": _("Not found."),
    "otp_invalid": _("The code is incorrect."),
    "otp_expired": _("The code has expired. Please request a new one."),
    "otp_rate_limited": _("Too many code requests. Please try again later."),
    "below_minimum_wage": _("Wage is below the government minimum wage."),
    "invalid_state": _("This action is not allowed in the current state."),
    "outside_geofence": _("You are outside the work site area."),
    "duplicate": _("This already exists."),
    "throttled": _("Too many requests. Please slow down."),
    "server_error": _("Something went wrong. Please try again."),
    # Security & platform (docs/CONTRACT-EXTENSIONS.md §1)
    "mfa_required": pgettext_lazy("security", "Set up two-step login before using the ops console."),
    "mfa_invalid": pgettext_lazy("security", "The authenticator code is incorrect."),
    "mfa_token_invalid": pgettext_lazy("security", "Your login step expired. Please log in again."),
    "mfa_locked": pgettext_lazy("security", "Too many wrong codes. Please try again in 15 minutes."),
    "idempotency_conflict": pgettext_lazy("security", "This request was already submitted."),
    "upload_rejected": pgettext_lazy("security", "This file was not accepted."),
    "maintenance": pgettext_lazy(
        "security", "KaamSathi is under maintenance. Please try again in a few minutes."
    ),
}


def label(mapping: dict, value) -> str | None:
    if value is None or value == "":
        return None
    text = mapping.get(value)
    return str(text) if text is not None else str(value)


def choices(mapping: dict):
    return [(k, v) for k, v in mapping.items()]
