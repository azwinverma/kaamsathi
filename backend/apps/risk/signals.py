"""On-save detectors. A detector failure must never break the save that triggered it."""

import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger("kaamsathi.risk")

IDENTITY_FIELDS = {"citizenship_no", "nid_no", "citizenship_no_hash", "nid_no_hash"}


@receiver(post_save, sender="workers.Worker")
def worker_saved(sender, instance, created, update_fields=None, raw=False, **kwargs):
    if raw:  # loaddata
        return
    if not (instance.citizenship_no_hash or instance.nid_no_hash):
        return
    if not created and update_fields is not None and not IDENTITY_FIELDS & set(update_fields):
        return
    from .detectors import duplicate_identity

    try:
        with transaction.atomic():  # savepoint: a detector error leaves the caller's transaction usable
            duplicate_identity(instance)
    except Exception:  # noqa: BLE001
        logger.exception("Duplicate-identity check failed for worker %s", instance.pk)
