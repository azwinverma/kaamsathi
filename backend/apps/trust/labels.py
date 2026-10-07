"""Localised labels for the trust app (msgctxt "trust" in locale/ne/LC_MESSAGES/django.po)."""

from django.utils.translation import pgettext_lazy

from apps.core.labels import choices, label  # noqa: F401 - re-exported for callers


def _(text):
    return pgettext_lazy("trust", text)


VIEW_CONTEXT = {
    "application": _("Job application"),
    "employment": _("Employment record"),
    "ops": _("KaamSathi staff"),
    "partner": _("Partner (with your consent)"),
    "passport": _("Skill Passport link"),
    "crew": _("Crew lead"),
}

VERIFICATION_LEVEL = {
    0: _("Phone verified"),
    1: _("Identity verified"),
    2: _("Employment verified"),
    3: _("Skills assessed"),
    4: _("Certification verified"),
    5: _("Highly trusted"),
}

DISPUTE_KIND = {
    "attendance": _("Attendance (hajiri)"),
    "wage": _("Wage / payslip"),
    "employment_dates": _("Employment dates"),
    "rating": _("Rating"),
    "identity": _("Identity details"),
    "other": _("Other"),
}

DISPUTE_STATUS = {
    "open": _("Open"),
    "employer_responded": _("Employer responded"),
    "resolved": _("Resolved"),
    "rejected": _("Rejected"),
}

NEXT_STEPS = {
    "verify_identity": _("Get your citizenship card verified by KaamSathi."),
    "build_history": _("Work 30 days with an employer that records hajiri on KaamSathi."),
    "assessment": _("Take a skill assessment for your trade."),
    "certificate": _("Upload your NSTB certificate."),
    "attendance": _("Keep your hajiri regular — absences lower your reliability score."),
    "tenure": _("Staying longer with one employer raises your reliability score."),
}

MESSAGES = {
    "rate_too_early": _("You can rate an employer after 30 days of work or when the job ends."),
    "already_rated": _("You have already rated this employer."),
    "not_your_employment": _("This employment is not yours."),
    "not_your_payslip": _("This payslip is not yours."),
    "dispute_closed": _("This dispute is already closed."),
    "dispute_not_open": _("Only open disputes can be answered."),
    "dispute_needs_org": _("Choose the employment or payslip this dispute is about."),
}


def level_label(level) -> str | None:
    if level is None:
        return None
    return str(VERIFICATION_LEVEL.get(int(level), level))
