"""Localised labels for hiring enums added by the worker-growth extension."""

from django.utils.translation import pgettext_lazy

from apps.core.labels import JOB_STATUS as _CORE_JOB_STATUS


def _c(text):
    return pgettext_lazy("complete1", text)


# core statuses + ``paused`` (J006): hidden from recommendations/alerts, no new shortlists.
JOB_STATUS = {**_CORE_JOB_STATUS, "paused": _c("Paused")}
INTERVIEW_MODE = {
    "in_person": _c("In person"),
    "phone": _c("Phone"),
    "video": _c("Video call"),
    "trade_test": _c("Trade test"),
}
INTERVIEW_OUTCOME = {
    "pending": _c("Scheduled"),
    "passed": _c("Passed"),
    "failed": _c("Did not pass"),
    "no_show": _c("Did not attend"),
}
MESSAGES = {
    "job_paused": _c("This job is paused. Resume it first."),
    "job_not_open": _c("This job is not open."),
    "invite_not_eligible": _c(
        "You can invite workers who worked for you before, or who shared their Skill Passport with you."
    ),
    "share_invalid": _c("This Skill Passport link is expired or revoked."),
    "already_in_pipeline": _c("This worker is already in this job's pipeline."),
    "interview_stage": _c("Interviews can be scheduled for shortlisted or interview-stage candidates."),
    "assignee_not_member": _c("The assignee must be an active member of your organization."),
    "owner_not_staff": _c("The owner must be a KaamSathi staff member."),
    "requirement_empty": _c("Pick a trade, credential, NSTB level or minimum years."),
    "too_many_requirements": _c("A job can have at most 10 requirements."),
    "too_many_tags": _c("An application can have at most 10 tags."),
}

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
