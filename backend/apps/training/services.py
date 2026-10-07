"""Training domain logic: the shortage engine and enrolment status changes.

``shortages()`` is reused by insights (labour-market intelligence) — keep its signature and shape.
"""

from __future__ import annotations

import datetime as dt
from collections import defaultdict

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.core.bs import today_ad
from apps.core.serializers import trade_ref

from . import labels


def shortages(district: str | None = None, days: int = 90) -> list[dict]:
    """Per-trade demand vs supply of available verified workers.

    - ``demand`` = Σ max(openings_count − joined, 0) over non-draft jobs that are open now or were
      created in the last ``days`` days (district = the job's site district, else the org district).
    - ``supply`` = available (``is_available``) verified workers with that trade (district = current
      or permanent district).
    - ``shortage`` = max(demand − supply, 0); ``fill_rate`` = joined / openings over the same jobs
      (``None`` when there were no openings).
    Sorted by shortage desc, then demand desc. Trades with no jobs in the window and no supply are omitted.
    """
    from apps.hiring.models import JobOpening
    from apps.workers.models import Trade, Worker

    since = timezone.now() - dt.timedelta(days=days)
    jobs = (
        JobOpening.objects.exclude(status="draft")
        .filter(Q(status="open") | Q(created_at__gte=since))
        .annotate(joined=Count("applications", filter=Q(applications__stage="joined")))
    )
    if district:
        jobs = jobs.filter(
            Q(site__district_id=district) | Q(site__isnull=True, organization__district_id=district)
        )
    demand = defaultdict(int)
    openings = defaultdict(int)
    joined = defaultdict(int)
    open_jobs = defaultdict(int)
    for job in jobs.values("trade_id", "openings_count", "joined", "status"):
        t = job["trade_id"]
        demand[t] += max(job["openings_count"] - job["joined"], 0)
        openings[t] += job["openings_count"]
        joined[t] += min(job["joined"], job["openings_count"])
        if job["status"] == "open":
            open_jobs[t] += 1

    workers = Worker.objects.filter(is_available=True, verification_status="verified")
    if district:
        workers = workers.filter(Q(current_district_id=district) | Q(permanent_district_id=district))
    supply_rows = (
        workers.values("skills__trade_id")
        .exclude(skills__trade_id__isnull=True)
        .annotate(n=Count("id", distinct=True))
    )
    supply = {row["skills__trade_id"]: row["n"] for row in supply_rows}

    codes = set(demand) | set(supply)
    trades = {t.code: t for t in Trade.objects.filter(code__in=codes)}
    rows = []
    for code in codes:
        d, s = demand.get(code, 0), supply.get(code, 0)
        if d == 0 and s == 0 and not openings.get(code):
            continue
        rows.append(
            {
                "trade": trade_ref(trades.get(code)) or {"code": code, "name_en": code, "name_ne": code},
                "demand": d,
                "supply": s,
                "shortage": max(d - s, 0),
                "open_jobs": open_jobs.get(code, 0),
                "fill_rate": round(joined[code] / openings[code], 2) if openings.get(code) else None,
            }
        )
    rows.sort(key=lambda r: (-r["shortage"], -r["demand"], r["trade"]["code"]))
    return rows


def top_shortage_trades(n: int = 5, district: str | None = None) -> set[str]:
    return {r["trade"]["code"] for r in shortages(district=district)[:n] if r["shortage"] > 0}


ALLOWED = {
    "applied": {"enrolled", "rejected", "dropped", "completed"},
    "enrolled": {"completed", "dropped"},
    "completed": set(),
    "dropped": {"enrolled"},
    "rejected": {"enrolled"},
}


@transaction.atomic
def set_enrollment_status(enrollment, status: str, *, user=None, completed_on: dt.date | None = None):
    """Move an enrolment. Completing it creates a verified training Credential (issuer_partner)."""
    from apps.core.exceptions import InvalidState

    if status == enrollment.status:
        return enrollment
    if status not in ALLOWED.get(enrollment.status, set()):
        raise InvalidState()
    if status == "enrolled":
        course = enrollment.course
        taken = (
            course.enrollments.filter(status__in=["enrolled", "completed"]).exclude(pk=enrollment.pk).count()
        )
        if taken >= course.seats:
            raise InvalidState(message=_("All seats in this course are taken."))
    enrollment.status = status
    if status == "completed":
        enrollment.completed_on = completed_on or today_ad()
        enrollment.credential = _credential_for(enrollment, user)
    enrollment.save()
    return enrollment


def _credential_for(enrollment, user):
    from apps.credentials.models import Credential
    from apps.credentials.services import recompute_trust

    course = enrollment.course
    provider = course.provider
    level = str(labels.LEVEL.get(course.level, course.level))
    cred = Credential.objects.create(
        worker=enrollment.worker,
        kind="training_course",
        title=course.title,
        issuer=provider.name,
        level=level,
        issued_on=enrollment.completed_on,
        status="verified",
        verification_method="issuer_partner",
        verified_by=user if user is not None and getattr(user, "is_authenticated", False) else None,
        verified_at=timezone.now(),
        note=f"Completed {course.duration_days}-day course at {provider.name}.",
    )
    worker = enrollment.worker
    transaction.on_commit(lambda: recompute_trust(worker))
    return cred
