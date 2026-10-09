"""Sipalu & Ghardhani profiles: becoming a Sipalu, handles, services, availability, completeness,
progressive onboarding, stats (docs/CONTRACT-BOLAU.md §1–2)."""

from __future__ import annotations

import datetime as dt
import re
import secrets
import statistics

from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q
from django.utils import timezone
from django.utils.text import slugify

from apps.core.exceptions import APIError, InvalidState
from apps.core.money import D, q2

from . import labels
from .common import check_price, error
from .models import (
    AvailabilityRule,
    Booking,
    BookingRating,
    GhardhaniProfile,
    PortfolioItem,
    SipaluProfile,
    SipaluService,
    TimeOff,
)

HANDLE_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$")
HANDLE_CHANGE_DAYS = 30
RESERVED_HANDLES = frozenset(
    {
        "about", "admin", "api", "app", "bolau", "book", "booking", "bookings", "edit", "ghar",
        "ghardhani", "help", "join", "kaam", "kaamsathi", "login", "logout", "me", "media", "new",
        "ops", "privacy", "public", "request", "requests", "root", "search", "settings", "signup",
        "sipalu", "static", "staff", "support", "system", "terms", "www", "null", "undefined",
    }
)  # fmt: skip
ONBOARDING_STEPS = (
    "name",
    "photo",
    "skills",
    "languages",
    "service_area",
    "availability",
    "services",
    "headline",
    "payment",
    "identity",
    "consent",
)
COMPLETENESS_KEYS = (
    "name",
    "photo",
    "skills",
    "languages",
    "identity",
    "verified",
    "headline",
    "services",
    "availability",
    "service_area",
    "payment_details",
    "consent",
)
OPTIONAL_KEYS = ("portfolio",)


# --------------------------------------------------------------------------- worker + profile
@transaction.atomic
def ensure_worker(user):
    """The user's Worker; a user becoming a Sipalu without one gets one (phone from the user,
    verification ``pending``, ``data_processing`` consent recorded). An unlinked Worker with the same
    phone (added by an employer / ops) is linked instead of duplicated."""
    from apps.workers.models import Consent, Worker

    worker = Worker.objects.filter(user=user).first()
    if worker is not None:
        return worker
    worker = Worker.objects.select_for_update().filter(phone=user.phone).first()
    if worker is not None:
        if worker.user_id and worker.user_id != user.pk:
            raise InvalidState(message=labels.message("phone_in_use"))
        worker.user = user
        worker.save(update_fields=["user", "updated_at"])
    else:
        worker = Worker.objects.create(
            user=user,
            full_name=user.full_name or "",
            phone=user.phone,
            verification_status="pending",
            is_available=True,
        )
    if not Consent.objects.filter(
        worker=worker, organization=None, scope="data_processing", granted=True
    ).exists():
        Consent.objects.create(worker=worker, scope="data_processing", granted=True, channel="app")
    return worker


def _handle_base(name: str) -> str:
    base = slugify(name or "")[:26].strip("-")
    base = re.sub(r"-{2,}", "-", base)
    if len(base) < 3 or base in RESERVED_HANDLES:
        base = f"sipalu-{secrets.token_hex(2)}"
    return base


def unique_handle(name: str) -> str:
    base = _handle_base(name)
    candidate = base
    n = 2
    while SipaluProfile.objects.filter(handle=candidate).exists() or candidate in RESERVED_HANDLES:
        suffix = f"-{n}"
        candidate = base[: 30 - len(suffix)].rstrip("-") + suffix
        n += 1
    return candidate


def ensure_profile(user) -> SipaluProfile:
    worker = ensure_worker(user)
    profile = SipaluProfile.objects.filter(worker=worker).first()
    if profile is not None:
        return profile
    for _attempt in range(5):
        try:
            with transaction.atomic():
                profile = SipaluProfile.objects.create(
                    worker=worker,
                    handle=unique_handle(worker.full_name or user.full_name),
                    years_total=max([s.years_experience for s in worker.skills.all()] or [0]),
                )
                if worker.current_district_id:
                    profile.service_districts.add(worker.current_district_id)
            break
        except IntegrityError:
            profile = SipaluProfile.objects.filter(worker=worker).first()
            if profile is not None:
                return profile
    from .telemetry import track

    track("bolau_sipalu_joined", user)
    return profile


def validate_handle(handle: str, profile: SipaluProfile | None = None) -> str:
    handle = (handle or "").strip().lower()
    if not HANDLE_RE.match(handle) or "--" in handle:
        raise error("validation_error", "handle_format", "handle")
    if handle in RESERVED_HANDLES:
        raise error("validation_error", "handle_reserved", "handle")
    qs = SipaluProfile.objects.filter(handle=handle)
    if profile is not None:
        qs = qs.exclude(pk=profile.pk)
    if qs.exists():
        raise error("duplicate", "handle_taken", "handle")
    return handle


def handle_change_available_at(profile: SipaluProfile):
    if profile.handle_changed_at is None:
        return None
    return profile.handle_changed_at + dt.timedelta(days=HANDLE_CHANGE_DAYS)


@transaction.atomic
def change_handle(profile: SipaluProfile, handle: str) -> SipaluProfile:
    profile = SipaluProfile.objects.select_for_update().get(pk=profile.pk)
    handle = validate_handle(handle, profile)
    if handle == profile.handle:
        return profile
    available = handle_change_available_at(profile)
    if available and timezone.now() < available:
        raise error("invalid_state", "handle_too_soon", "handle")
    profile.handle = handle
    profile.handle_changed_at = timezone.now()
    try:
        with transaction.atomic():
            profile.save(update_fields=["handle", "handle_changed_at", "updated_at"])
    except IntegrityError as exc:
        raise error("duplicate", "handle_taken", "handle") from exc
    return profile


def set_bolau_enabled(profile: SipaluProfile, enabled: bool) -> None:
    if enabled and profile.suspended_at:
        raise InvalidState(message=labels.message("suspended"))
    profile.bolau_enabled = bool(enabled)


# --------------------------------------------------------------------------- bookability
def bookable_problems(profile: SipaluProfile) -> list[str]:
    """Reasons the Sipalu cannot be booked (empty = bookable)."""
    problems = []
    if profile.worker.verification_status != "verified":
        problems.append("verified")
    if not profile.bolau_enabled:
        problems.append("bolau_enabled")
    if profile.suspended_at:
        problems.append("suspended")
    if not profile.services.filter(is_active=True).exists():
        problems.append("services")
    if not profile.availability.exists():
        problems.append("availability")
    return problems


def is_bookable(profile: SipaluProfile) -> bool:
    return not bookable_problems(profile)


def bookable_q(prefix: str = "") -> Q:
    """Queryset filter for bookable SipaluProfile rows (services/availability checked via exists)."""
    p = prefix
    return Q(
        **{
            f"{p}worker__verification_status": "verified",
            f"{p}bolau_enabled": True,
            f"{p}suspended_at__isnull": True,
        }
    )


def bookable_profiles():
    return (
        SipaluProfile.objects.filter(bookable_q())
        .filter(services__is_active=True)
        .filter(availability__isnull=False)
        .distinct()
    )


def is_public(profile: SipaluProfile) -> bool:
    """Public profile page: verified, opted in to Bolau, not suspended, consented to public display."""
    return (
        profile.worker.verification_status == "verified"
        and profile.bolau_enabled
        and not profile.suspended_at
        and profile.public_consent_at is not None
    )


def sipalu_trade_codes(profile: SipaluProfile) -> set[str]:
    codes = set(profile.worker.skills.values_list("trade_id", flat=True))
    codes |= set(profile.services.filter(is_active=True).values_list("trade_id", flat=True))
    return codes


def service_district_codes(profile: SipaluProfile) -> set[str]:
    codes = set(profile.service_districts.values_list("code", flat=True))
    if not codes and profile.worker.current_district_id:
        codes.add(profile.worker.current_district_id)
    return codes


def in_service_area(profile: SipaluProfile, district_code: str | None, lat=None, lng=None) -> bool:
    if district_code and district_code in service_district_codes(profile):
        return True
    if profile.service_radius_km and profile.base_lat is not None and lat is not None and lng is not None:
        from apps.core.geo import haversine_m

        return haversine_m(float(profile.base_lat), float(profile.base_lng), float(lat), float(lng)) <= (
            profile.service_radius_km * 1000
        )
    return False


# --------------------------------------------------------------------------- services / availability
def validate_service_data(data: dict, instance: SipaluService | None = None) -> None:
    price_type = data.get("price_type", getattr(instance, "price_type", None))
    price = data.get("price", getattr(instance, "price", None))
    visit_fee = data.get("visit_fee", getattr(instance, "visit_fee", None))
    minutes = data.get("estimated_minutes", getattr(instance, "estimated_minutes", None))
    check_price(price_type, price, visit_fee, minutes)


@transaction.atomic
def set_availability(profile: SipaluProfile, rules: list[dict]) -> list[AvailabilityRule]:
    """Replace the weekly rules (bulk PUT). Overlapping ranges on the same day are rejected."""
    by_day: dict[int, list] = {}
    for i, r in enumerate(rules):
        if r["start_time"] >= r["end_time"]:
            raise APIError("validation_error", fields={f"rules.{i}.end_time": ["End must be after start."]})
        by_day.setdefault(r["weekday"], []).append((r["start_time"], r["end_time"], i))
    for ranges in by_day.values():
        ranges.sort()
        for (_s1, e1, _i), (s2, _e2, j) in zip(ranges, ranges[1:], strict=False):
            if s2 < e1:
                raise APIError(
                    "validation_error", fields={f"rules.{j}.start_time": ["Overlaps another range."]}
                )
    profile.availability.all().delete()
    return AvailabilityRule.objects.bulk_create(
        [
            AvailabilityRule(
                profile=profile, weekday=r["weekday"], start_time=r["start_time"], end_time=r["end_time"]
            )
            for r in rules
        ]
    )


# --------------------------------------------------------------------------- completeness / onboarding
def _payment_done(worker) -> bool:
    if worker.payment_method == "bank":
        return bool(worker.bank_name and worker.bank_account_no)
    if worker.payment_method in ("esewa", "khalti"):
        return bool(worker.wallet_id)
    return False


def completeness(profile: SipaluProfile) -> dict:
    """Sipalu completeness: ``{percent, missing, items: [{key, done, optional, label}]}``.

    Portfolio is shown as an optional item and does not count towards the percentage.
    """
    w = profile.worker
    done = {
        "name": bool((w.full_name or "").strip()),
        "photo": bool(w.photo),
        "skills": w.skills.exists(),
        "languages": w.languages.exists(),
        "identity": bool((w.citizenship_no or w.nid_no) and w.id_front)
        or w.verification_status == "verified",
        "verified": w.verification_status == "verified",
        "headline": bool(profile.headline.strip() or profile.headline_ne.strip()),
        "services": profile.services.filter(is_active=True).exists(),
        "availability": profile.availability.exists(),
        "service_area": bool(service_district_codes(profile))
        or bool(profile.service_radius_km and profile.base_lat),
        "payment_details": _payment_done(w),
        "consent": profile.public_consent_at is not None,
        "portfolio": profile.portfolio.exists(),
    }
    items = [
        {
            "key": k,
            "done": done[k],
            "optional": k in OPTIONAL_KEYS,
            "label": labels.label(labels.COMPLETENESS, k),
        }
        for k in (*COMPLETENESS_KEYS, *OPTIONAL_KEYS)
    ]
    n = sum(1 for k in COMPLETENESS_KEYS if done[k])
    return {
        "percent": round(n * 100 / len(COMPLETENESS_KEYS)),
        "missing": [k for k in COMPLETENESS_KEYS if not done[k]],
        "items": items,
    }


STEP_DONE = {
    "name": lambda c: c["name"],
    "photo": lambda c: c["photo"],
    "skills": lambda c: c["skills"],
    "languages": lambda c: c["languages"],
    "service_area": lambda c: c["service_area"],
    "availability": lambda c: c["availability"],
    "services": lambda c: c["services"],
    "headline": lambda c: c["headline"],
    "payment": lambda c: c["payment_details"],
    "identity": lambda c: c["identity"],
    "consent": lambda c: c["consent"],
}


def onboarding_state(profile: SipaluProfile) -> dict:
    comp = completeness(profile)
    flags = {i["key"]: i["done"] for i in comp["items"]}
    completed = [s for s in ONBOARDING_STEPS if STEP_DONE[s](flags)]
    nxt = next((s for s in ONBOARDING_STEPS if s not in completed), None)
    return {"completed_steps": completed, "next_step": nxt, "completeness": comp}


# --------------------------------------------------------------------------- stats
def refresh_stats(profile: SipaluProfile) -> SipaluProfile:
    """Recompute jobs_completed, rating_avg/count (Ghardhani → Sipalu ratings, not voided) and the
    median response time (minutes from request to accept/decline, last 50 direct bookings)."""
    worker = profile.worker
    done = Q(status__in=("completed", "confirmed")) | Q(
        status="disputed", status_before_dispute__in=("completed", "confirmed")
    )
    profile.jobs_completed = Booking.objects.filter(sipalu=worker).filter(done).count()
    agg = BookingRating.objects.filter(booking__sipalu=worker, side="ghardhani", voided=False).aggregate(
        avg=Avg("score"), n=Count("id")
    )
    profile.rating_count = agg["n"] or 0
    profile.rating_avg = q2(D(agg["avg"])) if agg["avg"] is not None else None
    rows = list(
        Booking.objects.filter(sipalu=worker, source="direct", responded_at__isnull=False)
        .order_by("-created_at")
        .values_list("created_at", "responded_at")[:50]
    )
    minutes = [max((r - c).total_seconds() / 60, 0) for c, r in rows]
    profile.response_time_minutes = round(statistics.median(minutes)) if minutes else None
    profile.save(
        update_fields=["jobs_completed", "rating_avg", "rating_count", "response_time_minutes", "updated_at"]
    )
    return profile


def ghardhani_rating(user) -> dict:
    agg = BookingRating.objects.filter(booking__ghardhani=user, side="sipalu", voided=False).aggregate(
        avg=Avg("score"), n=Count("id")
    )
    return {"avg": f"{q2(D(agg['avg'])):.2f}" if agg["avg"] is not None else None, "count": agg["n"] or 0}


# --------------------------------------------------------------------------- Ghardhani
def ensure_ghardhani(user) -> GhardhaniProfile:
    profile = GhardhaniProfile.objects.filter(user=user).first()
    if profile is None:
        try:
            with transaction.atomic():
                profile = GhardhaniProfile.objects.create(
                    user=user,
                    display_name=user.full_name or "",
                    preferred_language=user.preferred_language or "ne",
                )
        except IntegrityError:
            profile = GhardhaniProfile.objects.get(user=user)
    return profile


def time_off_on(profile: SipaluProfile, day: dt.date) -> bool:
    return TimeOff.objects.filter(profile=profile, from_date__lte=day, to_date__gte=day).exists()


def portfolio_full(profile: SipaluProfile) -> bool:
    return PortfolioItem.objects.filter(profile=profile).count() >= PortfolioItem.MAX_ITEMS


def service_for(profile: SipaluProfile, service_id=None, trade_code=None) -> SipaluService | None:
    qs = profile.services.filter(is_active=True).select_related("trade")
    if service_id:
        return qs.filter(pk=service_id).first()
    if trade_code:
        return qs.filter(trade_id=trade_code).order_by("order", "price").first()
    return None
