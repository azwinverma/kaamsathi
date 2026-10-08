import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core import labels
from apps.hiring.models import WAGE_TYPES


def _money(**kw):
    return models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), **kw)


class PayPolicy(models.Model):
    """Per-org pay rules (checklist R003). The defaults reproduce CONTRACT.md §2 exactly."""

    FESTIVAL_RULES = [
        ("one_month_basic", "One month's basic salary"),
        ("custom_amount", "Custom amount"),
        ("none", "No festival allowance"),
    ]
    ROUNDING = [("two_decimals", "To the paisa (2 decimals)"), ("nearest_rupee", "To the nearest rupee")]

    organization = models.OneToOneField(
        "orgs.Organization", on_delete=models.CASCADE, primary_key=True, related_name="pay_policy"
    )
    # Labour Act 2074 s.33: overtime at least 1.5× the regular rate.
    ot_multiplier = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal("1.50"),
        validators=[MinValueValidator(Decimal("1.5"))],
    )
    festival_allowance_rule = models.CharField(
        max_length=16, choices=FESTIVAL_RULES, default="one_month_basic"
    )
    festival_custom_amount = _money()
    # BS month (1–12) in which new runs default to including the festival allowance; null = no default.
    festival_month = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    rounding = models.CharField(max_length=14, choices=ROUNDING, default="two_decimals")
    weekly_off_paid = models.BooleanField(default=True)
    half_day_fraction = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=Decimal("0.50"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))],
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Pay policy"
        verbose_name_plural = "Pay policies"

    def __str__(self):
        return f"Pay policy: {self.organization}"


class PayGroup(models.Model):
    """A slice of the workforce paid in its own monthly run (checklist R001).

    An employment belongs to the first active group (oldest first) whose non-empty criteria all
    match; employments matching no group are paid by the run without a pay group.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("orgs.Organization", on_delete=models.CASCADE, related_name="pay_groups")
    name = models.CharField(max_length=80)
    site_ids = models.JSONField(default=list, blank=True)
    wage_types = models.JSONField(default=list, blank=True)
    contractor_ids = models.JSONField(default=list, blank=True)
    # Informational: BS day of month this group is usually paid (1–32).
    pay_day = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(32)]
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "name"], name="uniq_pay_group_name"),
        ]

    def __str__(self):
        return f"{self.name} ({self.organization})"


class PayrollRun(models.Model):
    STATUSES = labels.choices(labels.PAYROLL_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.CASCADE, related_name="payroll_runs"
    )
    bs_year = models.PositiveSmallIntegerField()
    bs_month = models.PositiveSmallIntegerField()
    period_start = models.DateField()
    period_end = models.DateField()
    days_in_month = models.PositiveSmallIntegerField()
    pay_group = models.ForeignKey(
        PayGroup, on_delete=models.PROTECT, null=True, blank=True, related_name="runs"
    )
    include_festival_allowance = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=STATUSES, default="draft")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-bs_year", "-bs_month"]
        constraints = [
            # One run per (org, month, pay group); the null group (all unassigned) once per month too.
            models.UniqueConstraint(
                fields=["organization", "bs_year", "bs_month"],
                condition=models.Q(pay_group__isnull=True),
                name="uniq_payroll_run_month",
            ),
            models.UniqueConstraint(
                fields=["organization", "bs_year", "bs_month", "pay_group"],
                condition=models.Q(pay_group__isnull=False),
                name="uniq_payroll_run_month_group",
            ),
        ]

    def __str__(self):
        return f"{self.organization} {self.bs_year}-{self.bs_month:02d} [{self.status}]"


class Payslip(models.Model):
    PAYMENT_STATUSES = labels.choices(labels.PAYMENT_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name="payslips")
    employment = models.ForeignKey("workforce.Employment", on_delete=models.PROTECT, related_name="payslips")
    worker = models.ForeignKey("workers.Worker", on_delete=models.PROTECT, related_name="payslips")
    wage_type = models.CharField(max_length=10, choices=WAGE_TYPES)
    days_in_month = models.PositiveSmallIntegerField()
    present_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0"))
    paid_leave_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0"))
    holiday_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0"))
    weekly_off_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0"))
    absent_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0"))
    payable_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0"))
    overtime_hours = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0"))
    regular_hours = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0"))
    basic_earned = _money()
    da_earned = _money()
    allowance_earned = _money()
    overtime_pay = _money()
    festival_allowance = _money()
    gross_pay = _money()
    ssf_employee = _money()
    ssf_employer = _money()
    tds = _money()
    advance_recovery = _money()
    other_deductions = _money()
    net_pay = _money()
    note = models.TextField(blank=True, null=True)
    payment_method = models.CharField(max_length=10, default="cash")
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUSES, default="pending")
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_ref = models.CharField(max_length=80, blank=True, null=True)

    class Meta:
        ordering = ["worker__full_name"]
        constraints = [models.UniqueConstraint(fields=["run", "employment"], name="uniq_payslip_per_run")]

    def __str__(self):
        return f"Payslip {self.worker.full_name} {self.run.bs_year}-{self.run.bs_month:02d}"


class TaxSlab(models.Model):
    fiscal_year = models.CharField(
        max_length=7,
        help_text="⚠ Verify each fiscal year: income-tax slabs change with the annual budget "
        "(Finance Act). Format 2083/84.",
    )
    lower = models.DecimalField(max_digits=14, decimal_places=2)
    upper = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Percent, e.g. 10.00")
    applies_to = models.CharField(max_length=10, default="single")

    class Meta:
        ordering = ["fiscal_year", "lower"]
        verbose_name = "Tax slab (verify each fiscal year)"
        verbose_name_plural = "Tax slabs (verify each fiscal year)"

    def __str__(self):
        upper = f"{self.upper:,.0f}" if self.upper is not None else "∞"
        return f"FY {self.fiscal_year}: {self.lower:,.0f}–{upper} @ {self.rate}%"
