"""Privacy requests (Individual Privacy Act 2075): export, correction, deletion."""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core import labels
from apps.core.files import private_storage

KIND = {
    "export": _("Copy of my data"),
    "correction": _("Correct my data"),
    "deletion": _("Delete my data"),
}
STATUS = {
    "received": _("Received"),
    "in_progress": _("In progress"),
    "completed": _("Completed"),
    "rejected": _("Rejected"),
}
OPEN_STATUSES = ("received", "in_progress")


class PrivacyRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey(
        "workers.Worker", on_delete=models.SET_NULL, null=True, blank=True, related_name="privacy_requests"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="privacy_requests",
    )
    kind = models.CharField(max_length=12, choices=labels.choices(KIND))
    status = models.CharField(
        max_length=12, choices=labels.choices(STATUS), default="received", db_index=True
    )
    details = models.TextField(blank=True, null=True)
    response_note = models.TextField(blank=True, null=True)
    # Export bundle (zip: JSON + PDF) on PRIVATE storage; purged after PRIVACY_EXPORT_TTL_HOURS.
    file = models.FileField(upload_to="privacy-exports/", storage=private_storage, blank=True, null=True)
    file_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind} · {self.status} · {self.created_at:%Y-%m-%d}"

    @property
    def is_open(self) -> bool:
        return self.status in OPEN_STATUSES

    @property
    def file_available(self) -> bool:
        return bool(self.file) and (self.file_expires_at is None or self.file_expires_at > timezone.now())
