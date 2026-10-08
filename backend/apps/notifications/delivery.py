"""Sends one NotificationDelivery over its channel, with retries (1 m, 5 m, 30 m) for sms/push/email."""

from __future__ import annotations

import datetime as dt
import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import DeviceToken, NotificationDelivery, SMSMessage

logger = logging.getLogger("kaamsathi.notifications")

RETRY = (dt.timedelta(minutes=1), dt.timedelta(minutes=5), dt.timedelta(minutes=30))
MAX_ATTEMPTS = 1 + len(RETRY)


def _send_sms(d: NotificationDelivery) -> tuple[str, str | None, str | None]:
    from .sms import get_backend

    backend = get_backend()
    user = d.notification.user
    msg = SMSMessage.objects.create(
        phone=user.phone, body=d.body, kind=d.notification.kind, backend=backend.name
    )
    result = backend.send(user.phone, d.body)
    msg.status = "sent" if result.ok else "failed"
    msg.provider_response = result.response
    msg.save(update_fields=["status", "provider_response"])
    return ("sent", f"sms:{msg.pk}", None) if result.ok else ("failed", f"sms:{msg.pk}", result.response)


def _send_push(d: NotificationDelivery) -> tuple[str, str | None, str | None]:
    from . import push

    n = d.notification
    devices = list(DeviceToken.objects.filter(user_id=n.user_id))
    if not push.enabled() or not devices:
        return "skipped", None, "push disabled or no devices"
    data = {"kind": n.kind, "notification_id": str(n.pk), **(n.data or {})}
    results = []
    for device in devices:
        r = push.send(device.token, d.subject, d.body, data=data, link=n.link)
        if r == "unregistered":
            device.delete()
        results.append(r)
    sent = results.count("sent")
    if sent:
        return "sent", f"devices:{sent}", None
    if all(r == "unregistered" for r in results):
        return "skipped", None, "all device tokens unregistered"
    return "failed", None, "push failed for every device"


def _send_email(d: NotificationDelivery) -> tuple[str, str | None, str | None]:
    from django.core.mail import send_mail

    user = d.notification.user
    if not user.email:
        return "skipped", None, "no email address"
    try:
        send_mail(d.subject or d.notification.title, d.body, settings.DEFAULT_FROM_EMAIL, [user.email])
    except Exception as exc:  # noqa: BLE001 - SMTP errors vary by backend
        return "failed", None, str(exc)[:500]
    return "sent", "email", None


SENDERS = {"sms": _send_sms, "push": _send_push, "email": _send_email}


def deliver(d: NotificationDelivery) -> NotificationDelivery:
    if d.status != "queued":
        return d
    sender = SENDERS.get(d.channel)
    d.attempts += 1
    if sender is None:
        status, ref, error = "sent", None, None
    else:
        try:
            status, ref, error = sender(d)
        except Exception as exc:  # noqa: BLE001 - never let one channel break the others
            logger.exception("Delivery %s failed", d.pk)
            status, ref, error = "failed", None, str(exc)[:500]
    d.provider_ref, d.error = ref, error
    if status == "failed" and d.attempts < MAX_ATTEMPTS:
        d.status = "queued"
        d.next_attempt_at = timezone.now() + RETRY[d.attempts - 1]
    else:
        d.status = status
        d.next_attempt_at = None
    d.save(update_fields=["status", "attempts", "provider_ref", "error", "next_attempt_at", "updated_at"])
    return d


def process_due(now=None, limit: int = 500) -> int:
    now = now or timezone.now()
    ids = list(
        NotificationDelivery.objects.filter(status="queued", next_attempt_at__lte=now)
        .order_by("next_attempt_at")
        .values_list("pk", flat=True)[:limit]
    )
    done = 0
    for pk in ids:
        with transaction.atomic():
            d = (
                NotificationDelivery.objects.select_for_update(skip_locked=True)
                .select_related("notification__user")
                .filter(pk=pk, status="queued")
                .first()
            )
            if d is not None:
                deliver(d)
                done += 1
    return done
