import secrets
import uuid

from django.conf import settings
from django.db import models

SCOPES = [
    ("jobs.read", "Read job openings"),
    ("jobs.write", "Create job openings"),
    ("workforce.read", "Read employments"),
    ("attendance.read", "Read attendance"),
    ("attendance.write", "Record attendance"),
    ("payroll.read", "Read payroll runs and payslips"),
    ("timesheets.read", "Read timesheets"),
]
SCOPE_CODES = [code for code, _ in SCOPES]

EVENTS = [
    ("application.stage_changed", "Application stage changed"),
    ("employment.started", "Employment started"),
    ("employment.ended", "Employment ended"),
    ("payroll.run_approved", "Payroll run approved"),
    ("payroll.run_paid", "Payroll run paid"),
    ("timesheet.approved", "Timesheet approved"),
    ("dispute.raised", "Dispute raised"),
    ("support_case.updated", "Support case updated"),
]
EVENT_CODES = [code for code, _ in EVENTS]


def new_webhook_secret() -> str:
    return "whsec_" + secrets.token_urlsafe(32)


class OrgAPIKey(models.Model):
    """Enterprise API key: ``Authorization: Org ks_org_<prefix>_<secret>``; only a SHA-256 hash is kept."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("orgs.Organization", on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=100)
    prefix = models.CharField(max_length=8, unique=True)
    key_hash = models.CharField(max_length=64)
    scopes = models.JSONField(default=list)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "organization API key"

    def __str__(self):
        return f"{self.organization} · {self.name} ({self.prefix})"


class WebhookEndpoint(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("orgs.Organization", on_delete=models.CASCADE, related_name="webhooks")
    url = models.URLField(max_length=500)
    secret = models.CharField(max_length=80, default=new_webhook_secret)
    events = models.JSONField(default=list)  # empty = every event
    description = models.CharField(max_length=200, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.organization} → {self.url}"

    def wants(self, event: str) -> bool:
        return event == "ping" or not self.events or event in self.events


class WebhookDelivery(models.Model):
    STATUSES = [("pending", "Pending"), ("delivered", "Delivered"), ("failed", "Failed")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    endpoint = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name="deliveries")
    event = models.CharField(max_length=40)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=10, choices=STATUSES, default="pending", db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    last_error = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "webhook deliveries"

    def __str__(self):
        return f"{self.event} → {self.endpoint_id} [{self.status}]"
