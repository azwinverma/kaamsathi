"""Credentials domain logic: verification, passport payload, share links, expiry."""

from __future__ import annotations

import datetime as dt
import logging

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.utils import timezone

from apps.core.bs import bs_str, today_ad
from apps.core.money import money_str
from apps.core.serializers import district_ref, trade_ref

from . import labels
from .models import SHARE_MAX_DAYS, Credential, Passport, PassportShare, SkillAssessment, generate_public_code
from .verifiers import get_verifier

logger = logging.getLogger("kaamsathi.credentials")

BAD_END_REASONS = {"terminated", "absconded"}


# --- trust integration (apps.trust is built in parallel; never hard-depend on it) -------------


def trust_call(name: str, *args, **kwargs):
    """Call ``apps.trust.services.<name>`` if it exists; no-op (None) otherwise."""
    try:
        from apps.trust import services as trust_services

        fn = getattr(trust_services, name)
    except (ImportError, AttributeError):
        return None
    try:
        return fn(*args, **kwargs)
    except Exception:  # noqa: BLE001 - trust must never break credentials flows
        logger.exception("trust.%s failed", name)
        return None


def recompute_trust(worker) -> None:
    trust_call("recompute_trust", worker)


def log_profile_view(worker, **kwargs) -> None:
    trust_call("log_profile_view", worker, **kwargs)


# --- verification -----------------------------------------------------------------------------


@transaction.atomic
def verify_credential(credential: Credential, *, status: str, method: str, note: str = "", user=None):
    """Apply a verification decision through the adapter. Raises ``NotConfigured`` for live modes."""
    verifier = get_verifier(method, status=status, note=note or "")
    result = verifier.verify(credential)
    credential.status = result.status
    credential.verification_method = result.method
    credential.verified_by = user if user is not None and user.is_authenticated else None
    credential.verified_at = timezone.now()
    if result.note:
        credential.note = result.note
    if result.status == "verified" and credential.expires_on and credential.expires_on < today_ad():
        credential.status = "expired"
    credential.save()
    transaction.on_commit(lambda: recompute_trust(credential.worker))
    return credential


# --- passport ----------------------------------------------------------------------------------


def get_passport(worker) -> Passport:
    """Lazily create the worker's Passport (unique 10-char public code)."""
    passport = Passport.objects.filter(worker=worker).first()
    if passport:
        return passport
    for _ in range(8):
        try:
            with transaction.atomic():
                return Passport.objects.create(worker=worker, public_code=generate_public_code())
        except IntegrityError:
            existing = Passport.objects.filter(worker=worker).first()
            if existing:
                return existing
    raise RuntimeError("Could not allocate a passport code")


def public_url(passport: Passport) -> str:
    return f"{settings.PUBLIC_WEB_URL.rstrip('/')}/p/{passport.public_code}"


def share_url(share: PassportShare) -> str:
    return f"{settings.PUBLIC_WEB_URL.rstrip('/')}/p/s/{share.token}"


def verified_credentials(worker, on: dt.date | None = None):
    on = on or today_ad()
    return (
        Credential.objects.filter(worker=worker, status="verified")
        .filter(Q(expires_on__isnull=True) | Q(expires_on__gte=on))
        .order_by("-issued_on", "-created_at")
    )


def _local_trust(worker, has_verified_credential: bool, has_passed_assessment: bool) -> tuple[int, None]:
    """Fallback verification level when apps.trust is unavailable (reliability unknown → None)."""
    level = 0
    if worker.verification_status == "verified":
        level = 1
        if has_passed_assessment:
            level = 3
        if has_verified_credential:
            level = 4
    return level, None


def trust_snapshot(
    worker, has_verified_credential: bool, has_passed_assessment: bool
) -> tuple[int, int | None]:
    try:
        from apps.trust.models import WorkerTrust  # noqa: PLC0415

        row = WorkerTrust.objects.filter(worker=worker).first()
    except (ImportError, AttributeError, LookupError):
        row = None
    except Exception:  # noqa: BLE001 - table may not exist yet while trust is being built
        logger.debug("WorkerTrust lookup failed", exc_info=True)
        row = None
    if row is None:
        row = trust_call("recompute_trust", worker)
    if row is not None and hasattr(row, "verification_level"):
        return int(row.verification_level or 0), row.reliability_score
    return _local_trust(worker, has_verified_credential, has_passed_assessment)


def work_summary(worker) -> dict:
    """Work facts recorded on the platform by employers (verified by construction)."""
    from apps.workforce.models import Attendance, Employment

    today = today_ad()
    employments = list(Employment.objects.filter(worker=worker))
    total_days = 0
    for e in employments:
        end = e.end_date or today
        if end >= e.start_date:
            total_days += (min(end, today) - e.start_date).days
    ended = [e for e in employments if e.status == "ended"]
    since = today - dt.timedelta(days=180)
    att = Attendance.objects.filter(employment__worker=worker, date__gte=since, date__lte=today)
    present = att.filter(status="present").count()
    half = att.filter(status="half_day").count()
    absent = att.filter(status="absent").count()
    denom = present + half + absent
    rate = round((present + 0.5 * half) / denom, 2) if denom >= 10 else None
    return {
        "verified_employers": len({e.organization_id for e in employments}),
        "total_months": total_days // 30,
        "completed_jobs": len([e for e in ended if e.end_reason not in BAD_END_REASONS]),
        "attendance_rate": rate,
    }


def external_work(worker) -> list[dict]:
    """Verified off-platform work history (apps.experience; docs/CONTRACT-EXTENSIONS.md §3)."""
    try:
        from apps.experience.services import passport_entries  # noqa: PLC0415
    except ImportError:
        return []
    return passport_entries(worker)


def passport_photo_url(worker, request=None) -> str | None:
    """Anonymous short-lived photo URL; re-checked at download (passport still public/shared)."""
    from apps.core.files import signed_url

    if not worker.photo:
        return None
    return signed_url(worker.photo, None, request, check=f"passport_photo:{worker.pk}")


def can_download_credential(rest: str, user, name: str) -> bool:
    cred = Credential.objects.select_related("worker").filter(pk=rest).first()
    if cred is None or not cred.document or cred.document.name != name:
        return False
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    return bool(user.is_staff or (cred.worker.user_id and cred.worker.user_id == user.pk))


def can_download_passport_photo(rest: str, user, name: str) -> bool:
    from apps.workers.models import Worker

    worker = Worker.objects.filter(pk=rest).first()
    if worker is None or not worker.photo or worker.photo.name != name:
        return False
    if Passport.objects.filter(worker=worker, is_public=True).exists():
        return True
    return PassportShare.objects.filter(
        worker=worker, revoked_at__isnull=True, expires_at__gt=timezone.now()
    ).exists()


def passport_payload(worker, *, include_contact: bool, verify_url: str, request=None) -> dict:
    """Skill Passport (verified data only). Shared by public, share, PDF and partner endpoints."""
    worker = type(worker).objects.select_related("current_district", "permanent_district").get(pk=worker.pk)
    creds = list(verified_credentials(worker))
    assessments = list(SkillAssessment.objects.filter(worker=worker, result="pass").select_related("trade"))
    level, reliability = trust_snapshot(worker, bool(creds), bool(assessments))
    has_nstb = any(c.kind == "nstb" for c in creds)
    skills = list(worker.skills.select_related("trade").order_by("-years_experience"))
    identity_verified = worker.verification_status == "verified"

    districts = []
    for d in (worker.current_district, worker.permanent_district):
        ref = district_ref(d)
        if ref and ref not in districts:
            districts.append(ref)

    payload = {
        "name": worker.full_name,
        "name_ne": worker.full_name_ne or None,
        "photo_url": passport_photo_url(worker, request) if identity_verified else None,
        "trade_primary": trade_ref(skills[0].trade) if skills else None,
        "districts": districts,
        "verification_level": level,
        "reliability_score": reliability,
        "identity": {
            "citizenship": identity_verified and bool(worker.citizenship_no or worker.nid_no),
            "phone": bool(worker.phone),
            "address": identity_verified and bool(worker.address),
        },
        "skills": [
            {
                "trade": trade_ref(s.trade),
                "years": s.years_experience,
                # A declared NSTB level is shown only once an NSTB certificate has been verified.
                "nstb_level": s.nstb_level if has_nstb and s.nstb_level not in ("none", "") else None,
            }
            for s in skills
        ],
        "assessments": [
            {
                "trade": trade_ref(a.trade),
                "level": a.level or None,
                "assessed_on": a.assessed_on.isoformat(),
                "assessed_on_bs": bs_str(a.assessed_on),
            }
            for a in assessments
        ],
        "credentials": [
            {
                "kind": c.kind,
                "kind_label": str(labels.KIND.get(c.kind, c.kind)),
                "title": c.title,
                "issuer": c.issuer,
                "level": c.level or None,
                "certificate_no": c.certificate_no or None,
                "issued_on": c.issued_on.isoformat() if c.issued_on else None,
                "issued_on_bs": bs_str(c.issued_on),
                "expires_on": c.expires_on.isoformat() if c.expires_on else None,
                "expires_on_bs": bs_str(c.expires_on),
                "verified": True,
            }
            for c in creds
        ],
        "work": {**work_summary(worker), "external": external_work(worker)},
        "availability": {
            "is_available": worker.is_available,
            "expected_monthly_wage": money_str(worker.expected_monthly_wage)
            if worker.expected_monthly_wage
            else None,
        },
        "verify_url": verify_url,
        "generated_at": timezone.localtime().isoformat(),
    }
    if include_contact:
        payload["contact"] = {"phone": worker.phone}
    return payload


# --- shares ------------------------------------------------------------------------------------


def create_share(worker, *, audience_label: str, purpose: str, days: int, include_contact: bool):
    days = max(1, min(int(days), SHARE_MAX_DAYS))
    get_passport(worker)
    return PassportShare.objects.create(
        worker=worker,
        audience_label=audience_label,
        purpose=purpose,
        expires_at=timezone.now() + dt.timedelta(days=days),
        include_contact=include_contact,
    )


def active_share(token: str) -> PassportShare | None:
    return (
        PassportShare.objects.select_related("worker")
        .filter(token=token, revoked_at__isnull=True, expires_at__gt=timezone.now())
        .first()
    )


def register_share_view(share: PassportShare) -> None:
    PassportShare.objects.filter(pk=share.pk).update(views=F("views") + 1)


# --- expiry ------------------------------------------------------------------------------------


def expiring_for_org(org, days: int):
    """Credentials of the org's active workers expiring within ``days`` (today included)."""
    today = today_ad()
    return (
        Credential.objects.filter(
            worker__employments__organization=org,
            worker__employments__status="active",
            status__in=["verified", "pending"],
            expires_on__gte=today,
            expires_on__lte=today + dt.timedelta(days=days),
        )
        .select_related("worker")
        .distinct()
        .order_by("expires_on")
    )
