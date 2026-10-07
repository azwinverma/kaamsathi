import uuid

from django.conf import settings
from django.db import models

from apps.core import labels


class MinimumWage(models.Model):
    effective_from = models.DateField(unique=True)
    monthly_basic = models.DecimalField(max_digits=10, decimal_places=2)
    monthly_da = models.DecimalField(max_digits=10, decimal_places=2)
    monthly_total = models.DecimalField(max_digits=10, decimal_places=2)
    daily = models.DecimalField(max_digits=10, decimal_places=2)
    hourly = models.DecimalField(max_digits=10, decimal_places=2)
    hourly_part_time = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ["-effective_from"]
        verbose_name = "Minimum wage"

    def __str__(self):
        return f"Minimum wage from {self.effective_from}: Rs. {self.monthly_total}"

    @classmethod
    def current(cls, on=None):
        from django.utils import timezone

        on = on or timezone.localdate()
        return cls.objects.filter(effective_from__lte=on).first() or cls.objects.first()


WAGE_TYPES = [("monthly", "Monthly"), ("daily", "Daily")]


class JobOpening(models.Model):
    STATUSES = labels.choices(labels.JOB_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("orgs.Organization", on_delete=models.CASCADE, related_name="jobs")
    site = models.ForeignKey(
        "orgs.Site", on_delete=models.SET_NULL, null=True, blank=True, related_name="jobs"
    )
    trade = models.ForeignKey("workers.Trade", on_delete=models.PROTECT, related_name="+")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    openings_count = models.PositiveSmallIntegerField(default=1)
    wage_type = models.CharField(max_length=10, choices=WAGE_TYPES, default="monthly")
    wage_amount = models.DecimalField(max_digits=12, decimal_places=2)
    shift = models.ForeignKey(
        "orgs.Shift", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    food_provided = models.BooleanField(default=False)
    accommodation_provided = models.BooleanField(default=False)
    start_date = models.DateField(null=True, blank=True)
    min_experience_years = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=10, choices=STATUSES, default="draft")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    first_shortlist_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.organization})"


class Application(models.Model):
    STAGES = labels.choices(labels.STAGE)
    TERMINAL = {"joined", "rejected", "dropped"}
    TRANSITIONS = {
        "sourced": {"shortlisted", "rejected"},
        "shortlisted": {"interview", "selected", "rejected", "dropped"},
        "interview": {"selected", "rejected", "dropped"},
        "selected": {"joined", "dropped"},
        "joined": set(),
        "rejected": set(),
        "dropped": set(),
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(JobOpening, on_delete=models.CASCADE, related_name="applications")
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="applications")
    stage = models.CharField(max_length=12, choices=STAGES, default="sourced")
    interview_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)
    sourced_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    stage_changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-stage_changed_at"]
        constraints = [models.UniqueConstraint(fields=["job", "worker"], name="uniq_application")]

    def __str__(self):
        return f"{self.worker} → {self.job} [{self.stage}]"

    @classmethod
    def can_move(cls, from_stage, to_stage) -> bool:
        return to_stage in cls.TRANSITIONS.get(from_stage, set())


class StageEvent(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="events")
    from_stage = models.CharField(max_length=12, blank=True, null=True)
    to_stage = models.CharField(max_length=12)
    by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.from_stage} → {self.to_stage}"
