"""OTP issue/verify: hashed codes, 5-min expiry, 5 attempts, 5 requests/phone/hour."""

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


def issue(phone: str, ip=None) -> tuple[PhoneOTP, str]:
    since = timezone.now() - dt.timedelta(hours=1)
    if PhoneOTP.objects.filter(phone=phone, created_at__gte=since).count() >= settings.OTP_MAX_PER_HOUR:
        raise APIError("otp_rate_limited", status_code=429)
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
