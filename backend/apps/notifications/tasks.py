import logging

from celery import shared_task

logger = logging.getLogger("kaamsathi.notifications")


def _sms(phone, body, kind):
    try:
        send_sms.delay(phone, body, kind=kind)
    except Exception:  # noqa: BLE001 - broker down: send inline
        send_sms.apply(args=(phone, body), kwargs={"kind": kind})


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_sms(self, phone: str, body: str, kind: str = "generic", log_body: str | None = None):
    from .models import SMSMessage
    from .sms import get_backend

    backend = get_backend()
    msg = SMSMessage.objects.create(
        phone=phone, body=log_body if log_body is not None else body, kind=kind, backend=backend.name
    )
    result = backend.send(phone, body)
    msg.status = "sent" if result.ok else "failed"
    msg.provider_response = result.response
    msg.save(update_fields=["status", "provider_response"])
    if not result.ok and backend.name != "console":
        logger.warning("SMS failed to %s: %s", phone, result.response)
        raise self.retry()
    return result.ok


@shared_task
def interview_reminder(application_id: str):
    from django.utils import timezone

    from apps.core.bs import format_bs_en
    from apps.hiring.models import Application

    app = Application.objects.select_related("job__organization", "worker").filter(pk=application_id).first()
    if not app or app.stage != "interview" or not app.interview_at:
        return False
    when = timezone.localtime(app.interview_at)
    body = (
        f"KaamSathi: Reminder - interview for {app.job.title} at {app.job.organization.name} "
        f"today {when:%I:%M %p} ({format_bs_en(when.date())})."
    )
    _sms(app.worker.phone, body, "interview_reminder")
    return True


@shared_task
def payslip_ready(run_id: str):
    from apps.core.money import format_npr
    from apps.payroll.models import PayrollRun

    run = PayrollRun.objects.select_related("organization").filter(pk=run_id).first()
    if not run:
        return 0
    count = 0
    from apps.core.bs import MONTHS_EN

    for slip in run.payslips.select_related("worker"):
        body = (
            f"KaamSathi: Your {MONTHS_EN[run.bs_month]} {run.bs_year} salary {format_npr(slip.net_pay)} "
            f"from {run.organization.name} is paid. See payslip in the KaamSathi app."
        )
        _sms(slip.worker.phone, body, "payslip_ready")
        count += 1
    return count


@shared_task
def notify_employer_shortlist(job_id: str, count: int):
    from apps.hiring.models import JobOpening

    job = JobOpening.objects.select_related("organization").filter(pk=job_id).first()
    if not job:
        return 0
    phones = job.organization.memberships.filter(
        is_active=True, role__in=["owner", "admin", "hr"]
    ).values_list("user__phone", flat=True)
    body = f"KaamSathi: {count} new candidate(s) shortlisted for '{job.title}'. Review in KaamSathi."
    for phone in phones:
        _sms(phone, body, "shortlist")
    return len(phones)
