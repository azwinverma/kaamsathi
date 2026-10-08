"""Fraud / risk flags raised by detectors (on-save + nightly scan) or by ops staff.

See docs/CONTRACT-EXTENSIONS.md §2. A flag is a prompt for a human to look, never an automatic
verdict: nothing is blocked or changed because a flag exists.
"""

import uuid

from django.conf import settings
from django.db import models

from . import labels


class FraudFlag(models.Model):
    SUBJECT_TYPES = labels.choices(labels.SUBJECT_TYPE)
    KINDS = labels.choices(labels.KIND)
    SEVERITIES = labels.choices(labels.SEVERITY)
    STATUSES = labels.choices(labels.STATUS)
    SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_type = models.CharField(max_length=20, choices=SUBJECT_TYPES)
    subject_id = models.CharField(max_length=64)
    kind = models.CharField(max_length=24, choices=KINDS)
    severity = models.CharField(max_length=8, choices=SEVERITIES, default="medium")
    details = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="open", db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["subject_type", "subject_id"], name="risk_flag_subject_idx")]
        constraints = [
            # flag() is idempotent per open (subject, kind); the DB enforces it too. Staff may raise
            # several manual flags on one record.
            models.UniqueConstraint(
                fields=["subject_type", "subject_id", "kind"],
                condition=models.Q(status="open") & ~models.Q(kind="manual"),
                name="risk_one_open_flag_per_subject_kind",
            )
        ]

    def __str__(self):
        return f"{self.kind} on {self.subject_type}:{self.subject_id} [{self.status}]"


class VerificationReview(models.Model):
    """One ops decision on a worker's KYC (four-eyes, ``kyc_four_eyes`` flag).

    With four-eyes on, the first "verified" decision is stored with ``stage="first"`` and the worker
    stays ``pending``; a second, different verifier's "verified" (``stage="final"``) finalises it.
    Every decision is kept so the audit trail shows both reviewers.
    """

    DECISIONS = [("verified", "Verified"), ("rejected", "Rejected")]
    STAGES = [("first", "First review"), ("final", "Final review")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="verification_reviews")
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decision = models.CharField(max_length=10, choices=DECISIONS)
    stage = models.CharField(max_length=6, choices=STAGES, default="final")
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.worker_id} {self.stage}:{self.decision}"
