import uuid

from django.conf import settings
from django.db import models

from apps.core import labels

from . import labels as hiring_labels


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
    SOURCES = labels.choices(hiring_labels.SOURCE)
    WORKER_RESPONSES = labels.choices(hiring_labels.WORKER_RESPONSE)
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
    # docs/CONTRACT-EXTENSIONS.md §3: who started it, and the worker's own answer to a shortlist.
    source = models.CharField(max_length=16, choices=SOURCES, default="ops")
    worker_response = models.CharField(max_length=10, choices=WORKER_RESPONSES, null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-stage_changed_at"]
        constraints = [models.UniqueConstraint(fields=["job", "worker"], name="uniq_application")]

    def __str__(self):
        return f"{self.worker} → {self.job} [{self.stage}]"

    @classmethod
    def employer_visible(cls, qs=None):
        """Worker-interest rows stay hidden from the employer until ops shortlists them."""
        qs = cls.objects.all() if qs is None else qs
        return qs.exclude(stage="sourced", source="worker_interest")

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


class JobOffer(models.Model):
    """Written offer to a ``selected`` candidate (master spec EMP-07). One active offer per application."""

    STATUSES = labels.choices(hiring_labels.OFFER_STATUS)
    CONTRACT_TYPES = labels.choices(hiring_labels.CONTRACT_TYPE)
    ACTIVE = ("sent", "accepted")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="offers")
    wage_type = models.CharField(max_length=10, choices=WAGE_TYPES, default="monthly")
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    dearness_allowance = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    daily_wage = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    start_date = models.DateField()
    site = models.ForeignKey("orgs.Site", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    designation = models.CharField(max_length=120, blank=True, default="")
    contract_type = models.CharField(max_length=12, choices=CONTRACT_TYPES, default="permanent")
    ends_on = models.DateField(null=True, blank=True)
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=10, choices=STATUSES, default="sent")
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["application"],
                condition=models.Q(status__in=["sent", "accepted"]),
                name="uniq_active_job_offer",
            )
        ]

    def __str__(self):
        return f"Offer {self.application} [{self.status}]"


class JobAlert(models.Model):
    """Worker's saved search (master spec SEARCH-02)."""

    FREQUENCIES = labels.choices(hiring_labels.ALERT_FREQUENCY)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="job_alerts")
    trade = models.ForeignKey(
        "workers.Trade", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    districts = models.ManyToManyField("geo.District", blank=True, related_name="+")
    min_wage = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    frequency = models.CharField(max_length=8, choices=FREQUENCIES, default="instant")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Alert {self.worker} {self.trade_id or 'any'} [{self.frequency}]"
