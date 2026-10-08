"""OTP issue/verify: hashed codes, 5-min expiry, 5 attempts, 5 requests/phone/hour, 30 s resend cooldown."""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import secrets

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import APIError

from .models import PhoneOTP


def hash_code(phone: str, code: str) -> str:
    key = settings.SECRET_KEY.encode()
    return hmac.new(key, f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def dev_code() -> str | None:
    return settings.OTP_DEV_CODE if settings.DEBUG and settings.OTP_DEV_CODE else None


class OTPRateLimited(APIError):
    """429 ``otp_rate_limited`` with ``error.retry_after`` (seconds) and a ``Retry-After`` header."""

    status_code = 429
    default_code = "otp_rate_limited"

    def __init__(self, retry_after: int | None = None):
        super().__init__()
        self.retry_after = retry_after


def cooldown_remaining(phone: str, now=None) -> int:
    """Seconds until ``phone`` may request another OTP (0 = now)."""
    cooldown = int(getattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 30) or 0)
    if cooldown <= 0:
        return 0
    now = now or timezone.now()
    last = (
        PhoneOTP.objects.filter(phone=phone, created_at__gt=now - dt.timedelta(seconds=cooldown))
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    if last is None:
        return 0
    return max(1, int((last + dt.timedelta(seconds=cooldown) - now).total_seconds() + 0.999))


def issue(phone: str, ip=None) -> tuple[PhoneOTP, str]:
    now = timezone.now()
    wait = cooldown_remaining(phone, now)
    if wait:
        raise OTPRateLimited(retry_after=wait)
    since = now - dt.timedelta(hours=1)
    recent = PhoneOTP.objects.filter(phone=phone, created_at__gte=since)
    if recent.count() >= settings.OTP_MAX_PER_HOUR:
        oldest = recent.order_by("created_at").values_list("created_at", flat=True).first()
        retry = int((oldest + dt.timedelta(hours=1) - now).total_seconds() + 0.999) if oldest else 3600
        raise OTPRateLimited(retry_after=max(retry, 1))
    code = dev_code() or f"{secrets.randbelow(10**6):06d}"
    otp = PhoneOTP.objects.create(
        phone=phone,
        code_hash=hash_code(phone, code),
        expires_at=timezone.now() + dt.timedelta(seconds=settings.OTP_TTL_SECONDS),
        ip=ip,
    )
    return otp, code


def verify(phone: str, code: str) -> bool:
    """Return True or raise otp_invalid / otp_expired.

    The error is raised *after* the transaction commits so a failed attempt is persisted
    (raising inside the atomic block would roll back the ``attempts`` increment).
    """
    error = _verify(phone, code)
    if error:
        raise APIError(error)
    return True


@transaction.atomic
def _verify(phone: str, code: str) -> str | None:
    code = (code or "").strip()
    dev = dev_code()
    otp = (
        PhoneOTP.objects.select_for_update()
        .filter(phone=phone, consumed_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if dev and hmac.compare_digest(code, dev):
        if otp:
            otp.consumed_at = timezone.now()
            otp.save(update_fields=["consumed_at"])
        return None
    if otp is None or otp.is_expired:
        return "otp_expired"
    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        return "otp_invalid"
    if not hmac.compare_digest(otp.code_hash, hash_code(phone, code)):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        return "otp_invalid"
    otp.consumed_at = timezone.now()
    otp.save(update_fields=["consumed_at"])
    return None
