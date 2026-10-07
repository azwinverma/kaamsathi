import logging

from celery import shared_task

logger = logging.getLogger("kaamsathi.partners")


@shared_task
def expire_grants() -> int:
    """Hourly: mark lapsed consent grants expired and write the workers.Consent audit row."""
    from .services import expire_due_grants

    return expire_due_grants()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_referral_webhook(self, referral_id: str, event: str = "referral.created") -> bool:
    import requests
    from django.utils import timezone

    from apps.finance.models import Referral
    from apps.finance.services import referral_webhook_data

    from .services import send_webhook

    referral = (
        Referral.objects.select_related("partner", "offer", "worker", "grant").filter(pk=referral_id).first()
    )
    if referral is None or not referral.partner.webhook_url:
        return False
    try:
        ok = send_webhook(referral.partner, event, referral_webhook_data(referral))
    except requests.RequestException as exc:
        logger.warning("Partner webhook failed for referral %s: %s", referral_id, exc)
        ok = False
    if ok:
        Referral.objects.filter(pk=referral.pk).update(partner_notified_at=timezone.now())
        return True
    if self.request.called_directly or self.request.is_eager:
        return False
    raise self.retry()
