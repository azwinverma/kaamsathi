import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core import labels
from apps.hiring.models import WAGE_TYPES


class Employment(models.Model):
    STATUSES = labels.choices(labels.EMPLOYMENT_STATUS)
    END_REASONS = labels.choices(labels.END_REASON)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.CASCADE, related_name="employments"
    )
    worker = models.ForeignKey("workers.Worker", on_delete=models.PROTECT, related_name="employments")
    site = models.ForeignKey(
        "orgs.Site", on_delete=models.SET_NULL, null=True, blank=True, related_name="employments"
    )
    trade = models.ForeignKey(
        "workers.Trade", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    designation = models.CharField(max_length=120, blank=True, default="")
    employee_code = models.CharField(max_length=40, blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="active")
    end_reason = models.CharField(max_length=20, choices=END_REASONS, null=True, blank=True)
    wage_type = models.CharField(max_length=10, choices=WAGE_TYPES, default="monthly")
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    dearness_allowance = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    other_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    daily_wage = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    ssf_enrolled = models.BooleanField(default=False)
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    shift = models.ForeignKey(
        "orgs.Shift", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    application = models.ForeignKey(
        "hiring.Application", on_delete=models.SET_NULL, null=True, blank=True, related_name="employments"
    )
    replacement_eligible_until = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["worker__full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["worker", "organization"],
                condition=models.Q(status="active"),
                name="one_active_employment_per_org",
            )
        ]

    def __str__(self):
        return f"{self.worker.full_name} @ {self.organization} ({self.status})"

    @property
    def monthly_gross(self) -> Decimal:
        if self.wage_type == "daily":
            return (self.daily_wage or Decimal("0")) * 30
        return (
            (self.basic_salary or Decimal("0"))
            + (self.dearness_allowance or Decimal("0"))
            + (self.other_allowance or Decimal("0"))
        )

    def is_active_on(self, day) -> bool:
        return self.start_date <= day and (self.end_date is None or self.end_date >= day)


class Attendance(models.Model):
    STATUSES = labels.choices(labels.ATTENDANCE_STATUS)
    METHODS = [("qr", "QR"), ("manual", "Manual"), ("supervisor", "Supervisor"), ("self", "Self")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employment = models.ForeignKey(Employment, on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=12, choices=STATUSES)
    check_in_at = models.DateTimeField(null=True, blank=True)
    check_out_at = models.DateTimeField(null=True, blank=True)
    check_in_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_in_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_out_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_out_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    method = models.CharField(max_length=12, choices=METHODS, default="supervisor")
    overtime_minutes = models.PositiveIntegerField(default=0)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    client_uuid = models.UUIDField(unique=True, null=True, blank=True)
    note = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]
        verbose_name_plural = "attendance"
        constraints = [models.UniqueConstraint(fields=["employment", "date"], name="uniq_attendance_day")]

    def __str__(self):
        return f"{self.employment.worker.full_name} {self.date} {self.status}"


class LeaveRequest(models.Model):
    TYPES = labels.choices(labels.LEAVE_TYPE)
    STATUSES = labels.choices(labels.LEAVE_STATUS)
    PAID_TYPES = {"home", "sick", "maternity", "paternity", "mourning"}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employment = models.ForeignKey(Employment, on_delete=models.CASCADE, related_name="leaves")
    leave_type = models.CharField(max_length=12, choices=TYPES)
    from_date = models.DateField()
    to_date = models.DateField()
    days = models.DecimalField(max_digits=5, decimal_places=1)
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="pending")
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.employment.worker.full_name} {self.leave_type} {self.from_date}→{self.to_date}"


class Advance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employment = models.ForeignKey(Employment, on_delete=models.CASCADE, related_name="advances")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    given_on = models.DateField()
    recover_per_month = models.DecimalField(max_digits=12, decimal_places=2)
    recovered_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    note = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-given_on"]
        verbose_name = "Advance (Peski)"

    def __str__(self):
        return f"Peski Rs. {self.amount} → {self.employment.worker.full_name}"

    @property
    def balance(self) -> Decimal:
        return max(self.amount - self.recovered_amount, Decimal("0"))


class Holiday(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.CASCADE, null=True, blank=True, related_name="holidays"
    )
    date = models.DateField(db_index=True)
    name_en = models.CharField(max_length=120)
    name_ne = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.date} {self.name_en}{' (national)' if not self.organization_id else ''}"
