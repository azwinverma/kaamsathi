"""Partner consent grants, access logging, data payloads and signed webhooks."""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import logging
import time

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.core.exceptions import APIError

from .labels import DATA_SCOPES
from .models import ConsentGrant, Partner, PartnerAccessLog, PartnerAPIKey, new_webhook_secret

logger = logging.getLogger("kaamsathi.partners")

SIGNATURE_HEADER = "X-KaamSathi-Signature"
TIMESTAMP_HEADER = "X-KaamSathi-Timestamp"
WEBHOOK_TIMEOUT = (3, 5)  # connect, read seconds


# --------------------------------------------------------------------------- keys
def create_api_key(
    partner: Partner, scopes: list[str], name: str = "", user=None
) -> tuple[PartnerAPIKey, str]:
    from .auth import generate_key, hash_key

    full_key, prefix = generate_key()
    key = PartnerAPIKey.objects.create(
        partner=partner,
        name=name or "",
        prefix=prefix,
        key_hash=hash_key(full_key),
        scopes=sorted(set(scopes)),
        created_by=user if getattr(user, "is_authenticated", False) else None,
    )
    return key, full_key


def ensure_webhook_secret(partner: Partner) -> str:
    if not partner.webhook_secret:
        partner.webhook_secret = new_webhook_secret()
        partner.save(update_fields=["webhook_secret"])
    return partner.webhook_secret


# --------------------------------------------------------------------------- grants
def max_grant_days() -> int:
    return int(getattr(settings, "PARTNER_GRANT_MAX_DAYS", 90))


def _write_consent(worker, granted: bool, channel: str):
    """Audit row in workers.Consent (scope=history_share, organization=None)."""
    from apps.workers.models import Consent

    Consent.objects.create(
        worker=worker,
        organization=None,
        scope="history_share",
        granted=granted,
        channel=channel if channel in {"app", "sms", "paper", "ops"} else "app",
    )


@transaction.atomic
def create_grant(
    worker, partner: Partner, *, purpose: str, scopes, days: int, channel: str = "app"
) -> ConsentGrant:
    if not partner.is_active:
        raise APIError("invalid_state", message=_("This partner is not active."))
    scopes = sorted(set(scopes or []))
    bad = [s for s in scopes if s not in DATA_SCOPES]
    if not scopes or bad:
        raise APIError("validation_error", fields={"scopes": [_("Choose at least one valid data scope.")]})
    days = int(days)
    if days < 1 or days > max_grant_days():
        raise APIError(
            "validation_error",
            fields={"days": [_("Must be between 1 and %(max)s days.") % {"max": max_grant_days()}]},
        )
    now = timezone.now()
    grant = ConsentGrant.objects.create(
        worker=worker,
        partner=partner,
        purpose=purpose,
        scopes=scopes,
        granted_at=now,
        expires_at=now + dt.timedelta(days=days),
        channel=channel,
        status="active",
    )
    _write_consent(worker, True, channel)
    return grant


@transaction.atomic
def revoke_grant(grant: ConsentGrant, channel: str = "app") -> ConsentGrant:
    if grant.revoked_at is not None:
        return grant
    grant.revoked_at = timezone.now()
    grant.status = "revoked"
    grant.save(update_fields=["revoked_at", "status"])
    _write_consent(grant.worker, False, channel)
    return grant


def expire_due_grants(now=None) -> int:
    now = now or timezone.now()
    count = 0
    for grant in ConsentGrant.objects.filter(
        status="active", revoked_at__isnull=True, expires_at__lte=now
    ).select_related("worker"):
        with transaction.atomic():
            grant.status = "expired"
            grant.save(update_fields=["status"])
            _write_consent(grant.worker, False, grant.channel)
        count += 1
    return count


def active_grant(worker, partner: Partner, scope: str) -> ConsentGrant | None:
    """An active, unexpired, unrevoked grant from ``worker`` to ``partner`` covering ``scope``."""
    for grant in ConsentGrant.objects.active().filter(worker=worker, partner=partner).order_by("-granted_at"):
        if scope in (grant.scopes or []):
            return grant
    return None


# --------------------------------------------------------------------------- logging
def log_access(
    *, api_key: PartnerAPIKey, worker=None, endpoint: str, method: str, scope: str, status_code: int
):
    PartnerAccessLog.objects.create(
        partner_id=api_key.partner_id,
        api_key=api_key,
        worker=worker,
        endpoint=endpoint[:255],
        method=method[:8],
        scope=scope or "",
        status_code=status_code,
    )


def log_profile_view(worker, partner: Partner, object_id=None):
    """Delegate to trust (if installed) so the worker sees the view in their profile-view log."""
    try:
        from apps.trust.services import log_profile_view as trust_log
    except ImportError:
        return
    try:
        trust_log(worker, context="partner", partner=partner, object_id=object_id)
    except Exception:  # noqa: BLE001 - logging a view must never break the partner read
        logger.exception("trust.log_profile_view failed")


# --------------------------------------------------------------------------- payloads
def _trust(worker) -> tuple[int, int | None]:
    try:
        from apps.trust.models import WorkerTrust
    except ImportError:
        return (1 if worker.verification_status == "verified" else 0), None
    try:
        t = WorkerTrust.objects.filter(worker=worker).first()
    except Exception:  # noqa: BLE001 - table may not exist yet
        t = None
    if t is None:
        return (1 if worker.verification_status == "verified" else 0), None
    return t.verification_level, t.reliability_score


def passport_payload(worker, request=None) -> dict:
    """Verified-data profile for partners (CONTRACT-ECOSYSTEM §3 passport shape).

    Uses ``apps.credentials.services.passport_payload`` when available; otherwise builds the same
    shape from phase-1 data (no credentials).
    """
    try:
        from apps.credentials.services import passport_payload as cred_payload
    except ImportError:
        cred_payload = None
    if cred_payload is not None:
        from apps.credentials.services import get_passport, public_url

        try:
            verify_url = public_url(get_passport(worker))
            data = cred_payload(worker, include_contact=True, verify_url=verify_url, request=request)
        except Exception:  # noqa: BLE001
            logger.exception("credentials.passport_payload failed; using fallback")
            data = None
        if isinstance(data, dict):
            data.setdefault("contact", {"phone": worker.phone})
            return data
    return _fallback_passport(worker, request)


def _fallback_passport(worker, request=None) -> dict:
    from apps.core.serializers import district_ref, file_url, trade_ref
    from apps.workers.serializers import months_between
    from apps.workforce.models import Attendance

    today = timezone.localdate()
    skills = list(worker.skills.select_related("trade").all())
    employments = list(worker.employments.select_related("organization").all())
    since = today - dt.timedelta(days=180)
    att = Attendance.objects.filter(employment__worker=worker, date__gte=since)
    present = att.filter(status="present").count() + 0.5 * att.filter(status="half_day").count()
    counted = att.filter(status__in=["present", "half_day", "absent"]).count()
    level, reliability = _trust(worker)
    districts = [d for d in (worker.current_district, worker.permanent_district) if d is not None]
    return {
        "name": worker.full_name,
        "photo_url": file_url(request, worker.photo),
        "trade_primary": trade_ref(skills[0].trade) if skills else None,
        "districts": [district_ref(d) for d in dict.fromkeys(districts)],
        "verification_level": level,
        "reliability_score": reliability,
        "identity": {
            "citizenship": worker.verification_status == "verified" and bool(worker.citizenship_no),
            "phone": True,
            "address": worker.verification_status == "verified" and bool(worker.address),
        },
        "skills": [
            {"trade": trade_ref(s.trade), "years": s.years_experience, "nstb_level": s.nstb_level}
            for s in skills
        ],
        "credentials": [],
        "work": {
            "verified_employers": len({e.organization_id for e in employments}),
            "total_months": sum(months_between(e.start_date, e.end_date or today) for e in employments),
            "completed_jobs": sum(
                1
                for e in employments
                if e.status == "ended" and e.end_reason not in ("terminated", "absconded")
            ),
            "attendance_rate": round(present / counted, 3) if counted else None,
        },
        "availability": {
            "is_available": worker.is_available,
            "expected_monthly_wage": f"{worker.expected_monthly_wage:.2f}"
            if worker.expected_monthly_wage
            else None,
        },
        "contact": {"phone": worker.phone},
        "verify_url": None,
        "generated_at": timezone.now().isoformat(),
    }


# --------------------------------------------------------------------------- webhooks
def sign_payload(secret: str, timestamp: str, body: bytes) -> str:
    mac = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256)
    return "sha256=" + mac.hexdigest()


def send_webhook(partner: Partner, event: str, data: dict) -> bool:
    """POST a signed JSON event to the partner. Returns True on 2xx. Never raises on HTTP errors."""
    import requests

    if not partner.webhook_url:
        return False
    secret = ensure_webhook_secret(partner)
    body = json.dumps(
        {"event": event, "created_at": timezone.now().isoformat(), "data": data},
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    timestamp = str(int(time.time()))
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "KaamSathi-Webhooks/1.0",
        TIMESTAMP_HEADER: timestamp,
        SIGNATURE_HEADER: sign_payload(secret, timestamp, body),
    }
    resp = requests.post(partner.webhook_url, data=body, headers=headers, timeout=WEBHOOK_TIMEOUT)
    return 200 <= resp.status_code < 300


def notify_partner_referral(referral, event: str = "referral.created"):
    """Queue the outbound webhook (Celery, after commit) — never blocks the request."""
    from apps.notifications.services import enqueue

    from .tasks import send_referral_webhook

    if referral.partner.webhook_url:
        enqueue(send_referral_webhook, str(referral.pk), event)
