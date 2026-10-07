"""Worker financial profile (verified earnings), partner offers and referrals.

KaamSathi never lends, never holds funds and never charges the worker: offers sit on a licensed
partner's books; we only store referrals and the statuses the partner reports
(docs/CONTRACT-ECOSYSTEM.md §9).
"""

import uuid

from django.db import models

from apps.core import labels
from apps.partners import labels as plabels


class FinancialProfile(models.Model):
    """Summary of *verified* earnings, built only from payslips with payment_status=paid.

    This is an earnings summary, not a credit score — partners make their own decisions.
    """

    worker = models.OneToOneField(
        "workers.Worker", on_delete=models.CASCADE, primary_key=True, related_name="financial_profile"
    )
    months_on_platform = models.PositiveSmallIntegerField(default=0)
    verified_months = models.PositiveSmallIntegerField(default=0)
    avg_monthly_net = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_monthly_net = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_monthly_net = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    income_stability = models.DecimalField(
        max_digits=4, decimal_places=3, null=True, blank=True, help_text="1 − coefficient of variation, ≥ 0"
    )
    employers_count = models.PositiveSmallIntegerField(default=0)
    current_employment_months = models.PositiveSmallIntegerField(default=0)
    ssf_months = models.PositiveSmallIntegerField(default=0)
    last_payslip_month = models.CharField(max_length=7, blank=True, default="")  # "2083-05"
    monthly = models.JSONField(default=list)
    computed_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Financial profile · {self.worker}"


class Offer(models.Model):
    KINDS = labels.choices(plabels.OFFER_KIND)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partner = models.ForeignKey("partners.Partner", on_delete=models.CASCADE, related_name="offers")
    kind = models.CharField(max_length=20, choices=KINDS)
    title = models.CharField(max_length=200)
    title_ne = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")
    description_ne = models.TextField(blank=True, default="")
    min_verified_months = models.PositiveSmallIntegerField(default=0)
    min_avg_net = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    interest_note = models.CharField(
        max_length=255, blank=True, default="", help_text="Partner-stated terms, displayed verbatim."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["partner__name", "title"]

    def __str__(self):
        return f"{self.title} ({self.partner})"


class Referral(models.Model):
    STATUSES = labels.choices(plabels.REFERRAL_STATUS)
    # Only the partner moves a referral (POST /partner/referrals/{id}/status).
    TRANSITIONS = {
        "submitted": {"under_review", "approved", "rejected", "closed"},
        "under_review": {"approved", "rejected", "closed"},
        "approved": {"disbursed", "rejected", "closed"},
        "disbursed": {"closed"},
        "rejected": set(),
        "closed": set(),
    }
    OPEN = {"submitted", "under_review", "approved"}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="finance_referrals")
    offer = models.ForeignKey(Offer, on_delete=models.PROTECT, related_name="referrals")
    partner = models.ForeignKey("partners.Partner", on_delete=models.PROTECT, related_name="referrals")
    grant = models.ForeignKey("partners.ConsentGrant", on_delete=models.PROTECT, related_name="referrals")
    amount_requested = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    purpose_note = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(max_length=15, choices=STATUSES, default="submitted")
    partner_ref = models.CharField(max_length=100, blank=True, default="")
    amount_approved = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    partner_note = models.CharField(max_length=500, blank=True, default="")
    history = models.JSONField(default=list)  # [{status, at, note}]
    partner_notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.worker} → {self.offer} [{self.status}]"
