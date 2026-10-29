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


class StoredFile(models.Model):
    """An uploaded file kept in Postgres (``MEDIA_STORAGE=database``, ``apps/core/db_storage.py``).

    For hosting without a writable disk or object storage (Vercel free tier). Same names, same
    signed-URL access rules as disk/S3 storage; switch back by migrating rows to files.
    """

    name = models.CharField(max_length=500, primary_key=True)
    content = models.BinaryField()
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.size} bytes)"


class ScheduledJobRun(models.Model):
    """Last run of each ``CELERY_BEAT_SCHEDULE`` entry when the HTTP scheduler drives them
    (``apps/core/cron.py``, serverless hosting without ``celery beat``)."""

    name = models.CharField(max_length=100, primary_key=True)
    last_run_at = models.DateTimeField()
    last_status = models.CharField(max_length=20, blank=True, default="")

    def __str__(self):
        return f"{self.name} @ {self.last_run_at:%Y-%m-%d %H:%M}"


class DeferredTask(models.Model):
    """A Celery task queued with a future ``eta`` while tasks run inline (``SERVERLESS``).
    ``apps/core/cron.py`` runs it once it is due."""

    PENDING, RUNNING, DONE, FAILED = "pending", "running", "done", "failed"
    STATUSES = [(PENDING, "Pending"), (RUNNING, "Running"), (DONE, "Done"), (FAILED, "Failed")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task_name = models.CharField(max_length=200)
    args = models.JSONField(default=list, blank=True)
    kwargs = models.JSONField(default=dict, blank=True)
    run_at = models.DateTimeField()
    status = models.CharField(max_length=10, choices=STATUSES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["run_at"]
        indexes = [models.Index(fields=["status", "run_at"])]

    def __str__(self):
        return f"{self.task_name} at {self.run_at:%Y-%m-%d %H:%M} ({self.status})"


class FeatureFlag(models.Model):
    """Runtime feature flag (``apps/core/flags.py``). Overrides the matching settings boolean."""

    ROLLOUTS = [("all", "Everyone"), ("orgs", "Selected organizations"), ("percent", "Percentage of orgs")]

    key = models.SlugField(max_length=64, primary_key=True)
    description = models.CharField(max_length=255, blank=True, default="")
    enabled = models.BooleanField(default=False)
    rollout = models.CharField(max_length=10, choices=ROLLOUTS, default="all")
    org_ids = models.JSONField(default=list, blank=True)
    percent = models.PositiveSmallIntegerField(default=0)
    # Safe to expose to signed-in clients through GET /flags.
    client_visible = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return f"{self.key} [{'on' if self.enabled else 'off'}:{self.rollout}]"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        from .flags import invalidate

        invalidate()

    def delete(self, *args, **kwargs):
        out = super().delete(*args, **kwargs)
        from .flags import invalidate

        invalidate()
        return out
