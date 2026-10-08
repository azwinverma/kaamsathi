import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.functions import Lower

from apps.accounts.models import phone_validator
from apps.core import labels
from apps.core.crypto import EncryptedCharField, blind_index

from . import labels as worker_labels


class Trade(models.Model):
    CATEGORIES = [
        ("construction", "Construction"),
        ("hospitality", "Hospitality"),
        ("security", "Security"),
        ("healthcare", "Healthcare"),
        ("manufacturing", "Manufacturing"),
        ("transport", "Transport"),
        ("general", "General"),
    ]
    code = models.SlugField(max_length=40, primary_key=True)
    name_en = models.CharField(max_length=80)
    name_ne = models.CharField(max_length=80)
    category = models.CharField(max_length=20, choices=CATEGORIES)
    # Inactive trades stay on existing records but are hidden from /ref/trades (ops taxonomy).
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["category", "name_en"]

    def __str__(self):
        return self.name_en


class Worker(models.Model):
    GENDERS = [("male", "Male"), ("female", "Female"), ("other", "Other")]
    VERIFICATION = labels.choices(labels.VERIFICATION_STATUS)
    PAYMENT_METHODS = labels.choices(labels.PAYMENT_METHOD)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="worker",
    )
    full_name = models.CharField(max_length=150)
    full_name_ne = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=10, unique=True, validators=[phone_validator])
    gender = models.CharField(max_length=10, choices=GENDERS, default="male")
    date_of_birth = models.DateField(null=True, blank=True)
    permanent_district = models.ForeignKey(
        "geo.District", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    current_district = models.ForeignKey(
        "geo.District", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    address = models.CharField(max_length=255, blank=True, null=True)
    # Encrypted at rest; look up / de-duplicate via the *_hash blind indexes (apps/core/crypto.py).
    citizenship_no = EncryptedCharField(max_length=40, blank=True, null=True)
    nid_no = EncryptedCharField(max_length=40, blank=True, null=True)
    citizenship_no_hash = models.CharField(
        max_length=64, blank=True, null=True, db_index=True, editable=False
    )
    nid_no_hash = models.CharField(max_length=64, blank=True, null=True, db_index=True, editable=False)
    id_front = models.ImageField(upload_to="worker-ids/", blank=True, null=True)
    id_back = models.ImageField(upload_to="worker-ids/", blank=True, null=True)
    photo = models.ImageField(upload_to="worker-photos/", blank=True, null=True)
    verification_status = models.CharField(max_length=12, choices=VERIFICATION, default="unverified")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_note = models.TextField(blank=True, null=True)
    expected_monthly_wage = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_available = models.BooleanField(default=True)
    available_from = models.DateField(null=True, blank=True)
    preferred_districts = models.ManyToManyField("geo.District", blank=True, related_name="+")
    service_radius_km = models.PositiveSmallIntegerField(null=True, blank=True)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHODS, default="cash")
    bank_name = models.CharField(max_length=120, blank=True, null=True)
    bank_account_no = EncryptedCharField(max_length=40, blank=True, null=True)
    bank_account_name = models.CharField(max_length=150, blank=True, null=True)
    wallet_id = models.CharField(max_length=40, blank=True, null=True)
    ssf_id = models.CharField(max_length=40, blank=True, null=True)
    naike = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="crew")
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.phone})"

    def save(self, *args, **kwargs):
        self.citizenship_no_hash = blind_index(self.citizenship_no, "citizenship")
        self.nid_no_hash = blind_index(self.nid_no, "nid")
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            extra = {"citizenship_no": "citizenship_no_hash", "nid_no": "nid_no_hash"}
            kwargs["update_fields"] = set(update_fields) | {h for f, h in extra.items() if f in update_fields}
        super().save(*args, **kwargs)


class WorkerSkill(models.Model):
    NSTB_LEVELS = [
        ("none", "None"),
        ("elementary", "Elementary"),
        ("level1", "Level 1"),
        ("level2", "Level 2"),
        ("level3", "Level 3"),
    ]
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="skills")
    trade = models.ForeignKey(Trade, on_delete=models.PROTECT, related_name="+")
    years_experience = models.PositiveSmallIntegerField(default=0)
    nstb_level = models.CharField(max_length=12, choices=NSTB_LEVELS, default="none")
    certificate_no = models.CharField(max_length=60, blank=True, null=True)

    class Meta:
        ordering = ["-years_experience"]
        constraints = [models.UniqueConstraint(fields=["worker", "trade"], name="uniq_worker_trade")]

    def __str__(self):
        return f"{self.worker.full_name} · {self.trade_id}"

    @property
    def nstb_rank(self) -> int:
        return {"none": 0, "elementary": 0, "level1": 1, "level2": 2, "level3": 3}.get(self.nstb_level, 0)


class Consent(models.Model):
    SCOPES = [
        ("data_processing", "Data processing"),
        ("profile_share", "Profile share"),
        ("history_share", "History share"),
    ]
    CHANNELS = [("app", "App"), ("sms", "SMS"), ("paper", "Paper"), ("ops", "Ops")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="consents")
    organization = models.ForeignKey(
        "orgs.Organization", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    scope = models.CharField(max_length=20, choices=SCOPES)
    granted = models.BooleanField()
    channel = models.CharField(max_length=10, choices=CHANNELS, default="app")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.worker} {self.scope}={'yes' if self.granted else 'no'}"

    @classmethod
    def is_granted(cls, worker, organization, scope) -> bool:
        latest = (
            cls.objects.filter(worker=worker, organization=organization, scope=scope)
            .order_by("-created_at")
            .first()
        )
        return bool(latest and latest.granted)


class Rating(models.Model):
    RATERS = [("employer", "Employer"), ("worker", "Worker")]
    score_validators = [MinValueValidator(1), MaxValueValidator(5)]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employment = models.ForeignKey("workforce.Employment", on_delete=models.CASCADE, related_name="ratings")
    rater = models.CharField(max_length=10, choices=RATERS)
    score_a = models.PositiveSmallIntegerField(validators=score_validators)
    score_b = models.PositiveSmallIntegerField(validators=score_validators)
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Moderation (N004): the rated party may flag the comment; ops hide/restore it. The score keeps
    # counting unless ops voids the whole rating with a reason (voided ratings never feed scores).
    COMMENT_STATUSES = labels.choices(worker_labels.COMMENT_STATUS)
    comment_status = models.CharField(max_length=8, choices=COMMENT_STATUSES, default="visible", db_index=True)
    flagged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    flagged_at = models.DateTimeField(null=True, blank=True)
    flag_reason = models.CharField(max_length=500, blank=True, null=True)
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    moderated_at = models.DateTimeField(null=True, blank=True)
    moderation_note = models.CharField(max_length=500, blank=True, null=True)
    voided = models.BooleanField(default=False, db_index=True)
    void_reason = models.CharField(max_length=500, blank=True, null=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    voided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["employment", "rater"], name="uniq_rating_per_rater")]

    @property
    def public_comment(self):
        """Comment as shown to anyone but ops: hidden comments are withheld."""
        return None if self.comment_status == "hidden" else self.comment

    def __str__(self):
        return f"{self.rater} rating {self.score_a}/{self.score_b}"


# --------------------------------------------------------------------------- checklist completion
class WorkerLanguage(models.Model):
    """Spoken languages (E004) — shown on the profile and the Skill Passport."""

    LANGUAGES = labels.choices(worker_labels.LANGUAGE)
    PROFICIENCIES = labels.choices(worker_labels.PROFICIENCY)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="languages")
    language = models.CharField(max_length=8, choices=LANGUAGES)
    proficiency = models.CharField(max_length=14, choices=PROFICIENCIES, default="conversational")

    class Meta:
        ordering = ["language"]
        constraints = [models.UniqueConstraint(fields=["worker", "language"], name="uniq_worker_language")]

    def __str__(self):
        return f"{self.worker_id} {self.language}:{self.proficiency}"


class TradeAlias(models.Model):
    """Search synonyms for a trade (F004), e.g. "bhanse" / "भान्से" → cook."""

    LANGUAGES = labels.choices(worker_labels.ALIAS_LANGUAGE)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trade = models.ForeignKey(Trade, on_delete=models.CASCADE, related_name="aliases")
    alias = models.CharField(max_length=80)
    language = models.CharField(max_length=8, choices=LANGUAGES, default="en")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["trade_id", "alias"]
        constraints = [
            models.UniqueConstraint(
                Lower("alias"), "trade", name="uniq_trade_alias_ci"
            )
        ]
        indexes = [models.Index(Lower("alias"), name="trade_alias_lower_idx")]

    def __str__(self):
        return f"{self.alias} → {self.trade_id}"
