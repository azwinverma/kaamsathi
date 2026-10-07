"""Recompute triggers (debounced via Celery): attendance, ratings, employment changes, verification."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .services import schedule_recompute

WORKER_TRUST_FIELDS = {"verification_status", "user"}


def _worker_of_employment(employment_id, instance=None):
    emp = getattr(instance, "_state", None) and instance._state.fields_cache.get("employment")
    if emp is not None:
        return emp.worker_id
    from apps.workforce.models import Employment

    return Employment.objects.filter(pk=employment_id).values_list("worker_id", flat=True).first()


@receiver([post_save, post_delete], sender="workforce.Attendance")
def attendance_changed(sender, instance, **kwargs):
    schedule_recompute(_worker_of_employment(instance.employment_id, instance))


@receiver([post_save, post_delete], sender="workers.Rating")
def rating_changed(sender, instance, **kwargs):
    if instance.rater == "employer":  # worker→employer ratings feed employer reputation only
        schedule_recompute(_worker_of_employment(instance.employment_id, instance))


@receiver(post_save, sender="workforce.Employment")
def employment_changed(sender, instance, created, update_fields=None, **kwargs):
    if created or update_fields is None or {"status", "end_date", "end_reason"} & set(update_fields):
        schedule_recompute(instance.worker_id)


@receiver(post_save, sender="workers.Worker")
def worker_changed(sender, instance, created, update_fields=None, **kwargs):
    if created or update_fields is None or WORKER_TRUST_FIELDS & set(update_fields):
        schedule_recompute(instance.pk)


@receiver([post_save, post_delete], sender="workers.WorkerSkill")
def skill_changed(sender, instance, **kwargs):
    schedule_recompute(instance.worker_id)
