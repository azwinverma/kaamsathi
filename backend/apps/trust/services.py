"""Trust services. Other apps call ``log_profile_view`` and ``recompute_trust`` — keep the signatures
(docs/CONTRACT-ECOSYSTEM.md §1)."""

from __future__ import annotations

import datetime as dt
import logging
from decimal import ROUND_HALF_UP, Decimal

from django.apps import apps as django_apps
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import FieldError, ObjectDoesNotExist
from django.db import DatabaseError, transaction
from django.utils import timezone

from apps.core.bs import today_ad

from . import labels
from .models import ProfileView, WorkerTrust

logger = logging.getLogger("kaamsathi.trust")

# Reliability score weights (sum = 1).
WEIGHTS = {
    "employer_feedback": Decimal("0.30"),
    "attendance": Decimal("0.20"),
    "completion": Decimal("0.15"),
    "skills": Decimal("0.15"),
    "repeat_hiring": Decimal("0.10"),
    "stability": Decimal("0.10"),
}
ATTENDANCE_WINDOW_DAYS = 180
ATTENDANCE_MIN_DAYS = 10
EMPLOYMENT_VERIFIED_DAYS = 30
VIEW_DEDUPE_MINUTES = 10
RECOMPUTE_DEBOUNCE_SECONDS = 60
BAD_END_REASONS = {"terminated", "absconded"}


# --------------------------------------------------------------------------- profile views
def log_profile_view(
    worker, *, context, organization=None, partner=None, viewer=None, object_id=None
) -> None:
    """Record that ``viewer`` (or an org/partner) saw this worker's full profile.

    Never logs the worker viewing themself. Identical views within ``VIEW_DEDUPE_MINUTES`` are
    collapsed (page refreshes). Never raises — a logging failure must not break the caller.
    """
    try:
        if worker is None:
            return
        viewer_id = getattr(viewer, "pk", None) if viewer is not None else None
        if viewer_id is not None and getattr(viewer, "is_authenticated", True) is False:
            viewer_id = None
        if viewer_id is not None and worker.user_id and worker.user_id == viewer_id:
            return
        org_id = getattr(organization, "pk", organization)
        partner_id = getattr(partner, "pk", partner)
        obj = str(object_id) if object_id is not None else None
        since = timezone.now() - dt.timedelta(minutes=VIEW_DEDUPE_MINUTES)
        recent = ProfileView.objects.filter(
            worker=worker,
            organization_id=org_id,
            partner_id=partner_id,
            viewer_id=viewer_id,
            context=context,
            object_id=obj,
            created_at__gte=since,
        )
        if recent.exists():
            return
        ProfileView.objects.create(
            worker=worker,
            organization_id=org_id,
            partner_id=partner_id,
            viewer_id=viewer_id,
            context=context,
            object_id=obj,
        )
    except Exception:  # noqa: BLE001 - logging a view must never break serving the profile
        logger.exception("Could not log profile view for worker %s", getattr(worker, "pk", None))


# --------------------------------------------------------------------------- credentials (lazy)
def _optional_exists(app_label: str, model_name: str, **filters) -> bool:
    """``exists()`` on a model that may not be installed/migrated yet (credentials is phase 2)."""
    try:
        model = django_apps.get_model(app_label, model_name)
    except LookupError:
        return False
    try:
        with transaction.atomic():
            return model.objects.filter(**filters).exists()
    except (DatabaseError, FieldError, ValueError):
        return False


def has_verified_credential(worker) -> bool:
    return _optional_exists("credentials", "Credential", worker=worker, status="verified")


def has_passed_assessment(worker) -> bool:
    return _optional_exists("credentials", "SkillAssessment", worker=worker, result="pass")


def verified_external_months(worker, today) -> list[float]:
    """Tenure (months) of each verified external work-history entry (apps.experience)."""
    try:
        model = django_apps.get_model("experience", "WorkHistoryEntry")
    except LookupError:
        return []
    try:
        with transaction.atomic():
            rows = list(
                model.objects.filter(worker=worker, status="verified").values_list("start_date", "end_date")
            )
    except (DatabaseError, FieldError, ValueError):
        return []
    return [max(((end or today) - start).days, 0) / 30 for start, end in rows]


# --------------------------------------------------------------------------- score components
def _q(value) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.0001"), ROUND_HALF_UP))


def _tenure_months(employment, today) -> float:
    end = employment.end_date or today
    return max((end - employment.start_date).days, 0) / 30


def _employer_rating_avg(employment):
    ratings = [r for r in employment.ratings.all() if r.rater == "employer" and not r.voided]
    if not ratings:
        return None
    return (ratings[0].score_a + ratings[0].score_b) / 2


class _Facts:
    """Everything the score and level need, loaded once per worker."""

    def __init__(self, worker, today=None):
        from apps.workforce.models import Attendance

        self.worker = worker
        self.today = today or today_ad()
        self.employments = list(
            worker.employments.select_related("organization").prefetch_related("ratings").all()
        )
        since = self.today - dt.timedelta(days=ATTENDANCE_WINDOW_DAYS - 1)
        rows = Attendance.objects.filter(
            employment__worker=worker, date__gte=since, date__lte=self.today
        ).values_list("status", flat=True)
        self.att = {"present": 0, "half_day": 0, "absent": 0}
        for status in rows:
            if status in self.att:
                self.att[status] += 1
        self.worked_days_by_employment = {}
        if self.employments:
            from django.db.models import Count

            for row in (
                Attendance.objects.filter(employment__in=self.employments, status__in=["present", "half_day"])
                .values("employment_id")
                .annotate(n=Count("id"))
            ):
                self.worked_days_by_employment[row["employment_id"]] = row["n"]
        self.external_months = verified_external_months(worker, self.today)
        self.verified_credential = has_verified_credential(worker)
        self.passed_assessment = has_passed_assessment(worker)
        self.nstb_declared = any(s.nstb_level not in (None, "", "none") for s in worker.skills.all())

    # -- components (each 0–1) -------------------------------------------------
    def employer_feedback(self) -> float:
        avgs = [a for a in (_employer_rating_avg(e) for e in self.employments) if a is not None]
        if not avgs:
            return 0.7
        return (sum(avgs) / len(avgs)) / 5

    def attendance(self) -> float:
        p, h, a = self.att["present"], self.att["half_day"], self.att["absent"]
        days = p + h + a
        if days < ATTENDANCE_MIN_DAYS:
            return 0.8
        return (p + 0.5 * h) / days

    def completion(self) -> float:
        ended = [e for e in self.employments if e.status == "ended"]
        if not ended:
            return 1.0
        good = [e for e in ended if e.end_reason not in BAD_END_REASONS]
        return len(good) / len(ended)

    def skills(self) -> float:
        if self.verified_credential:
            return 1.0
        if self.passed_assessment:
            return 0.7
        if self.nstb_declared:
            return 0.4
        return 0.2

    def repeat_hiring(self) -> float:
        per_org: dict = {}
        for e in self.employments:
            per_org[e.organization_id] = per_org.get(e.organization_id, 0) + 1
        rehired = any(n >= 2 for n in per_org.values())
        good_orgs = {e.organization_id for e in self.employments if (_employer_rating_avg(e) or 0) >= 4}
        if rehired or len(good_orgs) >= 2:
            return 1.0
        if len(good_orgs) == 1:
            return 0.5
        return 0.3

    def stability(self) -> float:
        # Verified external work history counts like a platform employment (CONTRACT-EXTENSIONS §3).
        tenures = [_tenure_months(e, self.today) for e in self.employments] + self.external_months
        if not tenures:
            return 0.0
        return min(sum(tenures) / len(tenures) / 12, 1.0)

    def total_months(self) -> float:
        return sum(_tenure_months(e, self.today) for e in self.employments)

    # -- level helpers -----------------------------------------------------------
    def employment_verified(self) -> bool:
        if self.external_months:  # a verified reference / employer confirmation of past work
            return True
        for e in self.employments:
            if self.worked_days_by_employment.get(e.id, 0) >= EMPLOYMENT_VERIFIED_DAYS:
                return True
            if e.status == "ended" and _employer_rating_avg(e) is not None:
                return True
        return False


def compute_reliability(facts: _Facts) -> tuple[int | None, dict]:
    """Reliability score 0–100 (``None`` when the worker has no employment) and its breakdown."""
    breakdown = {
        "employer_feedback": _q(facts.employer_feedback()),
        "attendance": _q(facts.attendance()),
        "completion": _q(facts.completion()),
        "skills": _q(facts.skills()),
        "repeat_hiring": _q(facts.repeat_hiring()),
        "stability": _q(facts.stability()),
    }
    if not facts.employments:
        return None, breakdown
    total = sum(WEIGHTS[k] * Decimal(str(v)) for k, v in breakdown.items()) * 100
    return int(total.quantize(Decimal("1"), ROUND_HALF_UP)), breakdown


def compute_level(facts: _Facts, reliability: int | None) -> int:
    """Highest cumulative verification level 0–5."""
    w = facts.worker
    checks = [
        lambda: w.verification_status == "verified",  # 1 identity
        facts.employment_verified,  # 2 employment
        lambda: facts.passed_assessment,  # 3 skills assessed
        lambda: facts.verified_credential,  # 4 certification
        lambda: (
            (reliability or 0) >= 85 and facts.total_months() + sum(facts.external_months) >= 12
        ),  # 5 highly trusted
    ]
    level = 0
    for check in checks:
        if not check():
            break
        level += 1
    return level


def recompute_trust(worker) -> WorkerTrust:
    """Recompute and store the worker's verification level and reliability score."""
    facts = _Facts(worker)
    score, breakdown = compute_reliability(facts)
    level = compute_level(facts, score)
    breakdown["months_on_platform"] = round(facts.total_months(), 1)
    trust, _ = WorkerTrust.objects.update_or_create(
        worker=worker,
        defaults={"verification_level": level, "reliability_score": score, "breakdown": breakdown},
    )
    return trust


def get_trust(worker, *, compute=True) -> WorkerTrust | None:
    """Cached WorkerTrust (computed on first access when ``compute``)."""
    try:
        return worker.trust
    except ObjectDoesNotExist:
        return recompute_trust(worker) if compute else None


def next_steps(worker, trust: WorkerTrust) -> list[str]:
    """Localised hints for raising the level / score."""
    b = trust.breakdown or {}
    steps = []
    level = trust.verification_level
    if worker.verification_status != "verified":
        steps.append("verify_identity")
    if level < 2:
        steps.append("build_history")
    if b.get("skills", 0) < 0.7:
        steps.append("assessment")
    if b.get("skills", 0) < 1.0:
        steps.append("certificate")
    if trust.reliability_score is not None and b.get("attendance", 1) < 0.8:
        steps.append("attendance")
    if trust.reliability_score is not None and b.get("stability", 1) < 0.5:
        steps.append("tenure")
    return [str(labels.NEXT_STEPS[k]) for k in steps]


BREAKDOWN_KEYS = ("employer_feedback", "attendance", "completion", "skills", "repeat_hiring", "stability")


def trust_payload(worker, trust: WorkerTrust) -> dict:
    b = trust.breakdown or {}
    return {
        "verification_level": trust.verification_level,
        "verification_level_label": labels.level_label(trust.verification_level),
        "reliability_score": trust.reliability_score,
        "breakdown": {k: b.get(k) for k in BREAKDOWN_KEYS},
        "next_steps": next_steps(worker, trust),
        "computed_at": timezone.localtime(trust.computed_at).isoformat() if trust.computed_at else None,
    }


# --------------------------------------------------------------------------- debounced recompute
def _cache_key(worker_id) -> str:
    return f"trust:recompute:{worker_id}"


def schedule_recompute(worker_id) -> None:
    """Debounced (per worker) background recompute once the current transaction commits.

    The debounce key is taken at commit time, so a rolled-back transaction never blocks later runs.
    """
    if not worker_id:
        return

    def _send():
        from .tasks import recompute_worker

        try:
            if not cache.add(_cache_key(worker_id), 1, RECOMPUTE_DEBOUNCE_SECONDS):
                return  # one is already queued
        except Exception:  # noqa: BLE001 - cache down: recompute without debounce
            logger.warning("Cache unavailable; recomputing trust without debounce")
        try:
            if settings.CELERY_TASK_ALWAYS_EAGER:
                recompute_worker.apply(args=[str(worker_id)])
            else:
                recompute_worker.apply_async(args=[str(worker_id)], countdown=RECOMPUTE_DEBOUNCE_SECONDS)
        except Exception as exc:  # noqa: BLE001 - broker down → inline
            logger.warning("Celery unavailable (%s); recomputing trust inline", exc)
            try:
                recompute_worker.apply(args=[str(worker_id)])
            except Exception:  # noqa: BLE001
                logger.exception("Inline trust recompute failed for %s", worker_id)

    transaction.on_commit(_send)


def clear_scheduled(worker_id) -> None:
    try:
        cache.delete(_cache_key(worker_id))
    except Exception:  # noqa: BLE001
        pass


# --------------------------------------------------------------------------- employer reputation
REPUTATION_MIN_RATINGS = 3


def employer_reputation(organization) -> dict | None:
    """Aggregated worker→employer ratings; ``None`` below 3 ratings (protects individual raters)."""
    from django.db.models import Avg, Count

    from apps.workers.models import Rating

    agg = Rating.objects.filter(
        employment__organization=organization, rater="worker", voided=False
    ).aggregate(
        a=Avg("score_a"), b=Avg("score_b"), n=Count("id")
    )
    if not agg["n"] or agg["n"] < REPUTATION_MIN_RATINGS:
        return None
    return {
        "pay_on_time_avg": round(float(agg["a"]), 1),
        "conditions_avg": round(float(agg["b"]), 1),
        "count": agg["n"],
    }
