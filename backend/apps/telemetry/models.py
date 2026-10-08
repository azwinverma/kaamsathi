"""First-party product analytics events (no third-party trackers, no PII — see ``schema.py``)."""

from django.conf import settings
from django.db import models


class Event(models.Model):
    PLATFORMS = [("web", "Web"), ("android", "Android"), ("ios", "iOS"), ("server", "Server")]

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=64)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    anonymous_id = models.CharField(max_length=64, blank=True, default="")
    # Pseudonymous funnel key, e.g. "worker:<uuid>", "user:<id>", "anon:<anonymous_id>".
    subject = models.CharField(max_length=80, blank=True, default="")
    platform = models.CharField(max_length=8, choices=PLATFORMS, default="server")
    properties = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["name", "occurred_at"], name="telemetry_name_time"),
            models.Index(fields=["occurred_at"], name="telemetry_time"),
            models.Index(fields=["received_at"], name="telemetry_received"),
            models.Index(fields=["subject", "name"], name="telemetry_subject_name"),
        ]

    def __str__(self):
        return f"{self.name} @ {self.occurred_at:%Y-%m-%d %H:%M}"
