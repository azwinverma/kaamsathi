from celery import shared_task


@shared_task
def purge_old_events():
    """Daily: drop raw product-analytics events older than TELEMETRY_RETENTION_DAYS (400)."""
    from .services import purge_old_events as purge

    return purge()
