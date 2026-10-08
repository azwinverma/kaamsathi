import logging

from celery import shared_task

logger = logging.getLogger("kaamsathi.notifications")


def _sms(phone, body, kind):
    from .services import mirror_to_inbox

    try:
        send_sms.delay(phone, body, kind=kind)
    except Exception:  # noqa: BLE001 - broker down: send inline
        send_sms.apply(args=(phone, body), kwargs={"kind": kind})
    mirror_to_inbox(phone, body, kind)


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
def interview_reminder(
    application_id: str, interview_id: str | None = None, scheduled_for: str | None = None
):
    from django.utils import timezone

    from apps.core.bs import format_bs_en
    from apps.hiring.models import Application

    app = Application.objects.select_related("job__organization", "worker").filter(pk=application_id).first()
    if interview_id:  # per-round reminder (L010): skip if the round was rescheduled, decided or removed
        from apps.hiring.models import Interview

        iv = Interview.objects.filter(
            pk=interview_id, application_id=application_id, outcome="pending"
        ).first()
        if not app or app.stage in Application.TERMINAL or iv is None:
            return False
        import datetime as _dt

        if scheduled_for and _dt.datetime.fromisoformat(scheduled_for) != iv.scheduled_at:
            return False
        when = timezone.localtime(iv.scheduled_at)
    elif not app or app.stage != "interview" or not app.interview_at:
        return False
    else:
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

    from .services import notify

    for slip in run.payslips.select_related("worker__user"):
        body = (
            f"KaamSathi: Your {MONTHS_EN[run.bs_month]} {run.bs_year} salary {format_npr(slip.net_pay)} "
            f"from {run.organization.name} is paid. See payslip in the KaamSathi app."
        )
        user = slip.worker.user
        if user is not None and user.phone == slip.worker.phone:
            # Templated inbox + SMS (+ email when the user has one), honouring preferences.
            notify(
                user,
                "payslip_ready",
                "Salary paid",
                body,
                sms=True,
                template="payslip_ready",
                context={
                    "month": f"{MONTHS_EN[run.bs_month]} {run.bs_year}",
                    "amount": format_npr(slip.net_pay),
                    "organization": run.organization.name,
                    "name": slip.worker.full_name,
                },
                data={"payslip_id": str(slip.pk), "run_id": str(run.pk)},
            )
        else:
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


@shared_task
def send_push(notification_id: str) -> int:
    """Push one inbox notification to all of the user's devices (FCM). Returns devices reached."""
    from . import push
    from .models import DeviceToken, Notification
    from .services import localized

    if not push.enabled():
        return 0
    n = Notification.objects.select_related("user").filter(pk=notification_id).first()
    if n is None:
        return 0
    title, body = localized(n)
    data = {"kind": n.kind, "notification_id": str(n.pk), **(n.data or {})}
    sent = 0
    for device in DeviceToken.objects.filter(user_id=n.user_id):
        result = push.send(device.token, title, body, data=data, link=n.link)
        if result == "sent":
            sent += 1
        elif result == "unregistered":
            device.delete()
    return sent


@shared_task
def send_delivery(delivery_id: str) -> str | None:
    from django.db import transaction

    from .delivery import deliver
    from .models import NotificationDelivery

    with transaction.atomic():
        d = (
            NotificationDelivery.objects.select_for_update(skip_locked=True)
            .select_related("notification__user")
            .filter(pk=delivery_id, status="queued")
            .first()
        )
        return deliver(d).status if d else None


@shared_task
def process_deliveries() -> int:
    """Beat (every 5 min): deliveries released from quiet hours or due for a retry."""
    from .delivery import process_due

    return process_due()
