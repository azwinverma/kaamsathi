"""Enqueue Celery tasks safely (after commit; fall back to inline if broker is down)."""

import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("kaamsathi.notifications")


def enqueue(task, *args, eta=None, **kwargs):
    # Eager mode (dev/tests) can't defer, so a future reminder would go out immediately.
    if eta is not None and settings.CELERY_TASK_ALWAYS_EAGER and eta > timezone.now():
        logger.info("Eager Celery: skipping %s scheduled for %s", task.name, eta)
        return

    def _send():
        try:
            if eta is not None:
                task.apply_async(args=args, kwargs=kwargs, eta=eta)
            else:
                task.apply_async(args=args, kwargs=kwargs)
        except Exception as exc:  # broker unavailable → run inline (dev convenience)
            logger.warning("Celery unavailable (%s); running %s inline", exc, task.name)
            if eta is None:
                try:
                    task.apply(args=args, kwargs=kwargs)
                except Exception:  # noqa: BLE001
                    logger.exception("Inline task %s failed", task.name)

    transaction.on_commit(_send)


def send_sms(phone: str, body: str, kind: str = "generic", log_body=None):
    from .tasks import send_sms as task

    enqueue(task, phone, body, kind=kind, log_body=log_body)
