import logging

from celery import shared_task

logger = logging.getLogger("kaamsathi.risk")


@shared_task
def scan():
    """Nightly (beat 04:00): run every batch detector; returns {detector: flags raised/refreshed}."""
    from .detectors import run_all

    results = run_all()
    logger.info("Risk scan finished: %s", results)
    return results
