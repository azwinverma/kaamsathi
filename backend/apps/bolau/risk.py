"""Bolau risk detectors → ``apps.risk.services.flag`` (idempotent per open subject + kind).

* ``booking_cancellations`` — a Sipalu with ≥ 3 cancellations-after-accept / no-shows in 30 days
  (high at ≥ 5); a Ghardhani with ≥ 3 late cancellations in 30 days (subject type ``user``).
* ``off_platform_payment`` — a party reported for asking to pay / deal outside KaamSathi
  (medium; high once two different people reported the same party).
* ``review_fraud`` — ratings of one Sipalu from different Ghardhani that share a device fingerprint
  or an address (blind-index hashes only), or a rating from the Sipalu's own address.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import logging

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("kaamsathi.bolau")

WINDOW = dt.timedelta(days=30)
CANCEL_THRESHOLD, CANCEL_HIGH = 3, 5


def _flag(subject, kind: str, severity: str, details: dict) -> None:
    try:
        from apps.risk.services import flag
    except ImportError:  # pragma: no cover
        return
    try:
        with transaction.atomic():  # savepoint: a failed flag never poisons the booking transaction
            flag(subject, kind, severity, details)
    except Exception:  # noqa: BLE001 - a detector must never break a booking
        logger.exception("bolau risk flag %s failed", kind)


def device_hash(request) -> str:
    if request is None:
        return ""
    from apps.audit.services import client_ip

    raw = f"{client_ip(request) or ''}|{request.META.get('HTTP_USER_AGENT', '')}"
    return hashlib.sha256(raw.encode()).hexdigest()


def check_cancellations(booking) -> None:
    from .models import Booking

    since = timezone.now() - WINDOW
    if booking.cancelled_by == "sipalu" or booking.status == "no_show":
        n = (
            Booking.objects.filter(sipalu=booking.sipalu, updated_at__gte=since)
            .filter(status__in=("cancelled", "no_show"))
            .exclude(status="cancelled", cancelled_by__in=("ghardhani", "ops"))
            .count()
        )
        if n >= CANCEL_THRESHOLD:
            _flag(
                booking.sipalu,
                "booking_cancellations",
                "high" if n >= CANCEL_HIGH else "medium",
                {"source": "bolau", "party": "sipalu", "count_30d": n, "bookings": [booking.code]},
            )
    if booking.cancelled_by == "ghardhani" and booking.late_cancellation:
        n = Booking.objects.filter(
            ghardhani=booking.ghardhani,
            cancelled_by="ghardhani",
            late_cancellation=True,
            cancelled_at__gte=since,
        ).count()
        if n >= CANCEL_THRESHOLD:
            _flag(
                booking.ghardhani,
                "booking_cancellations",
                "high" if n >= CANCEL_HIGH else "medium",
                {"source": "bolau", "party": "ghardhani", "count_30d": n, "bookings": [booking.code]},
            )


def check_report(report) -> None:
    from .models import BookingReport

    if report.reason != "off_platform_payment":
        return
    booking = report.booking
    if report.reporter_side == "ghardhani":
        subject, against = booking.sipalu, {"booking__sipalu": booking.sipalu}
    else:
        subject, against = booking.ghardhani, {"booking__ghardhani": booking.ghardhani}
    reporters = (
        BookingReport.objects.filter(
            reason="off_platform_payment", reporter_side=report.reporter_side, **against
        )
        .values_list("reporter_id", flat=True)
        .distinct()
        .count()
    )
    _flag(
        subject,
        "off_platform_payment",
        "high" if reporters >= 2 else "medium",
        {"source": "bolau", "reporters": reporters, "bookings": [booking.code]},
    )


def check_review(rating) -> None:
    """Called after a Ghardhani rates a Sipalu."""
    from .models import BookingRating

    if rating.side != "ghardhani":
        return
    sipalu = rating.booking.sipalu
    others = BookingRating.objects.filter(booking__sipalu=sipalu, side="ghardhani", voided=False).exclude(
        rater_id=rating.rater_id
    )
    signals = []
    if rating.device_hash and others.filter(device_hash=rating.device_hash).exists():
        signals.append("same_device")
    if rating.address_hash and others.filter(address_hash=rating.address_hash).exists():
        signals.append("same_address")
    if signals:
        _flag(
            sipalu,
            "review_fraud",
            "high",
            {"source": "bolau", "signals": signals, "bookings": [rating.booking.code]},
        )


def scan() -> int:
    """Nightly sweep (beat ``bolau-risk-scan``) re-running the review-fraud check on recent ratings."""
    from .models import BookingRating

    n = 0
    since = timezone.now() - WINDOW
    for rating in BookingRating.objects.filter(side="ghardhani", created_at__gte=since).select_related(
        "booking__sipalu"
    ):
        check_review(rating)
        n += 1
    return n
