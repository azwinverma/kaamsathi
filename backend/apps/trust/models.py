"""Trust layer: profile-view log, verification level + reliability score, disputes.

See docs/CONTRACT-ECOSYSTEM.md §1. The score shown to anyone is a *reliability score* — never a
credit score.
"""

import uuid

from django.conf import settings
from django.db import models

from apps.core.files import private_storage

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
    CLOSED = {"resolved", "rejected", "appealed", "appeal_resolved"}  # no first-instance resolve
    APPEALABLE = {"resolved", "rejected"}
    APPEAL_DAYS = 14

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
    # Bolau (docs/CONTRACT-BOLAU.md §4): kind=booking disputes point at the booking; ``worker`` is the Sipalu.
    booking = models.ForeignKey(
        "bolau.Booking", on_delete=models.SET_NULL, null=True, blank=True, related_name="disputes"
    )
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
    # Appeal (N008): once, within 14 days of the decision, by the worker or the employer; decided by a
    # different staff member than the first decision.
    APPEAL_OUTCOMES = labels.choices(labels.APPEAL_OUTCOME)
    appeal_reason = models.TextField(blank=True, null=True)
    appealed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    appealed_by_party = models.CharField(max_length=10, blank=True, null=True)  # worker|employer|ghardhani
    appealed_at = models.DateTimeField(null=True, blank=True)
    appeal_outcome = models.CharField(max_length=12, choices=APPEAL_OUTCOMES, blank=True, null=True)
    appeal_resolution_note = models.TextField(blank=True, null=True)
    appeal_resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    appeal_resolved_at = models.DateTimeField(null=True, blank=True)

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
        if self.status == "appealed":
            return (self.appealed_at or timezone.now()) + dt.timedelta(days=self.SLA_DAYS)
        return None

    def _phase(self):
        return self.status if self.status in ("open", "employer_responded", "appealed") else None

    def appeal_deadline(self):
        import datetime as dt

        if self.status not in self.APPEALABLE or not self.resolved_at:
            return None
        return self.resolved_at + dt.timedelta(days=self.APPEAL_DAYS)

    def can_appeal(self) -> bool:
        from django.utils import timezone

        deadline = self.appeal_deadline()
        return bool(deadline and self.appealed_at is None and timezone.now() <= deadline)

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        if "status" in field_names:  # never trigger a deferred-field load from here
            instance._sla_phase = instance._phase()
        return instance


class DisputeEvidence(models.Model):
    """A photo or PDF attached to a dispute (N006). Private storage, served by signed URL only."""

    PARTIES = labels.choices(labels.EVIDENCE_PARTY)
    MAX_PER_DISPUTE = 10

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dispute = models.ForeignKey(Dispute, on_delete=models.CASCADE, related_name="evidence")
    file = models.FileField(upload_to="dispute-evidence/", storage=private_storage)
    file_type = models.CharField(max_length=8, default="image")  # image | pdf
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    party = models.CharField(max_length=10, choices=PARTIES)
    note = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name_plural = "dispute evidence"

    def __str__(self):
        return f"evidence {self.pk} for dispute {self.dispute_id}"
