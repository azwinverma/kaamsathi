"""Help desk: support cases with a message thread (internal notes visible to staff only)."""

import datetime as dt
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from . import labels

SLA_HOURS = {"urgent": 4, "high": 24, "normal": 72, "low": 7 * 24}
IDENTITY_CHECK_VALID_MINUTES = 15


def sla_due(created_at, priority: str):
    return (created_at or timezone.now()) + dt.timedelta(hours=SLA_HOURS.get(priority, SLA_HOURS["normal"]))


def format_number(seq: int) -> str:
    return f"KS-{seq:06d}"


class SupportCase(models.Model):
    CHANNELS = labels.choices(labels.CHANNEL)
    CATEGORIES = labels.choices(labels.CATEGORY)
    PRIORITIES = labels.choices(labels.PRIORITY)
    STATUSES = labels.choices(labels.STATUS)
    ACTIVE = {"open", "pending_user"}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seq = models.PositiveIntegerField(unique=True, editable=False)
    number = models.CharField(max_length=16, unique=True, editable=False)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="support_cases"
    )
    worker = models.ForeignKey(
        "workers.Worker", on_delete=models.SET_NULL, null=True, blank=True, related_name="support_cases"
    )
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.CASCADE, null=True, blank=True, related_name="support_cases"
    )
    channel = models.CharField(max_length=8, choices=CHANNELS, default="app")
    category = models.CharField(max_length=12, choices=CATEGORIES, default="other")
    subject = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(max_length=8, choices=PRIORITIES, default="normal")
    status = models.CharField(max_length=14, choices=STATUSES, default="open", db_index=True)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    sla_due_at = models.DateTimeField(db_index=True)
    first_response_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    escalated = models.BooleanField(default=False)
    # Safety incidents (TRUST-04): never visible to the employer unless ops shares the case;
    # ``anonymous`` hides the reporter's identity even then.
    safety_kind = models.CharField(
        max_length=20, choices=labels.choices(labels.SAFETY_KIND), blank=True, null=True
    )
    confidential = models.BooleanField(default=False)
    anonymous = models.BooleanField(default=False)
    emergency = models.BooleanField(default=False)
    shared_with_org = models.BooleanField(default=False)
    dispute = models.ForeignKey(
        "trust.Dispute", on_delete=models.SET_NULL, null=True, blank=True, related_name="support_cases"
    )
    risk_flag = models.ForeignKey(
        "risk.FraudFlag", on_delete=models.SET_NULL, null=True, blank=True, related_name="support_cases"
    )
    # Contact-center identity check (SUPPORT-03): required within 15 minutes before ops change a
    # worker's phone or payment details through this case.
    identity_verified_at = models.DateTimeField(null=True, blank=True)
    identity_method = models.CharField(
        max_length=20, choices=labels.choices(labels.IDENTITY_METHOD), blank=True, null=True
    )
    identity_checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.number} {self.subject} [{self.status}]"

    @property
    def identity_verified(self) -> bool:
        return (
            self.identity_verified_at is not None
            and self.identity_verified_at
            >= timezone.now() - dt.timedelta(minutes=IDENTITY_CHECK_VALID_MINUTES)
        )

    @property
    def is_overdue(self) -> bool:
        return self.status == "open" and self.sla_due_at is not None and self.sla_due_at < timezone.now()


class CaseMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(SupportCase, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    body = models.TextField()
    internal = models.BooleanField(default=False)
    from_staff = models.BooleanField(default=False)
    # "phone" marks a call note taken by the contact center (always internal).
    channel = models.CharField(max_length=8, choices=labels.choices(labels.CHANNEL), default="app")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.case_id} {'note' if self.internal else 'message'} by {self.author_id}"


class HelpArticle(models.Model):
    """Bilingual help-center article (markdown bodies). Public when published."""

    AUDIENCES = labels.choices(labels.HELP_AUDIENCE)
    CATEGORIES = labels.choices(labels.HELP_CATEGORY)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=80, unique=True)
    audience = models.CharField(max_length=10, choices=AUDIENCES, default="all", db_index=True)
    category = models.CharField(max_length=20, choices=CATEGORIES, default="getting_started")
    title_en = models.CharField(max_length=200)
    title_ne = models.CharField(max_length=200, blank=True, default="")
    body_en = models.TextField()
    body_ne = models.TextField(blank=True, default="")
    is_published = models.BooleanField(default=False, db_index=True)
    order = models.PositiveSmallIntegerField(default=100)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "title_en"]

    def __str__(self):
        return self.slug
