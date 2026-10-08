"""Scheduled hiring jobs (beat entries in config/settings/base.py)."""

from celery import shared_task


@shared_task(name="apps.hiring.tasks.job_alert_digest")
def job_alert_digest(frequency: str) -> int:
    from .services import send_alert_digests

    return send_alert_digests(frequency)
