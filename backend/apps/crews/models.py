"""Naike (team lead) crews and referral rewards (docs/CONTRACT-ECOSYSTEM.md §2).

Crew members are workers whose ``Worker.naike`` points at the crew lead. The referral reward is
paid by KaamSathi to the naike — never deducted from the worker.
"""

import uuid

from django.db import models

from . import labels


class Crew(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.OneToOneField("workers.Worker", on_delete=models.CASCADE, related_name="led_crew")
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} (naike {self.lead.full_name})"

    @property
    def members(self):
        from apps.workers.models import Worker

        return Worker.objects.filter(naike_id=self.lead_id).exclude(pk=self.lead_id)


class Referral(models.Model):
    STATUSES = labels.choices(labels.REFERRAL_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    crew = models.ForeignKey(Crew, on_delete=models.PROTECT, related_name="referrals")
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="naike_referrals")
    application = models.OneToOneField(
        "hiring.Application", on_delete=models.CASCADE, related_name="naike_referral"
    )
    employment = models.ForeignKey(
        "workforce.Employment", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUSES, default="pending", db_index=True)
    eligible_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payout_ref = models.CharField(max_length=120, blank=True, null=True)
    void_reason = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Referral {self.worker_id} via {self.crew_id} [{self.status}]"
