"""Training providers, courses and enrolments (docs/CONTRACT-ECOSYSTEM.md §4)."""

import uuid

from django.db import models

from apps.core import labels as core_labels

from . import labels


class TrainingProvider(models.Model):
    KINDS = core_labels.choices(labels.PROVIDER_KIND)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    name_ne = models.CharField(max_length=200, blank=True, null=True)
    kind = models.CharField(max_length=20, choices=KINDS)
    ctevt_affiliation_no = models.CharField(max_length=60, blank=True, null=True)
    district = models.ForeignKey("geo.District", on_delete=models.PROTECT, related_name="+")
    address = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    partner = models.ForeignKey(
        "partners.Partner", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Course(models.Model):
    LEVELS = core_labels.choices(labels.LEVEL)
    MODES = core_labels.choices(labels.MODE)
    STATUSES = core_labels.choices(labels.COURSE_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.ForeignKey(TrainingProvider, on_delete=models.CASCADE, related_name="courses")
    trade = models.ForeignKey("workers.Trade", on_delete=models.PROTECT, related_name="+")
    title = models.CharField(max_length=200)
    title_ne = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    level = models.CharField(max_length=12, choices=LEVELS, default="basic")
    duration_days = models.PositiveSmallIntegerField()
    fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sponsor_note = models.CharField(max_length=255, blank=True, null=True)
    mode = models.CharField(max_length=12, choices=MODES, default="classroom")
    district = models.ForeignKey("geo.District", on_delete=models.PROTECT, related_name="+")
    starts_on = models.DateField()
    seats = models.PositiveSmallIntegerField(default=20)
    status = models.CharField(max_length=10, choices=STATUSES, default="open")
    leads_to_nstb = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_on", "title"]

    def __str__(self):
        return f"{self.title} ({self.provider})"


class Enrollment(models.Model):
    STATUSES = core_labels.choices(labels.ENROLLMENT_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="enrollments")
    status = models.CharField(max_length=10, choices=STATUSES, default="applied")
    sponsored_by_org = models.ForeignKey(
        "orgs.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sponsored_enrollments",
    )
    applied_at = models.DateTimeField(auto_now_add=True)
    completed_on = models.DateField(null=True, blank=True)
    credential = models.ForeignKey(
        "credentials.Credential", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-applied_at"]
        constraints = [models.UniqueConstraint(fields=["course", "worker"], name="uniq_course_worker")]

    def __str__(self):
        return f"{self.worker.full_name} → {self.course.title} [{self.status}]"
