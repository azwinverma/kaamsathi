"""Bolau — Sipalu self-profiles, Ghardhani bookings, Kaam requests & offers (docs/CONTRACT-BOLAU.md).

Guiding rules enforced here and in ``services.py``: Sipalu never pay (only the Ghardhani's booking fee
exists, recorded on ``billing.Charge.payer_user``); KaamSathi never holds the Sipalu's money (the
Ghardhani pays the Sipalu directly and both sides only *mark* it); only verified Sipalu are bookable;
hourly rates ≥ the hourly minimum wage; exact address / phone shown only inside the accepted window.

DB constraints: unique handle (+ format check), one rating per side per booking, at most three offers
per Kaam request (``slot`` 1–3, unique per request), one offer per Sipalu per request and no
double-booking (Postgres exclusion constraint over the Sipalu's active booking time ranges).
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeOperators
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Func, Q

from apps.core.crypto import EncryptedCharField
from apps.core.files import private_storage

from . import labels

HANDLE_REGEX = r"^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$"
MONEY = {"max_digits": 10, "decimal_places": 2}
# Booking statuses that hold the Sipalu's time slot (no double-booking).
ACTIVE_BOOKING_STATUSES = ("requested", "accepted", "on_the_way", "arrived", "in_progress")


class TsTzRange(Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


# --------------------------------------------------------------------------- Sipalu
class SipaluProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    worker = models.OneToOneField("workers.Worker", on_delete=models.CASCADE, related_name="sipalu")
    handle = models.CharField(max_length=30, unique=True)
    handle_changed_at = models.DateTimeField(null=True, blank=True)
    headline = models.CharField(max_length=80, blank=True, default="")
    headline_ne = models.CharField(max_length=80, blank=True, default="")
    bio = models.CharField(max_length=600, blank=True, default="")
    bio_ne = models.CharField(max_length=600, blank=True, default="")
    bolau_enabled = models.BooleanField(default=False)
    instant_booking = models.BooleanField(default=False)
    service_districts = models.ManyToManyField("geo.District", blank=True, related_name="+")
    service_municipality = models.CharField(max_length=120, blank=True, default="")
    service_radius_km = models.PositiveSmallIntegerField(null=True, blank=True)
    # Coarse (2 decimals ≈ 1 km) and never shown to anyone; only used for distance bands.
    base_lat = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    base_lng = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    gender_visible = models.BooleanField(default=False)
    public_indexable = models.BooleanField(default=False)  # SEO opt-in; default noindex
    public_consent_at = models.DateTimeField(null=True, blank=True)  # profile + portfolio shown publicly
    years_total = models.PositiveSmallIntegerField(default=0)
    # Computed (services.refresh_stats).
    response_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    jobs_completed = models.PositiveIntegerField(default=0)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    rating_count = models.PositiveIntegerField(default=0)
    # Ops suspension (``bolau_enabled`` forced off; the Sipalu cannot switch it back on).
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspension_reason = models.CharField(max_length=500, blank=True, default="")
    suspended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["handle"]
        constraints = [
            models.CheckConstraint(condition=Q(handle__regex=HANDLE_REGEX), name="bolau_handle_format"),
        ]

    def __str__(self):
        return f"@{self.handle}"


class SipaluService(models.Model):
    PRICE_TYPES = labels.choices(labels.PRICE_TYPE)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(SipaluProfile, on_delete=models.CASCADE, related_name="services")
    trade = models.ForeignKey("workers.Trade", on_delete=models.PROTECT, related_name="+")
    title = models.CharField(max_length=120)
    title_ne = models.CharField(max_length=120, blank=True, default="")
    description = models.CharField(max_length=600, blank=True, default="")
    price_type = models.CharField(max_length=20, choices=PRICE_TYPES)
    price = models.DecimalField(**MONEY)
    visit_fee = models.DecimalField(**MONEY, null=True, blank=True)
    estimated_minutes = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]
        constraints = [models.CheckConstraint(condition=Q(price__gte=0), name="bolau_service_price_gte_0")]

    def __str__(self):
        return f"{self.title} ({self.price_type} {self.price})"


class AvailabilityRule(models.Model):
    """Weekly working hours. ``weekday`` 0 = Sunday … 6 = Saturday (same as the BS calendar API)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(SipaluProfile, on_delete=models.CASCADE, related_name="availability")
    weekday = models.PositiveSmallIntegerField(validators=[MaxValueValidator(6)])
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ["weekday", "start_time"]
        constraints = [
            models.CheckConstraint(condition=Q(weekday__lte=6), name="bolau_rule_weekday"),
            models.CheckConstraint(condition=Q(start_time__lt=models.F("end_time")), name="bolau_rule_order"),
            models.UniqueConstraint(fields=["profile", "weekday", "start_time"], name="bolau_rule_unique"),
        ]

    def __str__(self):
        return f"{self.profile_id} {self.weekday} {self.start_time}-{self.end_time}"


class TimeOff(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(SipaluProfile, on_delete=models.CASCADE, related_name="time_off")
    from_date = models.DateField()
    to_date = models.DateField()
    note = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["from_date"]
        constraints = [
            models.CheckConstraint(
                condition=Q(from_date__lte=models.F("to_date")), name="bolau_timeoff_order"
            )
        ]

    def __str__(self):
        return f"{self.profile_id} off {self.from_date}–{self.to_date}"


class PortfolioItem(models.Model):
    MAX_ITEMS = 12

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(SipaluProfile, on_delete=models.CASCADE, related_name="portfolio")
    image = models.ImageField(upload_to="bolau-portfolio/", storage=private_storage)
    caption = models.CharField(max_length=200, blank=True, default="")
    caption_ne = models.CharField(max_length=200, blank=True, default="")
    trade = models.ForeignKey(
        "workers.Trade", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    # --------------------------------------------------------------------------- Ghardhani

    def __str__(self):
        return f"Portfolio {self.pk}"


class GhardhaniProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ghardhani")
    display_name = models.CharField(max_length=120, blank=True, default="")
    preferred_language = models.CharField(max_length=2, default="ne")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name or str(self.user_id)


class Address(models.Model):
    LABELS = labels.choices(labels.ADDRESS_LABEL)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ghardhani = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bolau_addresses"
    )
    label = models.CharField(max_length=10, choices=LABELS, default="home")
    line = EncryptedCharField(max_length=255)
    line_hash = models.CharField(max_length=64, blank=True, default="", db_index=True, editable=False)
    ward = models.PositiveSmallIntegerField(null=True, blank=True)
    municipality = models.CharField(max_length=120)
    district = models.ForeignKey("geo.District", on_delete=models.PROTECT, related_name="+")
    landmark = EncryptedCharField(max_length=200, blank=True, null=True)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)  # soft delete — bookings keep pointing here
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_default", "created_at"]

    def __str__(self):
        return f"{self.label}: ward {self.ward}, {self.municipality}"

    def save(self, *args, **kwargs):
        from apps.core.crypto import blind_index

        raw = f"{self.line}|{self.ward or ''}|{self.municipality}|{self.district_id}".lower()
        self.line_hash = blind_index(raw, "bolau_address") or ""
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            kwargs["update_fields"] = set(update_fields) | {"line_hash"}
        super().save(*args, **kwargs)


class Favourite(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ghardhani = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    profile = models.ForeignKey(SipaluProfile, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["ghardhani", "profile"], name="bolau_favourite_unique")
        ]

    # --------------------------------------------------------------------------- Kaam requests

    def __str__(self):
        return f"{self.ghardhani_id} ♥ {self.profile_id}"


class KaamRequest(models.Model):
    STATUSES = labels.choices(labels.REQUEST_STATUS)
    OPEN = ("open", "offers_received")
    MAX_PHOTOS = 4

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=12, unique=True)
    ghardhani = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="kaam_requests"
    )
    trade = models.ForeignKey("workers.Trade", on_delete=models.PROTECT, related_name="+")
    title = models.CharField(max_length=120)
    description = models.TextField(max_length=2000, blank=True, default="")
    address = models.ForeignKey(Address, on_delete=models.PROTECT, related_name="+")
    preferred_window_start = models.DateTimeField()
    preferred_window_end = models.DateTimeField()
    budget_max = models.DecimalField(**MONEY, null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUSES, default="open", db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    notified_count = models.PositiveSmallIntegerField(default=0)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code


class KaamRequestPhoto(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(KaamRequest, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="bolau-requests/", storage=private_storage)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Photo {self.pk}"


class Offer(models.Model):
    STATUSES = labels.choices(labels.OFFER_STATUS)
    PRICE_TYPES = labels.choices(labels.PRICE_TYPE)
    MAX_PER_REQUEST = 3

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(KaamRequest, on_delete=models.CASCADE, related_name="offers")
    sipalu = models.ForeignKey("workers.Worker", on_delete=models.CASCADE, related_name="bolau_offers")
    slot = models.PositiveSmallIntegerField()  # 1..3 — the DB caps offers per request
    price_type = models.CharField(max_length=20, choices=PRICE_TYPES)
    price = models.DecimalField(**MONEY)
    visit_fee = models.DecimalField(**MONEY, null=True, blank=True)
    estimated_minutes = models.PositiveIntegerField(default=60)
    message = models.CharField(max_length=600, blank=True, default="")
    proposed_start = models.DateTimeField()
    status = models.CharField(max_length=10, choices=STATUSES, default="pending", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.CheckConstraint(condition=Q(slot__gte=1) & Q(slot__lte=3), name="bolau_offer_slot_1_3"),
            models.UniqueConstraint(fields=["request", "slot"], name="bolau_offer_max_three"),
            models.UniqueConstraint(fields=["request", "sipalu"], name="bolau_offer_one_per_sipalu"),
        ]

    # --------------------------------------------------------------------------- bookings

    def __str__(self):
        return f"Offer {self.slot} on {self.request_id} [{self.status}]"


class Booking(models.Model):
    STATUSES = labels.choices(labels.BOOKING_STATUS)
    PRICE_TYPES = labels.choices(labels.PRICE_TYPE)
    FEE_STATUSES = labels.choices(labels.FEE_STATUS)
    CANCELLERS = labels.choices(labels.CANCELLED_BY)
    PAY_METHODS = labels.choices(labels.PAY_METHOD)
    SOURCES = labels.choices(labels.SOURCE)
    QUOTE_STATUSES = labels.choices(labels.QUOTE_STATUS)
    ACTIVE = ACTIVE_BOOKING_STATUSES
    # Accepted window: contact details and the exact address are shared.
    CONTACT_STATUSES = ("accepted", "on_the_way", "arrived", "in_progress", "completed", "confirmed")
    ARRIVAL_MAX_TRIES = 5

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=12, unique=True)
    ghardhani = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bolau_bookings"
    )
    sipalu = models.ForeignKey("workers.Worker", on_delete=models.PROTECT, related_name="bolau_bookings")
    service = models.ForeignKey(
        SipaluService, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    trade = models.ForeignKey("workers.Trade", on_delete=models.PROTECT, related_name="+")
    description = models.TextField(max_length=2000, blank=True, default="")
    address = models.ForeignKey(Address, on_delete=models.PROTECT, related_name="+")
    address_snapshot = models.JSONField(default=dict, blank=True)  # frozen at acceptance
    scheduled_start = models.DateTimeField(db_index=True)
    scheduled_end = models.DateTimeField()
    estimated_minutes = models.PositiveIntegerField(default=60)
    price_type = models.CharField(max_length=20, choices=PRICE_TYPES)
    quoted_price = models.DecimalField(**MONEY)
    visit_fee = models.DecimalField(**MONEY, null=True, blank=True)
    quote_amount = models.DecimalField(**MONEY, null=True, blank=True)  # visit_then_quote: after the visit
    quote_status = models.CharField(max_length=10, choices=QUOTE_STATUSES, default="none")
    final_price = models.DecimalField(**MONEY, null=True, blank=True)
    booking_fee = models.DecimalField(**MONEY, default=0)
    booking_fee_status = models.CharField(max_length=10, choices=FEE_STATUSES, default="waived")
    fee_charge = models.ForeignKey(
        "billing.Charge", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    fee_provider = models.CharField(max_length=20, blank=True, default="")
    fee_reference = models.CharField(max_length=80, blank=True, default="")
    fee_paid_at = models.DateTimeField(null=True, blank=True)
    fee_refund_manual = models.BooleanField(default=False)  # paid fee refunded by ops, not the gateway
    status = models.CharField(max_length=12, choices=STATUSES, default="requested", db_index=True)
    status_before_dispute = models.CharField(max_length=12, blank=True, default="")
    cancelled_by = models.CharField(max_length=10, choices=CANCELLERS, blank=True, null=True)
    cancel_reason = models.CharField(max_length=500, blank=True, default="")
    late_cancellation = models.BooleanField(default=False)
    decline_reason = models.CharField(max_length=500, blank=True, default="")
    # Arrival code: 4 digits derived from HMAC(secret, id:nonce) so the Ghardhani's app can show it;
    # only its hash is stored.
    arrival_nonce = models.CharField(max_length=32, blank=True, default="")
    arrival_code_hash = models.CharField(max_length=64, blank=True, default="")
    arrival_attempts = models.PositiveSmallIntegerField(default=0)
    arrival_verified_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)  # answer-by for "requested"
    accepted_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    on_the_way_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    completion_note = models.CharField(max_length=600, blank=True, default="")
    # Direct payment Ghardhani → Sipalu (KaamSathi never holds it; both sides only mark it).
    payment_method_to_sipalu = models.CharField(max_length=10, choices=PAY_METHODS, blank=True, null=True)
    paid_to_sipalu_marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    paid_to_sipalu_at = models.DateTimeField(null=True, blank=True)
    paid_marked_by_ghardhani_at = models.DateTimeField(null=True, blank=True)
    paid_marked_by_sipalu_at = models.DateTimeField(null=True, blank=True)
    paid_method_ghardhani = models.CharField(max_length=10, choices=PAY_METHODS, blank=True, null=True)
    paid_method_sipalu = models.CharField(max_length=10, choices=PAY_METHODS, blank=True, null=True)
    source = models.CharField(max_length=10, choices=SOURCES, default="direct")
    request = models.ForeignKey(
        KaamRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name="bookings"
    )
    offer = models.OneToOneField(
        Offer, on_delete=models.SET_NULL, null=True, blank=True, related_name="booking"
    )
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_start"]
        constraints = [
            models.CheckConstraint(
                condition=Q(scheduled_end__gt=models.F("scheduled_start")), name="bolau_booking_time_order"
            ),
            models.CheckConstraint(condition=Q(booking_fee__gte=0), name="bolau_booking_fee_gte_0"),
            ExclusionConstraint(
                name="bolau_no_double_booking",
                expressions=[
                    ("sipalu", RangeOperators.EQUAL),
                    (TsTzRange("scheduled_start", "scheduled_end"), RangeOperators.OVERLAPS),
                ],
                condition=Q(status__in=ACTIVE_BOOKING_STATUSES),
            ),
        ]

    def __str__(self):
        return f"{self.code} [{self.status}]"

    # risk.describe_subject reads ``worker`` / ``title``
    @property
    def worker(self):
        return self.sipalu

    @property
    def title(self):
        return self.code


class BookingEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="events")
    from_status = models.CharField(max_length=12, blank=True, default="")
    to_status = models.CharField(max_length=12)
    by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    by_party = models.CharField(max_length=10, blank=True, default="")  # ghardhani | sipalu | ops | system
    note = models.CharField(max_length=600, blank=True, default="")
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["at"]

    def __str__(self):
        return f"{self.booking_id}: {self.from_status}→{self.to_status}"


class BookingRating(models.Model):
    """Two-way rating after ``confirmed``. ``side`` is who rated: ``ghardhani`` rates the Sipalu,
    ``sipalu`` rates the Ghardhani. Moderated like employment ratings (flag → ops hide/restore/void)."""

    SIDES = labels.choices(labels.RATING_SIDE)
    COMMENT_STATUSES = labels.choices(labels.COMMENT_STATUS)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="ratings")
    side = models.CharField(max_length=10, choices=SIDES)
    rater = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    score = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.CharField(max_length=600, blank=True, default="")
    tags = models.JSONField(default=list, blank=True)
    # Review-fraud signals (hashes only).
    device_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)
    address_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)
    comment_status = models.CharField(
        max_length=8, choices=COMMENT_STATUSES, default="visible", db_index=True
    )
    flagged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    flagged_at = models.DateTimeField(null=True, blank=True)
    flag_reason = models.CharField(max_length=500, blank=True, default="")
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    moderated_at = models.DateTimeField(null=True, blank=True)
    moderation_note = models.CharField(max_length=500, blank=True, default="")
    voided = models.BooleanField(default=False, db_index=True)
    void_reason = models.CharField(max_length=500, blank=True, default="")
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["booking", "side"], name="bolau_rating_once_per_side"),
            models.CheckConstraint(
                condition=Q(score__gte=1) & Q(score__lte=5), name="bolau_rating_score_1_5"
            ),
        ]

    def __str__(self):
        return f"{self.side} rating {self.score} on {self.booking_id}"

    @property
    def public_comment(self):
        return None if self.comment_status == "hidden" or self.voided else (self.comment or None)


class BookingReport(models.Model):
    """A party reports the other (off-platform payment solicitation, abuse, fake profile)."""

    REASONS = labels.choices(labels.REPORT_REASON)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="reports")
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    reporter_side = models.CharField(max_length=10)  # ghardhani | sipalu
    reason = models.CharField(max_length=24, choices=REASONS)
    note = models.CharField(max_length=1000, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["booking", "reporter", "reason"], name="bolau_report_once"),
        ]

    def __str__(self):
        return f"{self.reason} on {self.booking_id}"
