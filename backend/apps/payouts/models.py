"""Payroll disbursement batches (docs/CONTRACT-ECOSYSTEM.md §6).

Money moves employer → provider → worker. KaamSathi never holds funds; a batch only records
what the employer (or a provider acting for the employer) paid.
"""

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

PROVIDER_LABELS = {
    "bank_file": _("Bank file"),
    "esewa": _("eSewa"),
    "khalti": _("Khalti"),
    "connectips": _("ConnectIPS"),
}
BATCH_STATUS = {
    "draft": _("Draft"),
    "submitted": _("Submitted"),
    "processing": _("Processing"),
    "completed": _("Completed"),
    "partially_failed": _("Partially failed"),
    "cancelled": _("Cancelled"),
}
ITEM_STATUS = {
    "pending": _("Pending"),
    "sent": _("Sent"),
    "paid": _("Paid"),
    "failed": _("Failed"),
}


class PayoutBatch(models.Model):
    PROVIDERS = [(k, v) for k, v in PROVIDER_LABELS.items()]
    STATUSES = [(k, v) for k, v in BATCH_STATUS.items()]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey("payroll.PayrollRun", on_delete=models.CASCADE, related_name="payout_batches")
    provider = models.CharField(max_length=12, choices=PROVIDERS)
    status = models.CharField(max_length=18, choices=STATUSES, default="draft")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    file = models.FileField(upload_to="payouts/", null=True, blank=True)
    totals = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Payout batch"
        verbose_name_plural = "Payout batches"

    def __str__(self):
        return f"{self.get_provider_display()} payout — {self.run} [{self.status}]"


class PayoutItem(models.Model):
    STATUSES = [(k, v) for k, v in ITEM_STATUS.items()]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(PayoutBatch, on_delete=models.CASCADE, related_name="items")
    payslip = models.ForeignKey("payroll.Payslip", on_delete=models.CASCADE, related_name="payout_items")
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    method = models.CharField(max_length=10)
    # Destination snapshot (account / wallet identifiers only — never credentials).
    account_name = models.CharField(max_length=150, blank=True, null=True)
    account_no = models.CharField(max_length=40, blank=True, null=True)
    bank_name = models.CharField(max_length=120, blank=True, null=True)
    wallet_id = models.CharField(max_length=40, blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="pending")
    provider_ref = models.CharField(max_length=80, blank=True, null=True, db_index=True)
    failure_reason = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["payslip__worker__full_name"]
        constraints = [models.UniqueConstraint(fields=["batch", "payslip"], name="uniq_payout_item_payslip")]

    def __str__(self):
        return f"{self.payslip.worker.full_name} Rs. {self.amount} [{self.status}]"
