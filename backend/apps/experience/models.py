"""External (off-platform) work history with reference checks (docs/CONTRACT-EXTENSIONS.md §3)."""

import uuid

from django.conf import settings
from django.db import models

from apps.core import labels as core_labels
from apps.core.crypto import EncryptedCharField
from apps.core.files import private_storage

from . import labels


class WorkHistoryEntry(models.Model):
    STATUSES = core_labels.choices(labels.STATUS)
    METHODS = core_labels.choices(labels.METHOD)
    OPEN = ("self_reported", "reference_pending")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="work_history")
    employer_name = models.CharField(max_length=200)
    employer_org = models.ForeignKey(
        "orgs.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_history_claims",
    )
    trade = models.ForeignKey(
        "workers.Trade", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    role_title = models.CharField(max_length=120)
    district = models.ForeignKey(
        "geo.District", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True, default="")
    reference_name = models.CharField(max_length=120, blank=True, null=True)
    reference_phone = EncryptedCharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUSES, default="self_reported")
    verification_method = models.CharField(max_length=20, choices=METHODS, blank=True, null=True)
    document = models.FileField(upload_to="work-history/", storage=private_storage, blank=True, null=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]
        verbose_name = "work history entry"
        verbose_name_plural = "work history entries"
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return f"{self.role_title} at {self.employer_name} — {self.worker} [{self.status}]"

    @property
    def months(self) -> int:
        from apps.core.bs import today_ad

        end = self.end_date or today_ad()
        return max((end - self.start_date).days // 30, 0) if end >= self.start_date else 0
