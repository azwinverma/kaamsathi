from django.db import models


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
