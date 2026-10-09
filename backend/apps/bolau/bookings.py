"""Booking lifecycle (docs/CONTRACT-BOLAU.md §4). Every transition: row lock, allowed-previous-state
check, ``BookingEvent``, ``notify()`` and telemetry; fee handling via ``payments``.

    requested ──accept──▶ accepted ──on_the_way──▶ on_the_way ──arrive(code)──▶ arrived
        │  └─decline / expire / cancel                                         │
        ▼                                                     (visit_then_quote: quote → approve)
    declined | expired | cancelled                                   start ▼
                                           in_progress ──complete──▶ completed ──confirm──▶ confirmed
    accepted / on_the_way ──cancel──▶ cancelled · ──report-no-show──▶ no_show
    any of accepted … confirmed, no_show, cancelled ──dispute──▶ disputed
"""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import secrets

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core.exceptions import APIError, InvalidState
from apps.core.money import D, q2

from . import labels, notify, payments, profiles
from .availability import slot_problem
from .common import (
    AUTO_CONFIRM_AFTER,
    CONTACT_AFTER_COMPLETION,
    EXPIRE_BEFORE_START,
    MAX_MINUTES,
    MIN_MINUTES,
    NO_SHOW_GRACE,
    accept_timeout,
    error,
    free_cancel_window,
    invalid,
    new_code,
    quoted_price,
)
from .models import Address, Booking, BookingEvent, BookingRating, BookingReport, SipaluProfile
from .telemetry import track

SIPALU_CANCELLABLE = ("accepted", "on_the_way")
GHARDHANI_CANCELLABLE = ("requested", "accepted", "on_the_way")
DISPUTABLE = (
    "accepted",
    "on_the_way",
    "arrived",
    "in_progress",
    "completed",
    "confirmed",
    "no_show",
    "cancelled",
)
DISPUTE_DAYS = 14


# --------------------------------------------------------------------------- arrival code
def _arrival_digest(booking: Booking) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(),
        f"bolau-arrival:{booking.id}:{booking.arrival_nonce}".encode(),
        hashlib.sha256,
    ).hexdigest()


def arrival_code(booking: Booking) -> str | None:
    """The 4-digit code the Ghardhani reads out (derived, never stored in clear)."""
    if not booking.arrival_nonce:
        return None
    return f"{int(_arrival_digest(booking)[:8], 16) % 10000:04d}"


def _hash_code(booking: Booking, code: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), f"bolau-code:{booking.id}:{code}".encode(), hashlib.sha256
    ).hexdigest()


def _issue_arrival_code(booking: Booking) -> None:
    booking.arrival_nonce = secrets.token_hex(8)
    booking.arrival_code_hash = _hash_code(booking, arrival_code(booking))
    booking.arrival_attempts = 0


# --------------------------------------------------------------------------- visibility
def contact_visible(booking: Booking, now=None) -> bool:
    """Phones + exact address shared only from acceptance until 48 h after completion."""
    now = now or timezone.now()
    if booking.status not in Booking.CONTACT_STATUSES:
        return False
    if booking.completed_at and now > booking.completed_at + CONTACT_AFTER_COMPLETION:
        return False
    return True


def contact_visible_until(booking: Booking):
    if booking.status not in Booking.CONTACT_STATUSES:
        return None
    return booking.completed_at + CONTACT_AFTER_COMPLETION if booking.completed_at else None


def address_snapshot(address: Address) -> dict:
    d = address.district
    return {
        "label": address.label,
        "line": address.line,
        "ward": address.ward,
        "municipality": address.municipality,
        "district": {"code": d.code, "name_en": d.name_en, "name_ne": d.name_ne},
        "landmark": address.landmark or None,
        "lat": str(address.lat) if address.lat is not None else None,
        "lng": str(address.lng) if address.lng is not None else None,
    }


def coarse_address(address: Address) -> dict:
    d = address.district
    return {
        "ward": address.ward,
        "municipality": address.municipality,
        "district": {"code": d.code, "name_en": d.name_en, "name_ne": d.name_ne},
    }


def party_of(booking: Booking, user) -> str | None:
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    if booking.ghardhani_id == user.pk:
        return "ghardhani"
    if booking.sipalu.user_id and booking.sipalu.user_id == user.pk:
        return "sipalu"
    return None


# --------------------------------------------------------------------------- core transition
def _event(
    booking: Booking, from_status: str, to_status: str, *, by=None, party: str = "", note: str = ""
) -> None:
    BookingEvent.objects.create(
        booking=booking,
        from_status=from_status,
        to_status=to_status,
        by=by,
        by_party=party,
        note=(note or "")[:600],
    )


def _lock(booking_id) -> Booking:
    return (
        Booking.objects.select_for_update(of=("self",))
        .select_related("sipalu", "ghardhani", "trade", "address__district", "fee_charge", "service")
        .get(pk=booking_id)
    )


def _move(
    booking: Booking, to: str, allowed: tuple, *, by=None, party: str, note: str = "", fields=()
) -> str:
    if booking.status not in allowed:
        raise invalid()
    old = booking.status
    booking.status = to
    booking.save(update_fields=["status", "updated_at", *fields])
    _event(booking, old, to, by=by, party=party, note=note)
    track(
        "bolau_booking_status_changed",
        by,
        booking_id=str(booking.id),
        from_status=old,
        to_status=to,
        trade=booking.trade_id,
    )
    return old


def _refresh_sipalu(booking: Booking) -> None:
    """Sipalu stats now (same transaction); trust score via the debounced recompute."""
    profile = SipaluProfile.objects.filter(worker=booking.sipalu).first()
    if profile is not None:
        profiles.refresh_stats(profile)
    try:
        from apps.trust.services import schedule_recompute

        schedule_recompute(booking.sipalu_id)
    except Exception:  # noqa: BLE001 - trust must never block a booking
        pass


# --------------------------------------------------------------------------- create
def _parse_minutes(value, service) -> int:
    minutes = int(value or (service.estimated_minutes if service and service.estimated_minutes else 60))
    if minutes < MIN_MINUTES or minutes > MAX_MINUTES:
        raise APIError(
            "validation_error", fields={"estimated_minutes": [f"Between {MIN_MINUTES} and {MAX_MINUTES}."]}
        )
    return minutes


def _check_slot(profile, start, end, *, check_rules=True):
    problem = slot_problem(profile, start, end, check_rules=check_rules)
    if problem:
        code = "slot_taken" if problem == "slot_taken" else "invalid_state"
        raise error(code, problem, "scheduled_start", status_code=409 if problem == "slot_taken" else None)


def create_booking(user, data: dict, *, request=None) -> Booking:
    """``requested`` (or ``accepted`` straight away for an instant-booking Sipalu whose slot is free)."""
    with transaction.atomic():
        profile = (
            SipaluProfile.objects.select_for_update(of=("self",))
            .select_related("worker")
            .filter(handle=(data.get("sipalu_handle") or "").lower())
            .first()
        )
        if profile is None or not profiles.is_bookable(profile):
            raise error("invalid_state", "not_bookable", "sipalu_handle")
        if profile.worker.user_id and profile.worker.user_id == user.pk:
            raise error("invalid_state", "self_booking")
        address = (
            Address.objects.select_related("district")
            .filter(pk=data["address_id"], ghardhani=user, is_active=True)
            .first()
        )
        if address is None:
            raise error("validation_error", "address_not_found", "address_id")
        service = profiles.service_for(profile, data.get("service_id"), data.get("trade"))
        if service is None:
            raise error("validation_error", "service_not_found", "service_id")
        trade_code = service.trade_id
        minutes = _parse_minutes(data.get("estimated_minutes"), service)
        start = data["scheduled_start"]
        end = start + dt.timedelta(minutes=minutes)
        if not profiles.in_service_area(profile, address.district_id, address.lat, address.lng):
            raise error("invalid_state", "outside_area", "address_id")
        _check_slot(profile, start, end)
        booking = Booking(
            code=new_code("BK", Booking),
            ghardhani=user,
            sipalu=profile.worker,
            service=service,
            trade_id=trade_code,
            description=(data.get("description") or "")[:2000],
            address=address,
            scheduled_start=start,
            scheduled_end=end,
            estimated_minutes=minutes,
            price_type=service.price_type,
            quoted_price=quoted_price(service.price_type, service.price, service.visit_fee, minutes),
            visit_fee=service.visit_fee if service.price_type == "visit_then_quote" else None,
            source="direct",
            expires_at=min(timezone.now() + accept_timeout(), start - EXPIRE_BEFORE_START),
        )
        try:
            with transaction.atomic():
                booking.save()
        except IntegrityError as exc:  # exclusion constraint: a concurrent booking took the slot
            raise error("slot_taken", "slot_taken", "scheduled_start", status_code=409) from exc
        _event(booking, "", "requested", by=user, party="ghardhani")
        profiles.ensure_ghardhani(user)
        track(
            "bolau_booking_requested",
            user,
            booking_id=str(booking.id),
            trade=trade_code,
            price_type=booking.price_type,
            instant=profile.instant_booking,
        )
        if profile.instant_booking:
            _accept(booking, by=None, party="system", note="instant booking")
            notify.to_sipalu(booking, "booking_instant")
            notify.to_ghardhani(booking, "booking_accepted")
        else:
            notify.to_sipalu(booking, "booking_requested")
    return booking


# --------------------------------------------------------------------------- Sipalu actions
def _accept(booking: Booking, *, by, party: str, note: str = "") -> None:
    """requested → accepted: snapshot address, issue arrival code, open the booking fee."""
    now = timezone.now()
    booking.accepted_at = now
    if booking.source == "direct" and booking.responded_at is None and party == "sipalu":
        booking.responded_at = now
    booking.address_snapshot = address_snapshot(booking.address)
    _issue_arrival_code(booking)
    payments.open_fee(booking)
    _move(
        booking,
        "accepted",
        ("requested",),
        by=by,
        party=party,
        note=note,
        fields=(
            "accepted_at",
            "responded_at",
            "address_snapshot",
            "arrival_nonce",
            "arrival_code_hash",
            "arrival_attempts",
            "fee_charge",
            "booking_fee",
            "booking_fee_status",
        ),
    )


@transaction.atomic
def accept(booking: Booking, user) -> Booking:
    booking = _lock(booking.pk)
    if booking.status == "requested" and booking.expires_at and booking.expires_at <= timezone.now():
        _expire(booking)
        raise invalid()
    _accept(booking, by=user, party="sipalu")
    notify.to_ghardhani(booking, "booking_accepted")
    _refresh_sipalu(booking)
    return booking


@transaction.atomic
def decline(booking: Booking, user, reason: str = "") -> Booking:
    booking = _lock(booking.pk)
    booking.responded_at = timezone.now()
    booking.decline_reason = (reason or "")[:500]
    _move(
        booking,
        "declined",
        ("requested",),
        by=user,
        party="sipalu",
        note=reason,
        fields=("responded_at", "decline_reason"),
    )
    notify.to_ghardhani(booking, "booking_declined")
    _refresh_sipalu(booking)
    return booking


def _expire(booking: Booking) -> None:
    payments.settle_fee(booking, refundable=True)
    _move(
        booking, "expired", ("requested",), party="system", fields=("booking_fee_status", "fee_refund_manual")
    )
    notify.to_ghardhani(booking, "booking_expired")


@transaction.atomic
def on_the_way(booking: Booking, user) -> Booking:
    booking = _lock(booking.pk)
    booking.on_the_way_at = timezone.now()
    _move(booking, "on_the_way", ("accepted",), by=user, party="sipalu", fields=("on_the_way_at",))
    notify.to_ghardhani(booking, "booking_on_the_way")
    return booking


def arrive(booking: Booking, user, code: str) -> Booking:
    """on_the_way (or accepted) → arrived, only with the Ghardhani's 4-digit code; 5 tries."""
    with transaction.atomic():
        booking = _lock(booking.pk)
        if booking.status not in ("accepted", "on_the_way"):
            raise invalid()
        if booking.arrival_attempts >= Booking.ARRIVAL_MAX_TRIES:
            raise error("arrival_code_locked", "arrival_code_locked", "code", status_code=423)
        ok = bool(code) and hmac.compare_digest(
            _hash_code(booking, str(code).strip()), booking.arrival_code_hash
        )
        if not ok:
            booking.arrival_attempts += 1
            booking.save(update_fields=["arrival_attempts", "updated_at"])
            left = Booking.ARRIVAL_MAX_TRIES - booking.arrival_attempts
            msg = labels.message("arrival_code_invalid")
            locked = left <= 0
            exc = APIError(
                "arrival_code_locked" if locked else "arrival_code_invalid",
                message=labels.message("arrival_code_locked") if locked else msg,
                fields={"code": [msg]},
                status_code=423 if locked else 400,
            )
            exc.fields["attempts_left"] = [str(max(left, 0))]
        else:
            exc = None
            booking.arrival_verified_at = timezone.now()
            if not booking.on_the_way_at:
                booking.on_the_way_at = booking.arrival_verified_at
            _move(
                booking,
                "arrived",
                ("accepted", "on_the_way"),
                by=user,
                party="sipalu",
                fields=("arrival_verified_at", "on_the_way_at"),
            )
            notify.to_ghardhani(booking, "booking_arrived")
    if exc is not None:  # raised outside the atomic block so the attempt counter is kept
        raise exc
    return booking


@transaction.atomic
def propose_quote(booking: Booking, user, amount) -> Booking:
    booking = _lock(booking.pk)
    if (
        booking.price_type != "visit_then_quote"
        or booking.status != "arrived"
        or booking.quote_status == "approved"
    ):
        raise invalid()
    amount = q2(D(amount))
    if amount <= 0:
        raise APIError("validation_error", fields={"amount": ["Must be more than zero."]})
    booking.quote_amount = amount
    booking.quote_status = "proposed"
    booking.save(update_fields=["quote_amount", "quote_status", "updated_at"])
    _event(booking, booking.status, booking.status, by=user, party="sipalu", note=f"quote {amount}")
    notify.to_ghardhani(booking, "booking_quote", amount=f"Rs {amount}")
    return booking


@transaction.atomic
def decide_quote(booking: Booking, user, approve: bool) -> Booking:
    booking = _lock(booking.pk)
    if booking.quote_status != "proposed" or booking.status != "arrived":
        raise invalid()
    if approve:
        booking.quote_status = "approved"
        booking.save(update_fields=["quote_status", "updated_at"])
        _event(booking, "arrived", "arrived", by=user, party="ghardhani", note="quote approved")
        notify.to_sipalu(booking, "booking_quote_approved")
    else:
        # Quote declined: the visit ends here and only the visit fee is due.
        now = timezone.now()
        booking.quote_status = "rejected"
        booking.final_price = booking.visit_fee or D("0")
        booking.completed_at = now
        booking.completion_note = "Quote declined — visit fee only."
        _move(
            booking,
            "completed",
            ("arrived",),
            by=user,
            party="ghardhani",
            note="quote declined",
            fields=("quote_status", "final_price", "completed_at", "completion_note"),
        )
        notify.to_sipalu(booking, "booking_quote_rejected")
    return booking


@transaction.atomic
def start(booking: Booking, user) -> Booking:
    booking = _lock(booking.pk)
    if (
        booking.status == "arrived"
        and booking.price_type == "visit_then_quote"
        and booking.quote_status != "approved"
    ):
        raise invalid("quote_required")
    booking.started_at = timezone.now()
    _move(booking, "in_progress", ("arrived",), by=user, party="sipalu", fields=("started_at",))
    notify.to_ghardhani(booking, "booking_started")
    return booking


@transaction.atomic
def complete(booking: Booking, user, final_price=None, note: str = "") -> Booking:
    booking = _lock(booking.pk)
    if booking.status != "in_progress":
        raise invalid()
    if booking.price_type == "visit_then_quote":
        cap = booking.quote_amount or booking.quoted_price
    else:
        cap = booking.quoted_price
    if final_price is None:
        final = cap
    else:
        final = q2(D(final_price))
        if final > cap and booking.price_type != "hourly":
            raise error("validation_error", "final_above_quote", "final_price")
        if final > cap and booking.price_type == "hourly":
            # Hourly work may run longer than estimated, never beyond the hourly rate × time worked.
            worked_min = max(
                (timezone.now() - (booking.started_at or timezone.now())).total_seconds() / 60, 0
            )
            rate = booking.service.price if booking.service else cap
            if final > q2(D(rate) * D(max(worked_min, booking.estimated_minutes)) / D(60)):
                raise error("validation_error", "final_above_quote", "final_price")
    booking.final_price = final
    booking.completed_at = timezone.now()
    booking.completion_note = (note or "")[:600]
    _move(
        booking,
        "completed",
        ("in_progress",),
        by=user,
        party="sipalu",
        note=note,
        fields=("final_price", "completed_at", "completion_note"),
    )
    notify.to_ghardhani(booking, "booking_completed")
    _refresh_sipalu(booking)
    return booking


# --------------------------------------------------------------------------- Ghardhani actions
@transaction.atomic
def confirm(booking: Booking, user=None, *, auto: bool = False) -> Booking:
    booking = _lock(booking.pk)
    booking.confirmed_at = timezone.now()
    _move(
        booking,
        "confirmed",
        ("completed",),
        by=user,
        party="system" if auto else "ghardhani",
        note="auto-confirmed after 24 h" if auto else "",
        fields=("confirmed_at",),
    )
    notify.to_ghardhani(booking, "booking_confirmed")
    notify.to_sipalu(booking, "booking_confirmed")
    _refresh_sipalu(booking)
    return booking


def _is_late(booking: Booking, now) -> bool:
    return booking.status != "requested" and booking.scheduled_start - now < free_cancel_window()


@transaction.atomic
def cancel(booking: Booking, user, party: str, reason: str = "") -> Booking:
    """Ghardhani: free until ``BOLAU_FREE_CANCEL_HOURS`` before start (fee refunded / waived); later →
    ``late_cancellation`` (flagged, fee kept). Sipalu (after accepting) or ops: fee always refunded.
    No charge to the Sipalu ever."""
    booking = _lock(booking.pk)
    allowed = {"ghardhani": GHARDHANI_CANCELLABLE, "sipalu": SIPALU_CANCELLABLE, "ops": Booking.ACTIVE}[party]
    if booking.status not in allowed:
        raise invalid()
    now = timezone.now()
    late = party == "ghardhani" and _is_late(booking, now)
    booking.cancelled_by = party
    booking.cancel_reason = (reason or "")[:500]
    booking.cancelled_at = now
    booking.late_cancellation = late
    payments.settle_fee(booking, refundable=not late)
    _move(
        booking,
        "cancelled",
        allowed,
        by=user,
        party=party,
        note=reason,
        fields=(
            "cancelled_by",
            "cancel_reason",
            "cancelled_at",
            "late_cancellation",
            "booking_fee_status",
            "fee_refund_manual",
        ),
    )
    if party != "sipalu":
        notify.to_sipalu(booking, "booking_cancelled")
    if party != "ghardhani":
        notify.to_ghardhani(booking, "booking_cancelled")
    from . import risk

    risk.check_cancellations(booking)
    _refresh_sipalu(booking)
    return booking


@transaction.atomic
def report_no_show(booking: Booking, user, note: str = "") -> Booking:
    booking = _lock(booking.pk)
    if booking.status not in ("accepted", "on_the_way"):
        raise invalid()
    if timezone.now() < booking.scheduled_start + NO_SHOW_GRACE:
        raise invalid("no_show_too_early")
    payments.settle_fee(booking, refundable=True)
    _move(
        booking,
        "no_show",
        ("accepted", "on_the_way"),
        by=user,
        party="ghardhani",
        note=note,
        fields=("booking_fee_status", "fee_refund_manual"),
    )
    notify.to_sipalu(booking, "booking_no_show")
    from . import risk

    risk.check_cancellations(booking)
    _refresh_sipalu(booking)
    return booking


@transaction.atomic
def mark_paid(booking: Booking, user, party: str, method: str) -> Booking:
    """Either side marks the direct payment to the Sipalu (KaamSathi never holds it)."""
    booking = _lock(booking.pk)
    if booking.status not in ("arrived", "in_progress", "completed", "confirmed", "disputed"):
        raise invalid()
    now = timezone.now()
    fields = ["payment_method_to_sipalu", "paid_to_sipalu_marked_by", "paid_to_sipalu_at", "updated_at"]
    if party == "ghardhani":
        booking.paid_marked_by_ghardhani_at, booking.paid_method_ghardhani = now, method
        fields += ["paid_marked_by_ghardhani_at", "paid_method_ghardhani"]
    else:
        booking.paid_marked_by_sipalu_at, booking.paid_method_sipalu = now, method
        fields += ["paid_marked_by_sipalu_at", "paid_method_sipalu"]
    booking.payment_method_to_sipalu = method
    booking.paid_to_sipalu_marked_by = user
    booking.paid_to_sipalu_at = booking.paid_to_sipalu_at or now
    booking.save(update_fields=fields)
    _event(booking, booking.status, booking.status, by=user, party=party, note=f"paid to Sipalu ({method})")
    if party == "ghardhani":
        notify.to_sipalu(booking, "booking_paid")
    else:
        notify.to_ghardhani(booking, "booking_paid")
    return booking


def payment_state(booking: Booking) -> dict:
    g, s = booking.paid_marked_by_ghardhani_at, booking.paid_marked_by_sipalu_at
    return {
        "method": booking.payment_method_to_sipalu,
        "ghardhani_marked_at": g.isoformat() if g else None,
        "ghardhani_method": booking.paid_method_ghardhani,
        "sipalu_marked_at": s.isoformat() if s else None,
        "sipalu_method": booking.paid_method_sipalu,
        "agreed": bool(g and s),
    }


# --------------------------------------------------------------------------- disputes, ratings, reports
@transaction.atomic
def raise_dispute(booking: Booking, user, party: str, description: str):
    from apps.trust.models import Dispute

    booking = _lock(booking.pk)
    if booking.status not in DISPUTABLE:
        raise invalid()
    if timezone.now() - booking.updated_at > dt.timedelta(days=DISPUTE_DAYS) and booking.status in (
        "confirmed",
        "cancelled",
        "no_show",
    ):
        raise invalid()
    if (
        Dispute.objects.filter(booking=booking)
        .exclude(status__in=("resolved", "rejected", "appeal_resolved"))
        .exists()
    ):
        raise invalid("dispute_open")
    dispute = Dispute.objects.create(
        worker=booking.sipalu,
        organization=None,
        booking=booking,
        kind="booking",
        description=f"[{booking.code} · raised by {party}] {description}"[:4000],
    )
    booking.status_before_dispute = booking.status
    _move(
        booking,
        "disputed",
        DISPUTABLE,
        by=user,
        party=party,
        note="dispute raised",
        fields=("status_before_dispute",),
    )
    notify.to_ghardhani(booking, "booking_disputed")
    notify.to_sipalu(booking, "booking_disputed")
    return dispute


def rate(booking: Booking, user, party: str, data: dict, *, request=None) -> BookingRating:
    from . import risk

    status = booking.status_before_dispute if booking.status == "disputed" else booking.status
    if status != "confirmed":
        raise invalid("rate_after_confirm")
    allowed_tags = labels.SIPALU_TAGS if party == "ghardhani" else labels.GHARDHANI_TAGS
    tags = [t for t in (data.get("tags") or []) if t in allowed_tags]
    bad = [t for t in (data.get("tags") or []) if t not in allowed_tags]
    if bad:
        raise APIError(
            "validation_error", fields={"tags": [f"Unknown tag(s): {', '.join(map(str, bad))[:200]}"]}
        )
    try:
        with transaction.atomic():
            rating = BookingRating.objects.create(
                booking=booking,
                side=party,
                rater=user,
                score=int(data["score"]),
                comment=(data.get("comment") or "")[:600],
                tags=tags,
                device_hash=risk.device_hash(request),
                address_hash=booking.address.line_hash if party == "ghardhani" else "",
            )
    except IntegrityError as exc:
        raise InvalidState(code="duplicate", message=labels.message("already_rated")) from exc
    track("bolau_rating_submitted", user, booking_id=str(booking.id), role=party, score=rating.score)
    if party == "ghardhani":
        _refresh_sipalu(booking)
        risk.check_review(rating)
    return rating


def report(booking: Booking, user, party: str, reason: str, note: str = "") -> BookingReport:
    from . import risk

    obj, created = BookingReport.objects.get_or_create(
        booking=booking,
        reporter=user,
        reason=reason,
        defaults={"reporter_side": party, "note": (note or "")[:1000]},
    )
    if created:
        risk.check_report(obj)
    return obj


# --------------------------------------------------------------------------- periodic
def expire_due(now=None) -> int:
    now = now or timezone.now()
    n = 0
    for pk in Booking.objects.filter(status="requested", expires_at__lte=now).values_list("pk", flat=True):
        with transaction.atomic():
            booking = _lock(pk)
            if booking.status == "requested" and booking.expires_at and booking.expires_at <= now:
                _expire(booking)
                n += 1
                _refresh_sipalu(booking)
    return n


def auto_confirm_due(now=None) -> int:
    now = now or timezone.now()
    n = 0
    for b in Booking.objects.filter(status="completed", completed_at__lte=now - AUTO_CONFIRM_AFTER):
        try:
            confirm(b, None, auto=True)
            n += 1
        except InvalidState:
            continue
    return n


def send_reminders(now=None) -> int:
    """One reminder ~1 h before start to both sides of accepted bookings."""
    now = now or timezone.now()
    n = 0
    qs = Booking.objects.filter(
        status="accepted",
        reminder_sent_at__isnull=True,
        scheduled_start__gt=now,
        scheduled_start__lte=now + dt.timedelta(minutes=65),
    ).select_related("sipalu__user", "ghardhani", "trade")
    for b in qs:
        updated = Booking.objects.filter(pk=b.pk, reminder_sent_at__isnull=True).update(reminder_sent_at=now)
        if updated:
            notify.to_ghardhani(b, "booking_reminder")
            notify.to_sipalu(b, "booking_reminder")
            n += 1
    return n
