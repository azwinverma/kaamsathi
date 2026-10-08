"""Metric hooks on other apps' models (no edits to their code)."""

from __future__ import annotations


def sms_saved(sender, instance, created, update_fields=None, **kwargs):
    if instance.status not in ("sent", "failed"):
        return
    if not created and update_fields is not None and "status" not in update_fields:
        return
    from . import metrics

    metrics.inc("sms_messages_total", backend=instance.backend or "unknown", status=instance.status)


def connect() -> None:
    from django.apps import apps
    from django.db.models.signals import post_save

    try:
        model = apps.get_model("notifications", "SMSMessage")
    except LookupError:
        return
    post_save.connect(sms_saved, sender=model, dispatch_uid="core.metrics.sms")
