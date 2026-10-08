import uuid

from django.conf import settings
from django.db import models


class TimesheetPolicy(models.Model):
    """Per-organization timesheet rules (docs/CONTRACT-EXTENSIONS.md §4)."""

    organization = models.OneToOneField(
        "orgs.Organization", on_delete=models.CASCADE, related_name="timesheet_policy"
    )
    # When True, payroll pays only OT approved on weekly timesheets (instead of attendance OT).
    ot_requires_approval = models.BooleanField(default=False)
    # Labour Act 2074: overtime may not exceed 24 hours a week.
    weekly_ot_cap_minutes = models.PositiveIntegerField(default=1440)
    daily_regular_minutes = models.PositiveIntegerField(default=480)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "timesheet policies"

    def __str__(self):
        return f"Timesheet policy · {self.organization}"


class Timesheet(models.Model):
    STATUSES = [
        ("draft", "Draft"),
        ("submitted", "Submitted"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employment = models.ForeignKey(
        "workforce.Employment", on_delete=models.CASCADE, related_name="timesheets"
    )
    week_start = models.DateField(db_index=True)  # always a Sunday
    status = models.CharField(max_length=10, choices=STATUSES, default="draft")
    # [{date, worked_minutes, regular_minutes, overtime_minutes, status}] × 7
    days = models.JSONField(default=list)
    regular_minutes = models.PositiveIntegerField(default=0)
    overtime_minutes_claimed = models.PositiveIntegerField(default=0)
    overtime_minutes_approved = models.PositiveIntegerField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-week_start", "employment__worker__full_name"]
        constraints = [
            models.UniqueConstraint(fields=["employment", "week_start"], name="uniq_timesheet_week")
        ]

    def __str__(self):
        return f"{self.employment_id} week {self.week_start} [{self.status}]"


class AttendanceCorrection(models.Model):
    """Worker's request to correct one day of hajiri (P008). A supervisor (own sites) or manager
    approves it, which applies it through ``workforce.services.upsert_attendance`` (respects the
    payroll lock). Lives here, next to timesheets, to keep the workforce app's migrations untouched."""

    STATUSES = [("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")]
    ATTENDANCE_STATUSES = [
        ("present", "Present"),
        ("absent", "Absent"),
        ("half_day", "Half day"),
        ("leave", "Leave"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employment = models.ForeignKey(
        "workforce.Employment", on_delete=models.CASCADE, related_name="attendance_corrections"
    )
    date = models.DateField()
    requested_status = models.CharField(max_length=12, choices=ATTENDANCE_STATUSES)
    requested_check_in_at = models.DateTimeField(null=True, blank=True)
    requested_check_out_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=10, choices=STATUSES, default="pending", db_index=True)
    current_status = models.CharField(max_length=12, blank=True, null=True)  # recorded status when raised
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["employment", "date"],
                condition=models.Q(status="pending"),
                name="uniq_pending_attendance_correction",
            )
        ]

    def __str__(self):
        return f"Correction {self.employment_id} {self.date} → {self.requested_status} [{self.status}]"
