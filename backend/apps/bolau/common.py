"""Shared helpers: flag gate, codes, minimum hourly rate, money, errors, time windows."""

from __future__ import annotations

import datetime as dt
import secrets

from django.conf import settings
from django.http import Http404
from django.utils import timezone

from apps.core.exceptions import APIError, BelowMinimumWage, InvalidState
from apps.core.money import D, q2

from . import labels

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I/L
LEAD_TIME = dt.timedelta(minutes=60)
EXPIRE_BEFORE_START = dt.timedelta(minutes=15)
AUTO_CONFIRM_AFTER = dt.timedelta(hours=24)
CONTACT_AFTER_COMPLETION = dt.timedelta(hours=48)
NO_SHOW_GRACE = dt.timedelta(minutes=30)
REQUEST_TTL = dt.timedelta(hours=24)
MIN_MINUTES, MAX_MINUTES = 30, 12 * 60


def bolau_on() -> bool:
    from apps.core.flags import is_enabled

    return is_enabled("bolau")


def require_bolau() -> None:
    """Public / booking endpoints 404 while the ``bolau`` flag is off (B2B pilot unaffected)."""
    if not bolau_on():
        raise Http404


def new_code(prefix: str, model, length: int = 4) -> str:
    for attempt in range(20):
        size = length if attempt < 10 else length + 2
        code = f"{prefix}-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(size))
        if not model.objects.filter(code=code).exists():
            return code
    raise RuntimeError("Could not allocate a code")  # pragma: no cover


def min_hourly():
    """Bolau's hourly floor: the higher of the hourly and part-time hourly minimum wage (Rs 107)."""
    from apps.hiring.models import MinimumWage

    mw = MinimumWage.current()
    if mw is None:
        return D("0")
    return max(D(mw.hourly), D(mw.hourly_part_time or 0))


def check_price(price_type: str, price, visit_fee=None, estimated_minutes=None, field: str = "price"):
    """Fair by default: hourly ≥ minimum hourly; a fixed price ≥ minimum hourly × estimated hours;
    visit-then-quote needs a visit fee."""
    minimum = min_hourly()
    price = D(price)
    if price_type == "hourly" and price < minimum:
        msg = labels.message("below_min_hourly", minimum=q2(minimum))
        raise BelowMinimumWage(message=msg, fields={field: [msg]})
    if price_type == "fixed" and estimated_minutes:
        floor = q2(minimum * D(estimated_minutes) / D(60))
        if price < floor:
            msg = labels.message("below_min_hourly", minimum=q2(minimum))
            raise BelowMinimumWage(message=msg, fields={field: [msg]})
    if price_type == "visit_then_quote" and (visit_fee is None or D(visit_fee) <= 0):
        msg = labels.message("visit_fee_required")
        raise APIError("validation_error", message=msg, fields={"visit_fee": [msg]})


def quoted_price(price_type: str, price, visit_fee, minutes: int):
    if price_type == "hourly":
        return q2(D(price) * D(minutes) / D(60))
    if price_type == "visit_then_quote":
        return q2(D(visit_fee or 0))
    return q2(D(price))


def invalid(key: str = "invalid_transition", **kwargs):
    return InvalidState(message=labels.message(key, **kwargs))


def error(code: str, key: str, field: str | None = None, status_code: int | None = None, **kwargs):
    msg = labels.message(key, **kwargs)
    return APIError(code, message=msg, fields={field: [msg]} if field else None, status_code=status_code)


def iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, dt.datetime):
        return timezone.localtime(value).isoformat()
    return value.isoformat()


def money(value) -> str | None:
    return None if value is None else f"{q2(value):.2f}"


def accept_timeout() -> dt.timedelta:
    return dt.timedelta(minutes=int(getattr(settings, "BOLAU_ACCEPT_TIMEOUT_MINUTES", 30)))


def free_cancel_window() -> dt.timedelta:
    return dt.timedelta(hours=int(getattr(settings, "BOLAU_FREE_CANCEL_HOURS", 2)))


def first_name(full_name: str | None) -> str:
    return (full_name or "").strip().split(" ")[0] if full_name else ""
