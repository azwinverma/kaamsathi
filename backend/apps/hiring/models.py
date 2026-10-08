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


WAGE_TYPES = [("monthly", "Monthly"), ("daily", "Daily"), ("hourly", "Hourly")]


class JobOpening(models.Model):
    STATUSES = labels.choices(hiring_labels.JOB_STATUS)  # + paused (J006)

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
    paused_at = models.DateTimeField(null=True, blank=True)
    # KaamSathi recruiter who owns sourcing for this job (L009); ops staff only.
    ops_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.organization})"


class JobRequirement(models.Model):
    """Extra requirement on a job (J002). Trade/NSTB/years apply to ``trade`` (or the job's trade);
    ``credential_kind`` needs a verified, unexpired credential of that kind. ``required`` rows exclude
    workers who don't meet them from matches; optional rows add points."""

    NSTB_LEVELS = [("level1", "Level 1"), ("level2", "Level 2"), ("level3", "Level 3")]
    MAX_PER_JOB = 10

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(JobOpening, on_delete=models.CASCADE, related_name="requirements")
    trade = models.ForeignKey(
        "workers.Trade", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    credential_kind = models.CharField(max_length=20, blank=True, null=True)
    nstb_level_min = models.CharField(max_length=12, choices=NSTB_LEVELS, blank=True, null=True)
    min_years = models.PositiveSmallIntegerField(null=True, blank=True)
    required = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"requirement {self.pk} of {self.job_id}"


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
    # L008 / L009: org-scoped free tags and the org member who handles the candidate.
    MAX_TAGS = 10
    tags = models.JSONField(default=list, blank=True)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    # K010 / K012: the score that got the worker shortlisted, and the algorithm that produced it.
    match_score = models.PositiveSmallIntegerField(null=True, blank=True)
    match_algorithm_version = models.CharField(max_length=20, blank=True, null=True)

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
    hourly_wage = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
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


class Interview(models.Model):
    """One interview round (L010). ``Application.interview_at`` mirrors the next pending round."""

    MODES = labels.choices(hiring_labels.INTERVIEW_MODE)
    OUTCOMES = labels.choices(hiring_labels.INTERVIEW_OUTCOME)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="interviews")
    scheduled_at = models.DateTimeField()
    mode = models.CharField(max_length=12, choices=MODES, default="in_person")
    location = models.CharField(max_length=255, blank=True, null=True)
    interviewer_name = models.CharField(max_length=150, blank=True, null=True)
    outcome = models.CharField(max_length=10, choices=OUTCOMES, default="pending")
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_at"]

    def __str__(self):
        return f"Interview {self.application_id} at {self.scheduled_at:%Y-%m-%d %H:%M} [{self.outcome}]"


class MatchConfig(models.Model):
    """Ops-editable matching weights (K001), a singleton (pk=1). ``revision`` bumps on every save."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    weights = models.JSONField(default=dict)
    revision = models.PositiveIntegerField(default=1)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Match config r{self.revision}"


class MatchRun(models.Model):
    """One persisted scoring of a job's candidates (K010) with the algorithm + weights used (K012)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(JobOpening, on_delete=models.CASCADE, related_name="match_runs")
    algorithm_version = models.CharField(max_length=20)
    config = models.JSONField(default=dict)  # {"revision": n, "weights": {...}}
    candidates_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Match run {self.job_id} {self.algorithm_version} @ {self.created_at:%Y-%m-%d %H:%M}"


class MatchCandidate(models.Model):
    run = models.ForeignKey(MatchRun, on_delete=models.CASCADE, related_name="candidates")
    worker = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="+")
    score = models.PositiveSmallIntegerField()
    rank = models.PositiveIntegerField()
    explain = models.JSONField(default=dict)  # {"points": {...}, "reasons": [...], "requirements": [...]}

    class Meta:
        ordering = ["rank"]
        constraints = [models.UniqueConstraint(fields=["run", "worker"], name="uniq_match_candidate")]

    def __str__(self):
        return f"#{self.rank} {self.worker_id} ({self.score})"
