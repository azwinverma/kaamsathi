"""Bolau side of the privacy workflow (docs/CONTRACT-ECOSYSTEM.md §11), called from
``apps.privacy.services``.

Export: everything Bolau holds about a household (Ghardhani = the ``User``) and about a Sipalu (the
``Worker``), without the other party's personal details (a Sipalu's copy never carries the
household's exact address or phone; a household's copy only names the Sipalu by public handle).
Uploaded photos are listed by presence only, as in the rest of the export.

Erasure: a deleted Sipalu leaves the marketplace at once (not bookable, no public page, handle
released, open work cancelled and households told) and their own Bolau content is removed; a deleted
household's addresses and free text are scrubbed. Bookings, fees, disputes and safety cases are kept
(accounting and dispute handling need them), linked to the anonymised person, the same way payroll
and attendance are kept for workers.
"""

from __future__ import annotations

import secrets

from django.db import transaction

from apps.core.exceptions import InvalidState

from .common import iso, money
from .models import (
    Address,
    Booking,
    BookingRating,
    BookingReport,
    Favourite,
    GhardhaniProfile,
    KaamRequest,
    Offer,
    SipaluProfile,
)

# Not finished and not started: cancelled (fee refunded) when either party is deleted. Work already
# under way (arrived / in progress) is left for ops to close by hand.
OPEN_STATUSES = ("requested", "accepted", "on_the_way")


# --------------------------------------------------------------------------- export helpers
def _trade(code):
    return code or None


def _booking_common(b: Booking) -> dict:
    return {
        "id": str(b.id),
        "code": b.code,
        "status": b.status,
        "source": b.source,
        "trade": _trade(b.trade_id),
        "scheduled_start": iso(b.scheduled_start),
        "scheduled_end": iso(b.scheduled_end),
        "price_type": b.price_type,
        "quoted_price": money(b.quoted_price),
        "visit_fee": money(b.visit_fee),
        "quote_amount": money(b.quote_amount),
        "final_price": money(b.final_price),
        "cancelled_by": b.cancelled_by,
        "cancel_reason": b.cancel_reason or None,
        "late_cancellation": b.late_cancellation,
        "decline_reason": b.decline_reason or None,
        "completion_note": b.completion_note or None,
        "payment_to_sipalu": {
            "method": b.payment_method_to_sipalu,
            "ghardhani_marked_at": iso(b.paid_marked_by_ghardhani_at),
            "ghardhani_method": b.paid_method_ghardhani,
            "sipalu_marked_at": iso(b.paid_marked_by_sipalu_at),
            "sipalu_method": b.paid_method_sipalu,
        },
        "created_at": iso(b.created_at),
        "accepted_at": iso(b.accepted_at),
        "completed_at": iso(b.completed_at),
        "confirmed_at": iso(b.confirmed_at),
        "cancelled_at": iso(b.cancelled_at),
    }


def _rating(r: BookingRating) -> dict:
    return {
        "booking_code": r.booking.code,
        "side": r.side,
        "score": r.score,
        "comment": r.comment or None,
        "tags": r.tags,
        "comment_status": r.comment_status,
        "voided": r.voided,
        "created_at": iso(r.created_at),
    }


def _dispute(d) -> dict:
    return {
        "id": str(d.id),
        "booking_code": d.booking.code if d.booking_id else None,
        "status": d.status,
        "description": d.description,
        "resolution_note": d.resolution_note,
        "raised_at": iso(d.raised_at),
        "resolved_at": iso(d.resolved_at),
        "appeal_reason": d.appeal_reason,
        "appeal_outcome": d.appeal_outcome,
        "appeal_resolution_note": d.appeal_resolution_note,
    }


# --------------------------------------------------------------------------- export
def export_household(user) -> dict | None:
    """The household's Bolau data, or None when the user never used Bolau as a Ghardhani."""
    from apps.support.models import SupportCase
    from apps.trust.models import Dispute

    gh = GhardhaniProfile.objects.filter(user=user).first()
    addresses = list(Address.objects.filter(ghardhani=user).select_related("district").order_by("created_at"))
    bookings = list(
        Booking.objects.filter(ghardhani=user)
        .select_related("sipalu__sipalu", "address")
        .order_by("created_at")
    )
    requests = list(
        KaamRequest.objects.filter(ghardhani=user).prefetch_related("photos").order_by("created_at")
    )
    if gh is None and not (addresses or bookings or requests):
        return None
    return {
        "profile": (
            {"display_name": gh.display_name, "preferred_language": gh.preferred_language} if gh else None
        ),
        "addresses": [
            {
                "id": str(a.id),
                "label": a.label,
                "line": a.line,
                "ward": a.ward,
                "municipality": a.municipality,
                "district": a.district_id,
                "landmark": a.landmark or None,
                "lat": str(a.lat) if a.lat is not None else None,
                "lng": str(a.lng) if a.lng is not None else None,
                "is_default": a.is_default,
                "is_active": a.is_active,
                "created_at": iso(a.created_at),
            }
            for a in addresses
        ],
        "favourites": list(
            Favourite.objects.filter(ghardhani=user)
            .values_list("profile__handle", flat=True)
            .order_by("created_at")
        ),
        "bookings": [
            {
                **_booking_common(b),
                "sipalu_handle": getattr(getattr(b.sipalu, "sipalu", None), "handle", None),
                "address_id": str(b.address_id),
                "description": b.description or None,
                "booking_fee": money(b.booking_fee),
                "booking_fee_status": b.booking_fee_status,
                "fee_paid_at": iso(b.fee_paid_at),
            }
            for b in bookings
        ],
        "kaam_requests": [
            {
                "id": str(r.id),
                "code": r.code,
                "trade": _trade(r.trade_id),
                "title": r.title,
                "description": r.description or None,
                "address_id": str(r.address_id),
                "preferred_window_start": iso(r.preferred_window_start),
                "preferred_window_end": iso(r.preferred_window_end),
                "budget_max": money(r.budget_max),
                "status": r.status,
                "photos": len(r.photos.all()),  # presence only; files are not in the bundle
                "created_at": iso(r.created_at),
            }
            for r in requests
        ],
        "ratings_given": [
            _rating(r)
            for r in BookingRating.objects.filter(booking__ghardhani=user, side="ghardhani").select_related(
                "booking"
            )
        ],
        "ratings_received": [
            _rating(r)
            for r in BookingRating.objects.filter(booking__ghardhani=user, side="sipalu").select_related(
                "booking"
            )
        ],
        "disputes": [
            _dispute(d)
            for d in Dispute.objects.filter(kind="booking", booking__ghardhani=user)
            .select_related("booking")
            .order_by("raised_at")
        ],
        "reports": [
            {
                "booking_code": r.booking.code,
                "reason": r.reason,
                "note": r.note or None,
                "created_at": iso(r.created_at),
            }
            for r in BookingReport.objects.filter(reporter=user).select_related("booking")
        ],
        "safety_reports": [
            {
                "number": c.number,
                "subject": c.subject,
                "description": c.description,
                "safety_kind": c.safety_kind,
                "status": c.status,
                "created_at": iso(c.created_at),
            }
            for c in SupportCase.objects.filter(requester=user, category="safety").order_by("created_at")
        ],
    }


def export_sipalu(worker) -> dict | None:
    """The Sipalu's Bolau data, or None when the worker never had a Sipalu profile."""
    profile = SipaluProfile.objects.filter(worker=worker).first()
    if profile is None:
        return None
    return {
        "profile": {
            "handle": profile.handle,
            "headline": profile.headline,
            "headline_ne": profile.headline_ne,
            "bio": profile.bio,
            "bio_ne": profile.bio_ne,
            "bolau_enabled": profile.bolau_enabled,
            "instant_booking": profile.instant_booking,
            "service_districts": sorted(profile.service_districts.values_list("code", flat=True)),
            "service_municipality": profile.service_municipality,
            "service_radius_km": profile.service_radius_km,
            "base_lat": str(profile.base_lat) if profile.base_lat is not None else None,
            "base_lng": str(profile.base_lng) if profile.base_lng is not None else None,
            "gender_visible": profile.gender_visible,
            "public_indexable": profile.public_indexable,
            "public_consent_at": iso(profile.public_consent_at),
            "years_total": profile.years_total,
            "jobs_completed": profile.jobs_completed,
            "rating_avg": money(profile.rating_avg),
            "rating_count": profile.rating_count,
            "suspended_at": iso(profile.suspended_at),
            "created_at": iso(profile.created_at),
        },
        "services": [
            {
                "trade": _trade(s.trade_id),
                "title": s.title,
                "title_ne": s.title_ne,
                "description": s.description or None,
                "price_type": s.price_type,
                "price": money(s.price),
                "visit_fee": money(s.visit_fee),
                "estimated_minutes": s.estimated_minutes,
                "is_active": s.is_active,
            }
            for s in profile.services.all()
        ],
        "availability": [
            {"weekday": r.weekday, "start_time": iso(r.start_time), "end_time": iso(r.end_time)}
            for r in profile.availability.all()
        ],
        "time_off": [
            {"from_date": iso(t.from_date), "to_date": iso(t.to_date), "note": t.note or None}
            for t in profile.time_off.all()
        ],
        "portfolio": [
            {
                "caption": i.caption,
                "caption_ne": i.caption_ne,
                "trade": _trade(i.trade_id),
                "image": bool(i.image),  # presence only; files are not in the bundle
                "created_at": iso(i.created_at),
            }
            for i in profile.portfolio.all()
        ],
        # Only the coarse area of each job: the household's exact address and phone are theirs.
        "bookings": [
            {
                **_booking_common(b),
                "area": {
                    "ward": b.address.ward,
                    "municipality": b.address.municipality,
                    "district": b.address.district_id,
                },
            }
            for b in Booking.objects.filter(sipalu=worker).select_related("address").order_by("created_at")
        ],
        "offers": [
            {
                "request_code": o.request.code,
                "price_type": o.price_type,
                "price": money(o.price),
                "visit_fee": money(o.visit_fee),
                "estimated_minutes": o.estimated_minutes,
                "message": o.message or None,
                "proposed_start": iso(o.proposed_start),
                "status": o.status,
                "created_at": iso(o.created_at),
            }
            for o in Offer.objects.filter(sipalu=worker).select_related("request")
        ],
        "ratings_received": [
            _rating(r)
            for r in BookingRating.objects.filter(booking__sipalu=worker, side="ghardhani").select_related(
                "booking"
            )
        ],
        "ratings_given": [
            _rating(r)
            for r in BookingRating.objects.filter(booking__sipalu=worker, side="sipalu").select_related(
                "booking"
            )
        ],
    }


# --------------------------------------------------------------------------- erasure
def _deleted_handle() -> str:
    while True:
        handle = f"deleted-{secrets.token_hex(5)}"
        if not SipaluProfile.objects.filter(handle=handle).exists():
            return handle


@transaction.atomic
def erase_sipalu(worker, *, actor=None) -> dict:
    """Take the Sipalu off Bolau and remove their own Bolau content (called before the worker is
    anonymised, so the cancellation notices still reach both sides)."""
    from . import bookings, kaam

    out: dict = {}
    profile = SipaluProfile.objects.select_for_update().filter(worker=worker).first()
    out["bookings_cancelled"] = bookings.close_open_work(
        worker, by=actor, reason="sipalu_data_deleted", statuses=OPEN_STATUSES
    )
    out["offers_withdrawn"] = kaam.withdraw_pending_offers(worker)
    Offer.objects.filter(sipalu=worker).exclude(message="").update(message="")
    BookingRating.objects.filter(booking__sipalu=worker).exclude(comment="").update(comment="")
    Booking.objects.filter(sipalu=worker).exclude(completion_note="").update(completion_note="")
    if worker.user_id:
        BookingReport.objects.filter(reporter_id=worker.user_id).exclude(note="").update(note="")
    if profile is None:
        return out
    out["portfolio_deleted"] = 0
    for item in profile.portfolio.all():
        if item.image:
            item.image.delete(save=False)
        out["portfolio_deleted"] += 1
    profile.portfolio.all().delete()
    profile.services.update(is_active=False, description="")
    profile.availability.all().delete()
    profile.time_off.all().delete()
    Favourite.objects.filter(profile=profile).delete()
    profile.service_districts.clear()
    profile.handle = _deleted_handle()  # releases the old handle; the new one identifies no one
    profile.headline = profile.headline_ne = profile.bio = profile.bio_ne = ""
    profile.service_municipality = ""
    profile.service_radius_km = profile.base_lat = profile.base_lng = None
    profile.bolau_enabled = profile.instant_booking = False
    profile.public_indexable = profile.gender_visible = False
    profile.public_consent_at = None
    profile.save()
    return out


@transaction.atomic
def erase_household(user, *, actor=None) -> dict:
    """Cancel the household's open bookings / requests and scrub addresses and free text. Bookings
    keep the coarse area (ward, municipality, district) for accounting and disputes."""
    from . import bookings, kaam
    from .bookings import coarse_address

    out: dict = {"bookings_cancelled": 0, "requests_cancelled": 0}
    for pk in Booking.objects.filter(ghardhani=user, status__in=OPEN_STATUSES).values_list("pk", flat=True):
        try:
            bookings.cancel(Booking(pk=pk), actor, "ops", "ghardhani_data_deleted")
            out["bookings_cancelled"] += 1
        except InvalidState:  # moved on concurrently
            continue
    for req in KaamRequest.objects.filter(ghardhani=user, status__in=KaamRequest.OPEN):
        kaam.cancel_request(req)
        out["requests_cancelled"] += 1
    for req in KaamRequest.objects.filter(ghardhani=user).prefetch_related("photos"):
        for photo in req.photos.all():
            if photo.image:
                photo.image.delete(save=False)
        req.photos.all().delete()
    KaamRequest.objects.filter(ghardhani=user).update(title="", description="")
    for b in Booking.objects.filter(ghardhani=user).select_related("address__district"):
        b.address_snapshot = coarse_address(b.address)
        b.description = ""
        b.save(update_fields=["address_snapshot", "description", "updated_at"])
    addresses = list(Address.objects.filter(ghardhani=user))
    for a in addresses:
        a.line, a.landmark, a.lat, a.lng = "", None, None, None
        a.is_active = a.is_default = False
        a.save()
    out["addresses_scrubbed"] = len(addresses)
    BookingRating.objects.filter(booking__ghardhani=user).exclude(comment="").update(comment="")
    BookingReport.objects.filter(reporter=user).exclude(note="").update(note="")
    Favourite.objects.filter(ghardhani=user).delete()
    GhardhaniProfile.objects.filter(user=user).update(display_name="")
    return out
