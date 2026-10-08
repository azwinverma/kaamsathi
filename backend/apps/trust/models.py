"""Trust layer: profile-view log, verification level + reliability score, disputes.

See docs/CONTRACT-ECOSYSTEM.md §1. The score shown to anyone is a *reliability score* — never a
credit score.
"""

import uuid

from django.conf import settings
from django.db import models

from . import labels


class ProfileView(models.Model):
    """Every time someone outside the worker sees their full profile (unmasked phone, history)."""

    CONTEXTS = labels.choices(labels.VIEW_CONTEXT)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="profile_views")
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    partner = models.ForeignKey(
        "partners.Partner", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    context = models.CharField(max_length=12, choices=CONTEXTS)
    object_id = models.CharField(max_length=64, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["worker", "-created_at"], name="trust_view_worker_idx")]

    def __str__(self):
        return f"{self.worker_id} viewed ({self.context}) at {self.created_at:%Y-%m-%d %H:%M}"


class WorkerTrust(models.Model):
    """Cached verification level (0–5) and reliability score (0–100, null without employment)."""

    worker = models.OneToOneField(
        "workers.Worker", on_delete=models.CASCADE, primary_key=True, related_name="trust"
    )
    verification_level = models.PositiveSmallIntegerField(default=0)
    reliability_score = models.PositiveSmallIntegerField(null=True, blank=True)
    breakdown = models.JSONField(default=dict, blank=True)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "worker trust"
        verbose_name_plural = "worker trust"

    def __str__(self):
        return f"{self.worker_id}: L{self.verification_level} / {self.reliability_score}"


class Dispute(models.Model):
    KINDS = labels.choices(labels.DISPUTE_KIND)
    STATUSES = labels.choices(labels.DISPUTE_STATUS)
    CLOSED = {"resolved", "rejected"}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="disputes")
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.CASCADE, null=True, blank=True, related_name="disputes"
    )
    employment = models.ForeignKey(
        "workforce.Employment", on_delete=models.SET_NULL, null=True, blank=True, related_name="disputes"
    )
    payslip = models.ForeignKey(
        "payroll.Payslip", on_delete=models.SET_NULL, null=True, blank=True, related_name="disputes"
    )
    attendance_date = models.DateField(null=True, blank=True)
    kind = models.CharField(max_length=20, choices=KINDS)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUSES, default="open", db_index=True)
    employer_note = models.TextField(blank=True, null=True)
    resolution_note = models.TextField(blank=True, null=True)
    raised_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    # SLA (docs/CONTRACT-EXTENSIONS.md §2): open → employer has 7 days to respond;
    # employer_responded → ops has 7 days to decide. Escalated once by apps.support.tasks.
    sla_due_at = models.DateTimeField(null=True, blank=True, db_index=True)
    escalated = models.BooleanField(default=False)

    SLA_DAYS = 7

    class Meta:
        ordering = ["-raised_at"]

    def __str__(self):
        return f"{self.kind} dispute by {self.worker_id} [{self.status}]"

    def save(self, *args, **kwargs):
        # Recompute the SLA only when the dispute enters a new phase (not on every save).
        phase = self._phase()
        if phase != getattr(self, "_sla_phase", "new") or (phase and self.sla_due_at is None):
            self.sla_due_at = self.compute_sla_due_at()
            self.escalated = False  # a new SLA window starts fresh
            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                kwargs["update_fields"] = set(update_fields) | {"sla_due_at", "escalated"}
        super().save(*args, **kwargs)
        self._sla_phase = phase

    def compute_sla_due_at(self):
        import datetime as dt

        from django.utils import timezone

        if self.status == "open":
            return (self.raised_at or timezone.now()) + dt.timedelta(days=self.SLA_DAYS)
        if self.status == "employer_responded":
            return (self.responded_at or timezone.now()) + dt.timedelta(days=self.SLA_DAYS)
        return None

    def _phase(self):
        return self.status if self.status in ("open", "employer_responded") else None

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        if "status" in field_names:  # never trigger a deferred-field load from here
            instance._sla_phase = instance._phase()
        return instance
