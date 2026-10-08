"""Foreign-employment document wallet (docs/CONTRACT-EXTENSIONS.md §5).

Strategy rule: KaamSathi never recruits or matches for jobs abroad. A worker keeps verified
documents here and may share their *verification status* with a DoFE-licensed agency they choose
(``partners.ConsentGrant`` purpose=recruitment). Numbers are encrypted at rest with a blind index
for duplicate detection; files live in private storage behind short-lived signed URLs.
"""

import uuid

from django.conf import settings
from django.db import models

from apps.core import labels as core_labels
from apps.core.crypto import EncryptedCharField, blind_index
from apps.core.files import private_storage

from . import labels

STATUSES = core_labels.choices(labels.STATUS)


class _MobilityDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    issued_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    document = models.FileField(upload_to="mobility/", storage=private_storage, blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="pending")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    KIND_GROUP = ""

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class TravelDocument(_MobilityDocument):
    KINDS = core_labels.choices(labels.TRAVEL_KIND)
    KIND_GROUP = "travel"

    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="travel_documents")
    kind = models.CharField(max_length=20, choices=KINDS)
    number = EncryptedCharField(max_length=40)
    number_hash = models.CharField(max_length=64, blank=True, null=True, db_index=True, editable=False)
    issuing_country = models.CharField(max_length=2, default="NP")

    class Meta(_MobilityDocument.Meta):
        indexes = [models.Index(fields=["status", "expires_on"])]

    def __str__(self):
        return f"{self.kind} — {self.worker.full_name} [{self.status}]"

    def save(self, *args, **kwargs):
        self.number_hash = blind_index(self.number, f"travel:{self.kind}")
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "number" in update_fields:
            kwargs["update_fields"] = {*update_fields, "number_hash"}
        super().save(*args, **kwargs)

    @property
    def title(self) -> str:
        return str(labels.TRAVEL_KIND.get(self.kind, self.kind))


class ClearanceDocument(_MobilityDocument):
    KINDS = core_labels.choices(labels.CLEARANCE_KIND)
    KIND_GROUP = "clearance"

    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="clearance_documents")
    kind = models.CharField(max_length=30, choices=KINDS)
    title = models.CharField(max_length=200)
    issuer = models.CharField(max_length=200)
    reference_no = EncryptedCharField(max_length=60, blank=True, null=True)
    reference_no_hash = models.CharField(max_length=64, blank=True, null=True, db_index=True, editable=False)
    score_or_level = models.CharField(max_length=40, blank=True, null=True)

    class Meta(_MobilityDocument.Meta):
        indexes = [models.Index(fields=["status", "expires_on"])]

    def __str__(self):
        return f"{self.kind} — {self.worker.full_name} [{self.status}]"

    def save(self, *args, **kwargs):
        self.reference_no_hash = blind_index(self.reference_no, f"clearance:{self.kind}")
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "reference_no" in update_fields:
            kwargs["update_fields"] = {*update_fields, "reference_no_hash"}
        super().save(*args, **kwargs)
