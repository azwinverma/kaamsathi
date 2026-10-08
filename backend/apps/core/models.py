"""Platform models: idempotency records and failed Celery tasks."""

import uuid

from django.conf import settings
from django.db import models


class IdempotencyRecord(models.Model):
    """Stored response for an ``Idempotency-Key`` (``apps/core/idempotency.py``)."""

    id = models.BigAutoField(primary_key=True)
    # "user:<uuid>" / "partner:<uuid>" / "org-key:<uuid>" / "anon:<ip>"
    principal = models.CharField(max_length=80)
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=300)
    key = models.CharField(max_length=100)
    body_hash = models.CharField(max_length=64)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)  # null = in progress
    response_body = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["principal", "method", "path", "key"], name="core_idempotency_unique"
            )
        ]

    def __str__(self):
        return f"{self.method} {self.path} [{self.key}]"


class FailedTask(models.Model):
    """A Celery task that exhausted its retries (``apps/core/tasks.ReliableTask``)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task_name = models.CharField(max_length=200, db_index=True)
    task_id = models.CharField(max_length=100, blank=True, default="")
    args_redacted = models.JSONField(default=dict, blank=True)
    exception = models.TextField(blank=True, default="")
    traceback = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    retried_at = models.DateTimeField(null=True, blank=True)
    retried_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    dismissed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.task_name} @ {self.created_at:%Y-%m-%d %H:%M}"
