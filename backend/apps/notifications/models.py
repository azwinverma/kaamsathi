import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class SMSMessage(models.Model):
    """Outbound SMS log (all backends)."""

    STATUSES = [("queued", "Queued"), ("sent", "Sent"), ("failed", "Failed")]

    phone = models.CharField(max_length=15, db_index=True)
    body = models.TextField()
    kind = models.CharField(max_length=30, default="generic")
    backend = models.CharField(max_length=20)
    status = models.CharField(max_length=10, choices=STATUSES, default="queued")
    provider_response = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "SMS message"

    def __str__(self):
        return f"{self.phone} {self.kind} [{self.status}]"


class Notification(models.Model):
    """In-app inbox row (docs/CONTRACT-EXTENSIONS.md §4). Created by ``services.notify``."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=40, db_index=True)
    title = models.CharField(max_length=200)
    title_ne = models.CharField(max_length=200, blank=True, null=True)
    body = models.TextField(blank=True, default="")
    body_ne = models.TextField(blank=True, null=True)
    data = models.JSONField(default=dict, blank=True)
    link = models.CharField(max_length=500, blank=True, null=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "read_at"], name="notif_user_read_idx")]

    def __str__(self):
        return f"{self.user_id} {self.kind}: {self.title}"


class DeviceToken(models.Model):
    """Push token (FCM) registered by a client app."""

    PLATFORMS = [("android", "Android"), ("ios", "iOS"), ("web", "Web")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="device_tokens")
    platform = models.CharField(max_length=10, choices=PLATFORMS)
    token = models.CharField(max_length=512, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-last_seen_at"]

    def __str__(self):
        return f"{self.user_id} {self.platform}"


CHANNELS = [("inapp", "In-app"), ("sms", "SMS"), ("push", "Push"), ("email", "Email")]
LANGUAGES = [("en", "English"), ("ne", "Nepali")]


class NotificationTemplate(models.Model):
    """Versioned message wording per (key, channel, language). The newest active version is used."""

    key = models.CharField(max_length=60, db_index=True)
    channel = models.CharField(max_length=6, choices=CHANNELS)
    language = models.CharField(max_length=2, choices=LANGUAGES)
    version = models.PositiveIntegerField(default=1)
    subject = models.CharField(max_length=200, blank=True, default="")
    body = models.TextField()
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key", "channel", "language", "-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["key", "channel", "language", "version"], name="uniq_notification_template_version"
            )
        ]

    def __str__(self):
        return f"{self.key}/{self.channel}/{self.language} v{self.version}"


class NotificationDelivery(models.Model):
    """One channel attempt-chain for a notification (inapp row, SMS, push or email)."""

    STATUSES = [("queued", "Queued"), ("sent", "Sent"), ("failed", "Failed"), ("skipped", "Skipped")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name="deliveries")
    channel = models.CharField(max_length=6, choices=CHANNELS)
    status = models.CharField(max_length=8, choices=STATUSES, default="queued", db_index=True)
    # Rendered content for this channel (SMS text / email subject+body / push title+body).
    subject = models.CharField(max_length=200, blank=True, default="")
    body = models.TextField(blank=True, default="")
    provider_ref = models.CharField(max_length=200, blank=True, null=True)
    error = models.TextField(blank=True, null=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "notification deliveries"

    def __str__(self):
        return f"{self.notification_id} {self.channel} [{self.status}]"


class NotificationPreference(models.Model):
    FREQUENCIES = [("instant", "Instant"), ("daily", "Daily"), ("weekly", "Weekly"), ("off", "Off")]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preference"
    )
    sms_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
    marketing_opt_in = models.BooleanField(default=False)
    job_alert_frequency = models.CharField(max_length=8, choices=FREQUENCIES, default="instant")
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Notification preferences · {self.user_id}"
