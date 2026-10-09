"""Ops services for /ops/bolau: KPIs, fee ledger, suspension, rating moderation."""

from __future__ import annotations

import datetime as dt
import statistics

from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from apps.core.exceptions import InvalidState
from apps.core.money import D

from . import notify
from .common import money
from .models import Booking, BookingRating, SipaluProfile


def kpis(days: int = 30) -> dict:
    since = timezone.now() - dt.timedelta(days=days)
    qs = Booking.objects.filter(created_at__gte=since)
    total = qs.count()
    direct = qs.filter(source="direct")
    answered = direct.filter(Q(accepted_at__isnull=False) | Q(status__in=("declined", "expired")))
    accepted = direct.filter(accepted_at__isnull=False).count()
    times = [
        (a - c).total_seconds() / 60
        for c, a in direct.filter(accepted_at__isnull=False).values_list("created_at", "accepted_at")
    ]
    ever_accepted = qs.filter(accepted_at__isnull=False)
    done = ever_accepted.filter(
        Q(status__in=("completed", "confirmed"))
        | Q(status="disputed", status_before_dispute__in=("completed", "confirmed"))
    ).count()
    per_user = qs.values("ghardhani").annotate(n=Count("id"))
    users = per_user.count()
    repeat = per_user.filter(n__gte=2).count()
    rating = BookingRating.objects.filter(created_at__gte=since, side="ghardhani", voided=False).aggregate(
        a=Avg("score")
    )["a"]

    def pct(n, d):
        return round(n * 100 / d, 1) if d else None

    return {
        "days": days,
        "bookings": total,
        "bookings_per_day": round(total / days, 2) if days else None,
        "acceptance_rate": pct(accepted, answered.count()),
        "time_to_accept_minutes_median": round(statistics.median(times), 1) if times else None,
        "completion_rate": pct(done, ever_accepted.count()),
        "cancellation_rate": pct(qs.filter(status="cancelled").count(), total),
        "late_cancellations": qs.filter(late_cancellation=True).count(),
        "no_shows": qs.filter(status="no_show").count(),
        "disputes": qs.filter(status="disputed").count(),
        "repeat_ghardhani_rate": pct(repeat, users),
        "avg_rating": money(D(rating)) if rating is not None else None,
        "by_status": {r["status"]: r["n"] for r in qs.values("status").annotate(n=Count("id"))},
        "fees": fee_totals(qs),
    }


def fee_totals(qs=None) -> dict:
    qs = qs if qs is not None else Booking.objects.all()
    out = {}
    for status in ("waived", "pending", "paid", "refunded"):
        agg = qs.filter(booking_fee_status=status, fee_charge__isnull=False).aggregate(
            n=Count("id"), t=Sum("booking_fee")
        )
        out[status] = {"count": agg["n"] or 0, "amount": money(agg["t"] or 0)}
    return out


@transaction.atomic
def suspend(profile: SipaluProfile, user, reason: str) -> SipaluProfile:
    profile = (
        SipaluProfile.objects.select_for_update(of=("self",))
        .select_related("worker__user")
        .get(pk=profile.pk)
    )
    profile.bolau_enabled = False
    profile.suspended_at = timezone.now()
    profile.suspension_reason = reason[:500]
    profile.suspended_by = user
    profile.save(
        update_fields=["bolau_enabled", "suspended_at", "suspension_reason", "suspended_by", "updated_at"]
    )
    if profile.worker.user:
        notify.send(profile.worker.user, "sipalu_suspended", link="/sipalu/profile")
    return profile


@transaction.atomic
def unsuspend(profile: SipaluProfile) -> SipaluProfile:
    profile = (
        SipaluProfile.objects.select_for_update(of=("self",))
        .select_related("worker__user")
        .get(pk=profile.pk)
    )
    if not profile.suspended_at:
        raise InvalidState()
    profile.suspended_at = None
    profile.suspension_reason = ""
    profile.suspended_by = None
    profile.save(update_fields=["suspended_at", "suspension_reason", "suspended_by", "updated_at"])
    if profile.worker.user:
        notify.send(profile.worker.user, "sipalu_unsuspended", link="/sipalu/profile")
    return profile


@transaction.atomic
def moderate_rating(rating: BookingRating, user, action: str, note: str = "") -> BookingRating:
    from . import profiles

    rating = (
        BookingRating.objects.select_for_update(of=("self",))
        .select_related("booking__sipalu")
        .get(pk=rating.pk)
    )
    now = timezone.now()
    if action == "hide":
        if not rating.comment or rating.comment_status == "hidden":
            raise InvalidState()
        rating.comment_status = "hidden"
    elif action == "restore":
        if rating.comment_status == "visible":
            raise InvalidState()
        rating.comment_status = "visible"
    elif action == "void":
        if rating.voided:
            raise InvalidState()
        rating.voided, rating.void_reason, rating.voided_by, rating.voided_at = True, note[:500], user, now
    if action in ("hide", "restore"):
        rating.moderated_by, rating.moderated_at, rating.moderation_note = user, now, note[:500]
    rating.save()
    if action == "void" and rating.side == "ghardhani":
        profile = SipaluProfile.objects.filter(worker=rating.booking.sipalu).first()
        if profile:
            profiles.refresh_stats(profile)
    return rating


@transaction.atomic
def flag_rating(rating: BookingRating, user, reason: str) -> BookingRating:
    from . import labels

    rating = BookingRating.objects.select_for_update().get(pk=rating.pk)
    if not rating.comment or rating.comment_status != "visible" or rating.voided:
        raise InvalidState(message=str(labels.b("This comment cannot be flagged.")))
    rating.comment_status = "flagged"
    rating.flagged_by = user
    rating.flagged_at = timezone.now()
    rating.flag_reason = reason[:500]
    rating.save(update_fields=["comment_status", "flagged_by", "flagged_at", "flag_reason"])
    return rating
