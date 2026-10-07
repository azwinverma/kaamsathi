import logging

from celery import shared_task

logger = logging.getLogger("kaamsathi.trust")


@shared_task
def recompute_worker(worker_id: str):
    from apps.workers.models import Worker

    from .services import clear_scheduled, recompute_trust

    clear_scheduled(worker_id)  # later changes schedule a fresh run
    worker = Worker.objects.filter(pk=worker_id).first()
    if worker is None:
        return None
    trust = recompute_trust(worker)
    return trust.reliability_score


@shared_task
def recompute_all():
    """Nightly (beat 01:00): recompute every worker's level and reliability score."""
    from apps.workers.models import Worker

    from .services import recompute_trust

    done = 0
    for worker in Worker.objects.prefetch_related("skills").iterator(chunk_size=200):
        try:
            recompute_trust(worker)
            done += 1
        except Exception:  # noqa: BLE001 - one bad record must not stop the batch
            logger.exception("Trust recompute failed for worker %s", worker.pk)
    return done
