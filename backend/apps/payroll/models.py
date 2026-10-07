import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core import labels
from apps.hiring.models import WAGE_TYPES


def _money(**kw):
    return models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), **kw)


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
            models.UniqueConstraint(
                fields=["organization", "bs_year", "bs_month"], name="uniq_payroll_run_month"
            )
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
