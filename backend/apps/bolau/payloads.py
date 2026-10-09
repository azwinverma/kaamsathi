"""Response shapes (docs/CONTRACT-BOLAU.md). Plain dict builders so web + mobile see one shape.

Masking rules live here: public payloads never carry phone, address, ID or exact location; a
Sipalu sees the Ghardhani's exact address only inside the accepted window (``contact_visible``).
"""

from __future__ import annotations

from django.conf import settings
from django.utils import timezone

from apps.core.bs import ad_to_bs
from apps.core.crypto import mask
from apps.core.files import signed_url
from apps.core.phone import mask_phone

from . import bookings, labels, profiles
from .common import first_name, free_cancel_window, iso, money
from .models import Booking, BookingRating, KaamRequest, Offer, SipaluProfile


def district_ref(d) -> dict | None:
    return {"code": d.code, "name_en": d.name_en, "name_ne": d.name_ne} if d else None


def trade_ref(t) -> dict | None:
    return {"code": t.code, "name_en": t.name_en, "name_ne": t.name_ne} if t else None


# --------------------------------------------------------------------------- files
def photo_url(worker, request=None, *, public=False) -> str | None:
    if not worker.photo:
        return None
    if public:
        return signed_url(worker.photo, None, request, check=f"bolau_photo:{worker.pk}")
    from apps.core.files import request_user, worker_file_url

    return worker_file_url(request, worker, "photo") or signed_url(
        worker.photo, request_user(request), request, check=f"bolau_photo:{worker.pk}"
    )


def portfolio_url(item, request=None) -> str:
    return signed_url(item.image, None, request, check=f"bolau_portfolio:{item.pk}")


def can_download_photo(rest: str, user, name: str) -> bool:
    """Signed-URL re-check: a Sipalu photo is downloadable while their public profile is live
    (or by the Sipalu / ops)."""
    profile = SipaluProfile.objects.select_related("worker").filter(worker_id=rest).first()
    if profile is None or not profile.worker.photo or profile.worker.photo.name != name:
        return False
    if (
        user is not None
        and getattr(user, "is_authenticated", False)
        and (user.is_staff or profile.worker.user_id == user.pk)
    ):
        return True
    from .common import bolau_on

    if not bolau_on():
        return False
    if profiles.is_public(profile):
        return True
    # Parties of a live booking may see each other's photo.
    return (
        bool(user)
        and Booking.objects.filter(sipalu=profile.worker, ghardhani_id=getattr(user, "pk", None)).exists()
    )


def can_download_portfolio(rest: str, user, name: str) -> bool:
    from .models import PortfolioItem

    item = PortfolioItem.objects.select_related("profile__worker").filter(pk=rest).first()
    if item is None or item.image.name != name:
        return False
    if (
        user is not None
        and getattr(user, "is_authenticated", False)
        and (user.is_staff or item.profile.worker.user_id == user.pk)
    ):
        return True
    from .common import bolau_on

    return bolau_on() and profiles.is_public(item.profile)


def can_download_request_photo(rest: str, user, name: str) -> bool:
    from . import kaam
    from .models import KaamRequestPhoto

    photo = KaamRequestPhoto.objects.select_related("request__address").filter(pk=rest).first()
    if (
        photo is None
        or photo.image.name != name
        or user is None
        or not getattr(user, "is_authenticated", False)
    ):
        return False
    req = photo.request
    if user.is_staff or req.ghardhani_id == user.pk:
        return True
    profile = SipaluProfile.objects.filter(worker__user=user).first()
    return kaam.can_see_request(profile, req)


# --------------------------------------------------------------------------- Sipalu
def service_dict(s) -> dict:
    return {
        "id": str(s.id),
        "trade": trade_ref(s.trade),
        "title": s.title,
        "title_ne": s.title_ne or None,
        "description": s.description or None,
        "price_type": s.price_type,
        "price_type_label": labels.label(labels.PRICE_TYPE, s.price_type),
        "price": money(s.price),
        "visit_fee": money(s.visit_fee),
        "estimated_minutes": s.estimated_minutes,
        "is_active": s.is_active,
        "order": s.order,
    }


def rule_dict(r) -> dict:
    return {
        "id": str(r.id),
        "weekday": r.weekday,
        "start_time": r.start_time.strftime("%H:%M"),
        "end_time": r.end_time.strftime("%H:%M"),
    }


def time_off_dict(t) -> dict:
    from apps.core.bs import bs_str

    return {
        "id": str(t.id),
        "from_date": t.from_date.isoformat(),
        "from_date_bs": bs_str(t.from_date),
        "to_date": t.to_date.isoformat(),
        "to_date_bs": bs_str(t.to_date),
        "note": t.note or None,
    }


def portfolio_dict(item, request=None) -> dict:
    url = portfolio_url(item, request)
    return {
        "id": str(item.id),
        "image_url": url,
        "thumb_url": url,
        "caption": item.caption or None,
        "caption_ne": item.caption_ne or None,
        "trade": trade_ref(item.trade),
        "created_at": iso(item.created_at),
    }


def skills_payload(worker) -> list[dict]:
    return [
        {
            "code": s.trade.code,
            "name_en": s.trade.name_en,
            "name_ne": s.trade.name_ne,
            "years": s.years_experience,
            "nstb_level": s.nstb_level if s.nstb_level not in ("", "none") else None,
        }
        for s in worker.skills.select_related("trade").order_by("-years_experience")
    ]


def _trust(worker) -> tuple[int, int | None]:
    try:
        from apps.trust.services import get_trust

        t = get_trust(worker)
        return t.verification_level, t.reliability_score
    except Exception:  # noqa: BLE001
        return (1 if worker.verification_status == "verified" else 0), None


def verified_badges(worker) -> list[str]:
    badges = []
    if worker.verification_status == "verified":
        badges.append("identity")
    try:
        from apps.credentials.models import Credential, SkillAssessment

        if Credential.objects.filter(worker=worker, status="verified").exists():
            badges.append("certificate")
        if SkillAssessment.objects.filter(worker=worker, result="pass").exists():
            badges.append("skill_assessed")
    except Exception:  # noqa: BLE001
        pass
    return badges


def passport_url(worker) -> str | None:
    try:
        from apps.credentials.models import Passport
        from apps.credentials.services import public_url

        p = Passport.objects.filter(worker=worker, is_public=True).first()
        return public_url(p) if p else None
    except Exception:  # noqa: BLE001
        return None


def public_url(profile: SipaluProfile) -> str:
    return f"{settings.PUBLIC_WEB_URL.rstrip('/')}/sipalu/{profile.handle}"


def from_price(services) -> str | None:
    prices = [s.visit_fee if s.price_type == "visit_then_quote" else s.price for s in services if s.is_active]
    prices = [p for p in prices if p is not None]
    return money(min(prices)) if prices else None


def month_bs(value) -> str | None:
    if value is None:
        return None
    b = ad_to_bs(timezone.localtime(value).date())
    return f"{b.year:04d}-{b.month:02d}"


def review_dict(r: BookingRating) -> dict:
    return {
        "score": r.score,
        "comment": r.public_comment,
        "tags": r.tags,
        "tag_labels": [str(labels.SIPALU_TAGS.get(t, t)) for t in r.tags],
        "first_name": first_name(r.rater.full_name if r.rater_id else ""),
        "month_bs": month_bs(r.created_at),
    }


def public_reviews(worker, limit: int = 10) -> list[dict]:
    qs = (
        BookingRating.objects.filter(booking__sipalu=worker, side="ghardhani", voided=False)
        .select_related("rater")
        .order_by("-created_at")[:limit]
    )
    return [review_dict(r) for r in qs]


def public_profile(profile: SipaluProfile, request=None) -> dict:
    """``GET /public/sipalu/{handle}`` — never phone, address, ID or exact location."""
    from .availability import availability_summary, next_available

    w = profile.worker
    level, _rel = _trust(w)
    rules = list(profile.availability.all())
    services = list(profile.services.filter(is_active=True).select_related("trade"))
    summary = availability_summary(profile, rules)
    nxt = next_available(profile, rules=rules)
    summary["next_available"] = iso(nxt)
    from apps.workers.services import language_payload

    data = {
        "handle": profile.handle,
        "name": w.full_name,
        "name_ne": w.full_name_ne or None,
        "photo_url": photo_url(w, request, public=True),
        "headline": profile.headline or None,
        "headline_ne": profile.headline_ne or None,
        "bio": profile.bio or None,
        "bio_ne": profile.bio_ne or None,
        "trades": skills_payload(w),
        "languages": language_payload(w.languages.all()),
        "verification_level": level,
        "verified_badges": verified_badges(w),
        "rating_avg": money(profile.rating_avg),
        "rating_count": profile.rating_count,
        "jobs_completed": profile.jobs_completed,
        "response_time_minutes": profile.response_time_minutes,
        "years_total": profile.years_total,
        "instant_booking": profile.instant_booking,
        "services": [service_dict(s) for s in services],
        "from_price": from_price(services),
        "service_districts": [district_ref(d) for d in profile.service_districts.all()],
        "availability_summary": summary,
        "portfolio": [
            {
                "id": str(i.id),
                "thumb_url": portfolio_url(i, request),
                "caption": i.caption or None,
                "caption_ne": i.caption_ne or None,
            }
            for i in profile.portfolio.all()
        ],  # fmt: skip
        "reviews": public_reviews(w),
        "passport_url": passport_url(w),
        "indexable": profile.public_indexable,
        "public_url": public_url(profile),
    }
    if profile.gender_visible:
        data["gender"] = w.gender
    return data


def card(profile: SipaluProfile, request=None, *, next_slot=None, distance_band=None, top_trade=None) -> dict:
    services = [s for s in profile.services.all() if s.is_active]
    w = profile.worker
    skills = sorted(w.skills.all(), key=lambda s: -s.years_experience)
    top = top_trade or (skills[0].trade if skills else (services[0].trade if services else None))
    level = getattr(getattr(w, "trust", None), "verification_level", None)
    return {
        "handle": profile.handle,
        "name": w.full_name,
        "name_ne": w.full_name_ne or None,
        "photo_url": photo_url(w, request, public=True),
        "headline": profile.headline or None,
        "headline_ne": profile.headline_ne or None,
        "top_trade": trade_ref(top),
        "rating_avg": money(profile.rating_avg),
        "rating_count": profile.rating_count,
        "jobs_completed": profile.jobs_completed,
        "verification_level": level
        if level is not None
        else (1 if w.verification_status == "verified" else 0),
        "from_price": from_price(services),
        "next_available": iso(next_slot),
        "distance_band": distance_band,
        "instant_booking": profile.instant_booking,
    }


def own_profile(profile: SipaluProfile, request=None) -> dict:
    """``GET /me/sipalu`` — the Sipalu's own editable profile + onboarding state."""
    from apps.workers.services import language_payload

    w = profile.worker
    state = profiles.onboarding_state(profile)
    return {
        "id": str(profile.id),
        "worker_id": str(w.id),
        "handle": profile.handle,
        "handle_changed_at": iso(profile.handle_changed_at),
        "handle_change_available_at": iso(profiles.handle_change_available_at(profile)),
        "public_url": public_url(profile),
        "name": w.full_name,
        "name_ne": w.full_name_ne or None,
        "photo_url": photo_url(w, request),
        "verification_status": w.verification_status,
        "headline": profile.headline,
        "headline_ne": profile.headline_ne,
        "bio": profile.bio,
        "bio_ne": profile.bio_ne,
        "bolau_enabled": profile.bolau_enabled,
        "instant_booking": profile.instant_booking,
        "service_districts": [district_ref(d) for d in profile.service_districts.all()],
        "service_municipality": profile.service_municipality or None,
        "service_radius_km": profile.service_radius_km,
        "base_lat": str(profile.base_lat) if profile.base_lat is not None else None,
        "base_lng": str(profile.base_lng) if profile.base_lng is not None else None,
        "gender_visible": profile.gender_visible,
        "public_indexable": profile.public_indexable,
        "public_consent": profile.public_consent_at is not None,
        "years_total": profile.years_total,
        "trades": skills_payload(w),
        "languages": language_payload(w.languages.all()),
        "payment": {
            "method": w.payment_method,
            "wallet_id": w.wallet_id,
            "bank_name": w.bank_name,
            "bank_account_masked": mask(w.bank_account_no) or None,
            "bank_account_name": w.bank_account_name,
        },
        "stats": {
            "rating_avg": money(profile.rating_avg),
            "rating_count": profile.rating_count,
            "jobs_completed": profile.jobs_completed,
            "response_time_minutes": profile.response_time_minutes,
        },
        "suspended": (
            {"at": iso(profile.suspended_at), "reason": profile.suspension_reason or None}
            if profile.suspended_at
            else None
        ),
        "bookable": profiles.is_bookable(profile),
        "bookable_problems": profiles.bookable_problems(profile),
        "services": [service_dict(s) for s in profile.services.select_related("trade")],
        "availability": [rule_dict(r) for r in profile.availability.all()],
        "time_off": [time_off_dict(t) for t in profile.time_off.all()],
        "portfolio": [portfolio_dict(i, request) for i in profile.portfolio.select_related("trade")],
        **state,
    }


# --------------------------------------------------------------------------- Ghardhani
def address_dict(a) -> dict:
    return {
        "id": str(a.id),
        "label": a.label,
        "label_label": labels.label(labels.ADDRESS_LABEL, a.label),
        "line": a.line,
        "ward": a.ward,
        "municipality": a.municipality,
        "district": district_ref(a.district),
        "landmark": a.landmark or None,
        "lat": str(a.lat) if a.lat is not None else None,
        "lng": str(a.lng) if a.lng is not None else None,
        "is_default": a.is_default,
    }


# --------------------------------------------------------------------------- bookings
def _sipalu_party(b: Booking, request, *, reveal: bool) -> dict:
    w = b.sipalu
    profile = getattr(w, "sipalu", None)
    return {
        "worker_id": str(w.id),
        "handle": profile.handle if profile else None,
        "name": w.full_name,
        "photo_url": photo_url(w, request),
        "phone_masked": mask_phone(w.phone),
        "phone": w.phone if reveal else None,
        "rating_avg": money(profile.rating_avg) if profile else None,
    }


def _ghardhani_party(b: Booking, *, reveal: bool) -> dict:
    u = b.ghardhani
    gp = getattr(u, "ghardhani", None)
    name = (gp.display_name if gp and gp.display_name else u.full_name) or ""
    return {
        "user_id": str(u.id),
        "name": name if reveal else first_name(name),
        "phone_masked": mask_phone(u.phone),
        "phone": u.phone if reveal else None,
        "rating": profiles.ghardhani_rating(u),
    }


def booking_dict(b: Booking, viewer: str, request=None, *, events: bool = False) -> dict:
    """``viewer``: ghardhani | sipalu | ops."""
    reveal = bookings.contact_visible(b) or viewer == "ops"
    if viewer in ("ghardhani", "ops"):  # the Ghardhani's own address; ops sees everything
        address = b.address_snapshot or bookings.address_snapshot(b.address)
    else:
        address = b.address_snapshot if reveal and b.address_snapshot else bookings.coarse_address(b.address)
    data = {
        "id": str(b.id),
        "code": b.code,
        "status": b.status,
        "status_label": labels.label(labels.BOOKING_STATUS, b.status),
        "source": b.source,
        "request_id": str(b.request_id) if b.request_id else None,
        "trade": trade_ref(b.trade),
        "service": {"id": str(b.service.id), "title": b.service.title, "title_ne": b.service.title_ne or None}
        if b.service_id
        else None,
        "description": b.description,
        "address": address,
        "address_revealed": viewer != "sipalu" or bool(reveal and b.address_snapshot),
        "scheduled_start": iso(b.scheduled_start),
        "scheduled_end": iso(b.scheduled_end),
        "estimated_minutes": b.estimated_minutes,
        "price_type": b.price_type,
        "price_type_label": labels.label(labels.PRICE_TYPE, b.price_type),
        "quoted_price": money(b.quoted_price),
        "visit_fee": money(b.visit_fee),
        "quote_amount": money(b.quote_amount),
        "quote_status": b.quote_status,
        "final_price": money(b.final_price),
        "booking_fee": money(b.booking_fee),
        "booking_fee_status": b.booking_fee_status,
        "booking_fee_status_label": labels.label(labels.FEE_STATUS, b.booking_fee_status),
        "cancelled_by": b.cancelled_by,
        "cancel_reason": b.cancel_reason or None,
        "late_cancellation": b.late_cancellation,
        "expires_at": iso(b.expires_at) if b.status == "requested" else None,
        "accepted_at": iso(b.accepted_at),
        "arrival_verified_at": iso(b.arrival_verified_at),
        "arrival_attempts_left": max(Booking.ARRIVAL_MAX_TRIES - b.arrival_attempts, 0),
        "started_at": iso(b.started_at),
        "completed_at": iso(b.completed_at),
        "confirmed_at": iso(b.confirmed_at),
        "free_cancel_until": iso(b.scheduled_start - free_cancel_window()),
        "payment_to_sipalu": bookings.payment_state(b),
        "contact_visible": reveal,
        "contact_visible_until": iso(bookings.contact_visible_until(b)),
        "sipalu": _sipalu_party(b, request, reveal=reveal),
        "ghardhani": _ghardhani_party(b, reveal=reveal),
        "my_role": viewer,
        "created_at": iso(b.created_at),
        "safety": {
            "emergency_line": labels.EMERGENCY["line"],
            "en": labels.EMERGENCY["en"],
            "ne": labels.EMERGENCY["ne"],
        },
    }
    if viewer == "ghardhani" and b.status in ("accepted", "on_the_way"):
        data["arrival_code"] = bookings.arrival_code(b)
    if viewer in ("ghardhani", "sipalu"):
        mine = {r.side: r for r in b.ratings.all()}
        data["my_rating"] = rating_dict(mine[viewer]) if viewer in mine else None
        data["can_rate"] = viewer not in mine and (
            b.status == "confirmed" or (b.status == "disputed" and b.status_before_dispute == "confirmed")
        )
    if events:
        data["events"] = [
            {
                "from_status": e.from_status or None,
                "to_status": e.to_status,
                "to_status_label": labels.label(labels.BOOKING_STATUS, e.to_status),
                "by_party": e.by_party or None,
                "note": e.note or None,
                "at": iso(e.at),
            }
            for e in b.events.all()
        ]
    return data


def rating_dict(r: BookingRating, *, full: bool = False) -> dict:
    tags = labels.SIPALU_TAGS if r.side == "ghardhani" else labels.GHARDHANI_TAGS
    data = {
        "id": str(r.id),
        "booking_id": str(r.booking_id),
        "side": r.side,
        "score": r.score,
        "comment": r.comment if full else r.public_comment,
        "tags": r.tags,
        "tag_labels": [str(tags.get(t, t)) for t in r.tags],
        "comment_status": r.comment_status,
        "voided": r.voided,
        "created_at": iso(r.created_at),
    }
    if full:
        data.update(
            {
                "booking_code": r.booking.code,
                "rater": {"id": str(r.rater_id), "full_name": r.rater.full_name} if r.rater_id else None,
                "flag_reason": r.flag_reason or None,
                "flagged_at": iso(r.flagged_at),
                "moderation_note": r.moderation_note or None,
                "moderated_at": iso(r.moderated_at),
                "void_reason": r.void_reason or None,
                "voided_at": iso(r.voided_at),
            }
        )
    return data


# --------------------------------------------------------------------------- requests / offers
def offer_dict(o: Offer, request=None, *, for_ghardhani: bool = True) -> dict:
    w = o.sipalu
    profile = getattr(w, "sipalu", None)
    data = {
        "id": str(o.id),
        "request_id": str(o.request_id),
        "status": o.status,
        "status_label": labels.label(labels.OFFER_STATUS, o.status),
        "price_type": o.price_type,
        "price_type_label": labels.label(labels.PRICE_TYPE, o.price_type),
        "price": money(o.price),
        "visit_fee": money(o.visit_fee),
        "estimated_minutes": o.estimated_minutes,
        "message": o.message or None,
        "proposed_start": iso(o.proposed_start),
        "created_at": iso(o.created_at),
    }
    if for_ghardhani:
        data["sipalu"] = card(profile, request) if profile else {"name": w.full_name}
    return data


def _request_photo_url(p, request) -> str:
    from apps.core.files import request_user

    return signed_url(p.image, request_user(request), request, check=f"bolau_request_photo:{p.pk}")


def request_dict(r: KaamRequest, viewer: str, request=None, *, offers=None, my_offer=None) -> dict:
    a = r.address
    data = {
        "id": str(r.id),
        "code": r.code,
        "trade": trade_ref(r.trade),
        "title": r.title,
        "description": r.description or None,
        "address": address_dict(a) if viewer in ("ghardhani", "ops") else bookings.coarse_address(a),
        "preferred_window_start": iso(r.preferred_window_start),
        "preferred_window_end": iso(r.preferred_window_end),
        "budget_max": money(r.budget_max),
        "status": r.status,
        "status_label": labels.label(labels.REQUEST_STATUS, r.status),
        "expires_at": iso(r.expires_at),
        "created_at": iso(r.created_at),
        "photos": [_request_photo_url(p, request) for p in r.photos.all()],
        "offers_count": r.offers.count(),
        "offers_left": max(Offer.MAX_PER_REQUEST - r.offers.count(), 0),
    }
    if offers is not None:
        data["offers"] = [offer_dict(o, request) for o in offers]
        booking = r.bookings.first()
        data["booking_id"] = str(booking.id) if booking else None
    if viewer == "sipalu":
        data["my_offer"] = offer_dict(my_offer, request, for_ghardhani=False) if my_offer else None
    return data
