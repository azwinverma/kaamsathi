"""Localised labels for support cases (msgctxt "trustops" in locale/ne/LC_MESSAGES/django.po)."""

from django.utils.translation import pgettext_lazy

from apps.core.labels import choices, label  # noqa: F401 - re-exported for callers


def _(text):
    return pgettext_lazy("trustops", text)


CHANNEL = {
    "app": _("Mobile app"),
    "web": _("Website"),
    "phone": _("Phone call"),
    "sms": _("SMS"),
    "field": _("Field visit"),
}

CATEGORY = {
    "account": _("Account & login"),
    "payment": _("Wages & payments"),
    "attendance": _("Attendance (hajiri)"),
    "job": _("Jobs & hiring"),
    "privacy": _("Privacy & my data"),
    "technical": _("Technical problem"),
    "safety": _("Safety incident"),
    "other": _("Other"),
}

# Safety incidents (category "safety"): what happened — kept in the case's ``safety_kind``.
SAFETY_KIND = {
    "unsafe_workplace": _("Unsafe workplace"),
    "harassment": _("Harassment or abuse"),
    "payment_withholding": _("Wages withheld"),
    "other": _("Other safety concern"),
}

IDENTITY_METHOD = {
    "otp": _("One-time code to registered phone"),
    "security_questions": _("Security questions"),
}

HELP_AUDIENCE = {"worker": _("Workers"), "employer": _("Employers"), "all": _("Everyone")}

HELP_CATEGORY = {
    "getting_started": _("Getting started"),
    "attendance": _("Attendance (hajiri)"),
    "pay": _("Wages & payslips"),
    "verification": _("Verification"),
    "safety": _("Safety & problems"),
    "privacy": _("Privacy"),
    "hiring": _("Hiring"),
    "compliance": _("Labour law & SSF"),
}

PRIORITY = {
    "low": _("Low"),
    "normal": _("Normal"),
    "high": _("High"),
    "urgent": _("Urgent"),
}

STATUS = {
    "open": _("Open"),
    "pending_user": _("Waiting for you"),
    "resolved": _("Resolved"),
    "closed": _("Closed"),
}

MESSAGES = {
    "case_closed": _("This case is closed. Please open a new case."),
    "assignee_not_staff": _("Cases can only be assigned to KaamSathi staff."),
    "notify_reply_title": _("Reply on your support case"),
    "notify_reply_body": _("KaamSathi support replied on case {number}: {subject}"),
    "notify_status_title": _("Support case updated"),
    "notify_status_body": _("Case {number} is now: {status}"),
    "escalated_case_title": _("Support case overdue"),
    "escalated_case_body": _("Case {number} ({priority}) passed its SLA: {subject}"),
    "escalated_dispute_title": _("Dispute overdue"),
    "escalated_dispute_body": _("A {kind} dispute is past its 7-day SLA ({status})."),
    "emergency_title": _("EMERGENCY safety report"),
    "emergency_body": _("Case {number}: {kind} reported as an emergency. Call the reporter now."),
    "safety_kind_required": _("Choose what kind of safety problem this is."),
    "identity_check_required": _(
        "Verify the caller's identity (OTP or security questions) in the last 15 minutes first."
    ),
    "case_has_no_worker": _("This case is not linked to a worker."),
    "lookup_needs_query": _("Search by phone or citizenship number."),
    "anonymous_worker": _("Anonymous worker"),
    "phone_taken": _("Another account already uses this phone number."),
}
