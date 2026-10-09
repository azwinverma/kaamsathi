"""Billing: plans, subscriptions, charges, VAT invoices, credit notes and manual payments.

Guiding rule (docs/CONTRACT-ECOSYSTEM.md): **workers never pay**. Every payer here is either an
employer ``Organization`` or a ``partners.Partner`` (bank, insurer, training provider, agency).
There is deliberately no foreign key to ``workers.Worker`` anywhere in this app, and a database
check constraint makes a payer mandatory on every charge and invoice.
"""

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.files import private_storage

from . import labels


class Plan(models.Model):
    """A price list. Subscription = max(monthly_base + extra workers × per_active_worker, min_monthly),
    where extra workers = active workers above ``included_workers``."""

    CODES = labels.choices(labels.PLAN_CODE)

    code = models.CharField(max_length=20, choices=CODES, unique=True)
    name = models.CharField(max_length=60)
    monthly_base = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    per_active_worker = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    min_monthly = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    placement_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    included_workers = models.PositiveIntegerField(default=0)
    features = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["monthly_base", "code"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Subscription(models.Model):
    """Organization → plan link, stored on the billing side (orgs keeps its legacy ``plan`` field)."""

    STATUSES = labels.choices(labels.SUBSCRIPTION_STATUS)

    organization = models.OneToOneField(
        "orgs.Organization", on_delete=models.CASCADE, related_name="billing_subscription"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    started_on = models.DateField()
    status = models.CharField(max_length=10, choices=STATUSES, default="active")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.organization} → {self.plan.code} [{self.status}]"


class Charge(models.Model):
    KINDS = labels.choices(labels.CHARGE_KIND)
    STATUSES = labels.choices(labels.CHARGE_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.CASCADE, related_name="charges", null=True, blank=True
    )
    payer_partner = models.ForeignKey(
        "partners.Partner",
        on_delete=models.PROTECT,
        related_name="charges",
        null=True,
        blank=True,
        help_text="Partner/training-provider revenue is billed to the partner — never to a worker.",
    )
    payer_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="bolau_charges",
        null=True,
        blank=True,
        help_text="Bolau booking fee: the Ghardhani who booked. Sipalu/workers are never payers.",
    )
    kind = models.CharField(max_length=24, choices=KINDS)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    bs_year = models.PositiveSmallIntegerField(null=True, blank=True)
    bs_month = models.PositiveSmallIntegerField(null=True, blank=True)
    application = models.ForeignKey(
        "hiring.Application", on_delete=models.SET_NULL, null=True, blank=True, related_name="charges"
    )
    replaces_employment = models.ForeignKey(
        "workforce.Employment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replacement_charges",
        help_text="Ended employment this placement replaced (fee waived).",
    )
    status = models.CharField(max_length=10, choices=STATUSES, default="unpaid")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(organization__isnull=False)
                | Q(payer_partner__isnull=False)
                | Q(payer_user__isnull=False),
                name="billing_charge_has_payer",
            ),
            models.CheckConstraint(
                condition=~Q(kind="booking_fee") | Q(payer_user__isnull=False, organization__isnull=True),
                name="billing_booking_fee_payer_user",
            ),
        ]

    def __str__(self):
        return f"{self.payer} {self.kind} Rs. {self.amount} [{self.status}]"

    @property
    def payer(self):
        return self.organization or self.payer_partner or self.payer_user


class InvoiceSequence(models.Model):
    """Gap-free counters per series and fiscal year, e.g. ``("KS", "2083/84") → 123``."""

    series = models.CharField(max_length=10)
    fiscal_year = models.CharField(max_length=7)
    last = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["series", "fiscal_year"], name="billing_seq_unique")]

    def __str__(self):
        return f"{self.series}-{self.fiscal_year}: {self.last}"


class Invoice(models.Model):
    STATUSES = labels.choices(labels.INVOICE_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.CharField(
        max_length=32, unique=True, null=True, blank=True, help_text="Assigned on issue."
    )
    fiscal_year = models.CharField(max_length=7, blank=True, default="")
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.PROTECT, related_name="invoices", null=True, blank=True
    )
    partner = models.ForeignKey(
        "partners.Partner", on_delete=models.PROTECT, related_name="invoices", null=True, blank=True
    )
    period_bs_year = models.PositiveSmallIntegerField(null=True, blank=True)
    period_bs_month = models.PositiveSmallIntegerField(null=True, blank=True)
    issue_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=8, choices=STATUSES, default="draft")
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=13)
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    buyer_name = models.CharField(max_length=200, blank=True, default="")
    buyer_address = models.CharField(max_length=255, blank=True, default="")
    pan_of_buyer = models.CharField(max_length=20, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    pdf = models.FileField(upload_to="invoices/", storage=private_storage, blank=True, null=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    void_reason = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-issue_date", "-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(Q(organization__isnull=False) & Q(partner__isnull=True))
                | (Q(organization__isnull=True) & Q(partner__isnull=False)),
                name="billing_invoice_one_payer",
            ),
        ]

    def __str__(self):
        return self.number or f"Draft {str(self.id)[:8]}"

    @property
    def payer(self):
        return self.organization or self.partner


class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    charge = models.ForeignKey(
        Charge, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoice_lines"
    )
    kind = models.CharField(max_length=24, blank=True, default="")
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.description} Rs. {self.amount}"


class CreditNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="credit_notes")
    number = models.CharField(max_length=32, unique=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, help_text="VAT-inclusive.")
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    reason = models.CharField(max_length=255)
    issue_date = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.number} Rs. {self.amount}"


class PaymentRecord(models.Model):
    METHODS = labels.choices(labels.PAYMENT_METHOD)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=10, choices=METHODS)
    reference = models.CharField(max_length=100, blank=True, default="")
    paid_on = models.DateField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_on", "-created_at"]

    def __str__(self):
        return f"{self.method} Rs. {self.amount} on {self.paid_on}"
