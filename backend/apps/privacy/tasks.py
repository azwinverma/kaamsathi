import logging

from celery import shared_task

logger = logging.getLogger("kaamsathi.privacy")


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def generate_export(self, request_id: str):
    """Build the JSON + PDF bundle for an export request."""
    from .models import PrivacyRequest
    from .services import generate_export as build

    req = PrivacyRequest.objects.select_related("user", "worker").filter(pk=request_id).first()
    if req is None or req.kind != "export" or req.status not in ("received", "in_progress"):
        return None
    try:
        build(req)
    except Exception as exc:
        logger.exception("privacy export %s failed", request_id)
        raise self.retry(exc=exc) from exc
    return str(req.id)


@shared_task
def process_requests():
    """Daily: purge expired export files, apply retention to OTP/SMS logs, re-queue stuck exports."""
    import datetime as dt

    from django.utils import timezone

    from apps.notifications.services import enqueue

    from .models import PrivacyRequest
    from .services import purge_expired_exports, purge_stale_records

    purged = purge_expired_exports()
    stale = purge_stale_records()
    stuck = PrivacyRequest.objects.filter(
        kind="export", status="in_progress", updated_at__lt=timezone.now() - dt.timedelta(hours=6)
    )
    for req in stuck:
        enqueue(generate_export, str(req.id))
    result = {"exports_purged": purged, **stale, "exports_requeued": stuck.count()}
    logger.info("privacy retention run", extra={"result": result})
    return result
