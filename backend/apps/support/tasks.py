import logging

from celery import shared_task

logger = logging.getLogger("kaamsathi.support")


@shared_task
def escalate_overdue():
    """Every 30 min: flag support cases and disputes past their SLA and notify support staff."""
    from .services import escalate_overdue as run

    result = run()
    if result["cases"] or result["disputes"]:
        logger.info("Escalated %s", result)
    return result
