"""Kaam requests & offers (docs/CONTRACT-BOLAU.md §5).

A Ghardhani posts a request (trade, window, address, ≤ 4 photos); up to 20 best-matching bookable
Sipalu are notified (rate-limited per Sipalu). The first three verified, in-area Sipalu may send one
offer each (DB: ``slot`` 1–3 unique per request + one offer per Sipalu); the fourth gets
``request_full``. Accepting an offer creates an ``accepted`` Booking (source=request) and rejects the
other offers. Sipalu only ever see ward / municipality / district — never the exact address.
"""

from __future__ import annotations

import datetime as dt

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.core.exceptions import APIError
from apps.core.money import D, q2

from . import bookings, notify, profiles
from .availability import on_time_off, overlapping
from .common import EXPIRE_BEFORE_START, REQUEST_TTL, check_price, error, invalid, new_code, quoted_price
from .models import Address, Booking, KaamRequest, KaamRequestPhoto, Offer, SipaluProfile
from .telemetry import track

NOTIFY_LIMIT = 20
NOTIFY_PER_SIPALU_PER_HOUR = 5


def _rate_ok(worker_id) -> bool:
    key = f"ks:bolau:req-notify:{worker_id}:{timezone.now():%Y%m%d%H}"
    try:
        if cache.add(key, 1, 3600):
            return True
        return cache.incr(key) <= NOTIFY_PER_SIPALU_PER_HOUR
    except Exception:  # noqa: BLE001 - cache down: still notify
        return True


def eligible_profiles(req: KaamRequest):
    """Bookable Sipalu whose trades include the request's trade and whose area covers its address."""
    out = []
    for p in (
        profiles.bookable_profiles()
        .filter(  # trade via skills or active services
            Q(worker__skills__trade_id=req.trade_id)
            | Q(services__trade_id=req.trade_id, services__is_active=True)
        )
        .distinct()
        .select_related("worker__user")
        .exclude(worker__user=req.ghardhani)
    ):
        addr = req.address
        if profiles.in_service_area(p, addr.district_id, addr.lat, addr.lng):
            out.append(p)
    return out


def _rank(p: SipaluProfile) -> tuple:
    rating = float(p.rating_avg or 0)
    return (-(rating * min(p.rating_count, 10)), -p.jobs_completed, p.response_time_minutes or 9999)


@transaction.atomic
def create_request(user, data: dict, photos=()) -> KaamRequest:
    address = (
        Address.objects.select_related("district")
        .filter(pk=data["address_id"], ghardhani=user, is_active=True)
        .first()
    )
    if address is None:
        raise error("validation_error", "address_not_found", "address_id")
    start, end = data["preferred_window_start"], data["preferred_window_end"]
    now = timezone.now()
    if end <= start or end <= now or end - start > dt.timedelta(days=14):
        raise error("validation_error", "window_invalid", "preferred_window_end")
    if len(photos) > KaamRequest.MAX_PHOTOS:
        raise error("validation_error", "too_many_photos", "photos")
    req = KaamRequest.objects.create(
        code=new_code("KR", KaamRequest),
        ghardhani=user,
        trade_id=data["trade"],
        title=data["title"][:120],
        description=(data.get("description") or "")[:2000],
        address=address,
        preferred_window_start=start,
        preferred_window_end=end,
        budget_max=data.get("budget_max"),
        expires_at=now + REQUEST_TTL,
    )
    for f in photos:
        KaamRequestPhoto.objects.create(request=req, image=f)
    profiles.ensure_ghardhani(user)
    track("bolau_request_posted", user, request_id=str(req.id), trade=req.trade_id)
    transaction.on_commit(lambda: notify_matches(req))
    return req


def notify_matches(req: KaamRequest) -> int:
    """Instant notify up to 20 best-matching Sipalu (rate-limited per Sipalu)."""
    req = KaamRequest.objects.select_related("address__district", "trade", "ghardhani").get(pk=req.pk)
    sent = 0
    for p in sorted(eligible_profiles(req), key=_rank):
        if sent >= NOTIFY_LIMIT:
            break
        if p.worker.user is None or not _rate_ok(p.worker_id):
            continue
        notify.send(
            p.worker.user,
            "request_new",
            link=f"/bolau/requests/{req.id}",
            data={"request_id": str(req.id), "code": req.code},
            code=req.code,
            trade=req.trade.name_en,
        )
        sent += 1
    KaamRequest.objects.filter(pk=req.pk).update(notified_count=sent)
    return sent


def can_see_request(profile: SipaluProfile | None, req: KaamRequest) -> bool:
    if profile is None or not profiles.is_bookable(profile):
        return False
    if req.trade_id not in profiles.sipalu_trade_codes(profile):
        return False
    a = req.address
    return profiles.in_service_area(profile, a.district_id, a.lat, a.lng)


def nearby(profile: SipaluProfile, trade: str | None = None):
    now = timezone.now()
    trades = profiles.sipalu_trade_codes(profile)
    if trade:
        trades &= {trade}
    qs = (
        KaamRequest.objects.filter(status__in=KaamRequest.OPEN, expires_at__gt=now, trade_id__in=trades)
        .exclude(ghardhani_id=profile.worker.user_id)
        .select_related("address__district", "trade")
        .prefetch_related("photos")
        .order_by("-created_at")
    )
    return [
        r
        for r in qs
        if profiles.in_service_area(profile, r.address.district_id, r.address.lat, r.address.lng)
    ]


def make_offer(profile: SipaluProfile, req: KaamRequest, data: dict) -> Offer:
    price_type = data["price_type"]
    check_price(price_type, data["price"], data.get("visit_fee"), data.get("estimated_minutes"))
    minutes = int(data.get("estimated_minutes") or 60)
    with transaction.atomic():
        req = KaamRequest.objects.select_for_update(of=("self",)).select_related("address").get(pk=req.pk)
        if req.status not in KaamRequest.OPEN or req.expires_at <= timezone.now():
            raise invalid("request_closed")
        if not can_see_request(profile, req):
            raise error("invalid_state", "not_in_area_or_trade")
        if Offer.objects.filter(request=req, sipalu=profile.worker).exists():
            raise error("duplicate", "already_offered")
        count = Offer.objects.filter(request=req).count()
        if count >= Offer.MAX_PER_REQUEST:
            raise error("request_full", "request_full")
        start = data["proposed_start"]
        end = start + dt.timedelta(minutes=minutes)
        if not (req.preferred_window_start <= start <= req.preferred_window_end):
            raise APIError(
                "validation_error", fields={"proposed_start": ["Inside the Ghardhani's preferred window."]}
            )
        if start < timezone.now() + dt.timedelta(minutes=60):
            raise error("invalid_state", "lead_time", "proposed_start")
        if on_time_off(profile, start, end):
            raise error("invalid_state", "time_off", "proposed_start")
        if overlapping(profile.worker, start, end).exists():
            raise error("slot_taken", "slot_taken", "proposed_start", status_code=409)
        try:
            with transaction.atomic():
                offer = Offer.objects.create(
                    request=req,
                    sipalu=profile.worker,
                    slot=count + 1,
                    price_type=price_type,
                    price=q2(D(data["price"])),
                    visit_fee=data.get("visit_fee"),
                    estimated_minutes=minutes,
                    message=(data.get("message") or "")[:600],
                    proposed_start=start,
                )
        except IntegrityError as exc:  # raced: slot taken by another Sipalu / duplicate
            if Offer.objects.filter(request=req, sipalu=profile.worker).exists():
                raise error("duplicate", "already_offered") from exc
            raise error("request_full", "request_full") from exc
        if req.status == "open":
            req.status = "offers_received"
            req.save(update_fields=["status", "updated_at"])
        track("bolau_offer_sent", profile.worker.user, request_id=str(req.id), price_type=price_type)
        notify.send(
            req.ghardhani,
            "offer_new",
            link=f"/ghar/requests/{req.id}",
            data={"request_id": str(req.id), "offer_id": str(offer.id)},
            code=req.code,
            name=(profile.worker.full_name or "").split(" ")[0],
            amount=f"Rs {offer.price}",
        )
    return offer


@transaction.atomic
def withdraw_offer(offer: Offer) -> Offer:
    offer = Offer.objects.select_for_update().get(pk=offer.pk)
    if offer.status != "pending":
        raise invalid()
    offer.status = "withdrawn"
    offer.save(update_fields=["status", "updated_at"])
    return offer


@transaction.atomic
def accept_offer(user, req: KaamRequest, offer: Offer) -> Booking:
    req = (
        KaamRequest.objects.select_for_update(of=("self",)).select_related("address__district").get(pk=req.pk)
    )
    offer = (
        Offer.objects.select_for_update(of=("self",)).select_related("sipalu").get(pk=offer.pk, request=req)
    )
    if req.status not in KaamRequest.OPEN or offer.status != "pending":
        raise invalid()
    profile = SipaluProfile.objects.filter(worker=offer.sipalu).first()
    if profile is None or not profiles.is_bookable(profile):
        raise error("invalid_state", "not_bookable")
    start = offer.proposed_start
    end = start + dt.timedelta(minutes=offer.estimated_minutes)
    if start <= timezone.now():
        raise error("invalid_state", "lead_time")
    if overlapping(offer.sipalu, start, end).exists():
        raise error("slot_taken", "slot_taken", status_code=409)
    booking = Booking(
        code=new_code("BK", Booking),
        ghardhani=user,
        sipalu=offer.sipalu,
        service=None,
        trade_id=req.trade_id,
        description=f"{req.title}\n{req.description}".strip()[:2000],
        address=req.address,
        scheduled_start=start,
        scheduled_end=end,
        estimated_minutes=offer.estimated_minutes,
        price_type=offer.price_type,
        quoted_price=quoted_price(offer.price_type, offer.price, offer.visit_fee, offer.estimated_minutes),
        visit_fee=offer.visit_fee if offer.price_type == "visit_then_quote" else None,
        source="request",
        request=req,
        offer=offer,
        expires_at=start - EXPIRE_BEFORE_START,
    )
    try:
        with transaction.atomic():
            booking.save()
    except IntegrityError as exc:
        raise error("slot_taken", "slot_taken", status_code=409) from exc
    bookings._event(
        booking, "", "requested", by=user, party="ghardhani", note=f"offer from request {req.code}"
    )
    bookings._accept(booking, by=user, party="ghardhani", note="offer accepted")
    offer.status = "accepted"
    offer.save(update_fields=["status", "updated_at"])
    for other in (
        Offer.objects.filter(request=req, status="pending")
        .exclude(pk=offer.pk)
        .select_related("sipalu__user")
    ):
        other.status = "rejected"
        other.save(update_fields=["status", "updated_at"])
        if other.sipalu.user:
            notify.send(other.sipalu.user, "offer_rejected", data={"request_id": str(req.id)}, code=req.code)
    req.status = "booked"
    req.save(update_fields=["status", "updated_at"])
    track("bolau_offer_accepted", user, request_id=str(req.id), booking_id=str(booking.id))
    notify.to_sipalu(booking, "offer_accepted")
    return booking


@transaction.atomic
def cancel_request(req: KaamRequest) -> KaamRequest:
    req = KaamRequest.objects.select_for_update().get(pk=req.pk)
    if req.status not in KaamRequest.OPEN:
        raise invalid()
    req.status = "cancelled"
    req.cancelled_at = timezone.now()
    req.save(update_fields=["status", "cancelled_at", "updated_at"])
    Offer.objects.filter(request=req, status="pending").update(status="rejected", updated_at=timezone.now())
    return req


def expire_due(now=None) -> int:
    now = now or timezone.now()
    n = 0
    for req in KaamRequest.objects.filter(status__in=KaamRequest.OPEN, expires_at__lte=now).select_related(
        "ghardhani"
    ):
        with transaction.atomic():
            updated = KaamRequest.objects.filter(pk=req.pk, status__in=KaamRequest.OPEN).update(
                status="expired", updated_at=now
            )
            if updated:
                Offer.objects.filter(request=req, status="pending").update(status="expired", updated_at=now)
                notify.send(req.ghardhani, "request_expired", data={"request_id": str(req.id)}, code=req.code)
                n += 1
    # Offers whose proposed start has passed on still-open requests.
    Offer.objects.filter(status="pending", proposed_start__lte=now).update(status="expired", updated_at=now)
    return n
