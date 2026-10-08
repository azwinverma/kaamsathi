"""Job alerts fire when a job becomes ``open`` (published by an employer, ops or the enterprise API)."""

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


@receiver(pre_save, sender="hiring.JobOpening", dispatch_uid="hiring.job_status_before")
def remember_status(sender, instance, **kwargs):
    if instance._state.adding:
        instance._ks_old_status = None
    else:
        instance._ks_old_status = (
            sender.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
        )


@receiver(post_save, sender="hiring.JobOpening", dispatch_uid="hiring.job_published_alerts")
def job_published(sender, instance, **kwargs):
    if instance.status != "open" or getattr(instance, "_ks_old_status", None) == "open":
        return
    job_id = instance.pk

    def _send():
        import logging

        from .services import notify_instant_alerts

        try:
            notify_instant_alerts(job_id)
        except Exception:  # noqa: BLE001 - alerts must never break publishing
            logging.getLogger("kaamsathi.hiring").exception("job alerts for %s failed", job_id)

    transaction.on_commit(_send)
