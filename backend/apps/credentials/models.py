"""Credentials, skill assessments and the Skill Passport (docs/CONTRACT-ECOSYSTEM.md §3)."""

import secrets
import string
import uuid

from django.conf import settings
from django.db import models

from apps.core import labels as core_labels
from apps.core.files import private_storage

from . import labels

PUBLIC_CODE_ALPHABET = string.ascii_lowercase + string.digits
PUBLIC_CODE_LENGTH = 10
SHARE_MAX_DAYS = 90


def generate_public_code() -> str:
    return "".join(secrets.choice(PUBLIC_CODE_ALPHABET) for _ in range(PUBLIC_CODE_LENGTH))


def generate_share_token() -> str:
    # 24 random bytes → exactly 32 URL-safe characters.
    return secrets.token_urlsafe(24)


class Credential(models.Model):
    KINDS = core_labels.choices(labels.KIND)
    STATUSES = core_labels.choices(labels.STATUS)
    METHODS = core_labels.choices(labels.METHOD)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="credentials")
    kind = models.CharField(max_length=20, choices=KINDS)
    title = models.CharField(max_length=200)
    issuer = models.CharField(max_length=200)
    certificate_no = models.CharField(max_length=80, blank=True, null=True)
    level = models.CharField(max_length=40, blank=True, null=True)
    issued_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    document = models.FileField(upload_to="credentials/", storage=private_storage, blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="pending")
    verification_method = models.CharField(max_length=20, choices=METHODS, blank=True, null=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # G012: a rejected credential re-uploaded by the worker links back to the rejected record.
    resubmission_of = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="resubmissions"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "expires_on"])]

    def __str__(self):
        return f"{self.title} — {self.worker.full_name} [{self.status}]"


class SkillAssessment(models.Model):
    RESULTS = core_labels.choices(labels.RESULT)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="assessments")
    trade = models.ForeignKey("workers.Trade", on_delete=models.PROTECT, related_name="+")
    assessor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    assessor_partner = models.ForeignKey(
        "partners.Partner", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    assessed_on = models.DateField()
    result = models.CharField(max_length=4, choices=RESULTS)
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    level = models.CharField(max_length=40, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-assessed_on", "-created_at"]

    def __str__(self):
        return f"{self.worker.full_name} · {self.trade_id} · {self.result}"


class Passport(models.Model):
    worker = models.OneToOneField(
        "workers.Worker", on_delete=models.CASCADE, primary_key=True, related_name="passport"
    )
    public_code = models.CharField(max_length=PUBLIC_CODE_LENGTH, unique=True, default=generate_public_code)
    is_public = models.BooleanField(default=False)
    show_contact = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Passport {self.public_code} ({self.worker.full_name})"


class PassportShare(models.Model):
    PURPOSES = core_labels.choices(labels.SHARE_PURPOSE)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="passport_shares")
    token = models.CharField(max_length=32, unique=True, default=generate_share_token)
    audience_label = models.CharField(max_length=120)
    purpose = models.CharField(max_length=20, choices=PURPOSES, default="job")
    expires_at = models.DateTimeField()
    include_contact = models.BooleanField(default=False)
    views = models.PositiveIntegerField(default=0)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Share {self.audience_label} ({self.worker.full_name})"
