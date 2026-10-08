import logging

from celery import shared_task

logger = logging.getLogger("kaamsathi.webhooks")


@shared_task
def deliver_webhook(delivery_id: str) -> str | None:
    """First attempt of a queued delivery (enqueued after commit by ``services.emit``)."""
    from .models import WebhookDelivery
    from .services import deliver

    d = WebhookDelivery.objects.select_related("endpoint").filter(pk=delivery_id).first()
    if d is None:
        return None
    return deliver(d).status


@shared_task
def retry_deliveries() -> int:
    """Beat (every 10 min): retry pending deliveries whose backoff has elapsed."""
    from .services import retry_due

    n = retry_due()
    if n:
        logger.info("integrations.retry_deliveries attempted=%s", n)
    return n
