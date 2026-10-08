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
from django.utils.translation import pgettext

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
    if status == "completed":
        _check_attendance(enrollment)
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


# --------------------------------------------------------------------------- sessions (T006)
def attendance_summary(enrollment) -> dict:
    """``{sessions, present, pct|None}`` — pct over sessions held so far (date ≤ today)."""
    from .models import SessionAttendance, TrainingSession

    held = TrainingSession.objects.filter(course_id=enrollment.course_id, date__lte=today_ad())
    n = held.count()
    present = SessionAttendance.objects.filter(enrollment=enrollment, session__in=held, present=True).count()
    return {"sessions": n, "present": present, "pct": round(present * 100 / n) if n else None}


def _check_attendance(enrollment) -> None:
    from apps.core.exceptions import InvalidState

    required = enrollment.course.min_attendance_pct or 0
    if not required:
        return
    summary = attendance_summary(enrollment)
    if summary["sessions"] and (summary["pct"] or 0) < required:
        raise InvalidState(
            message=pgettext("complete1", "Attendance %(pct)s%% is below the %(req)s%% this course requires.")
            % {"pct": summary["pct"] or 0, "req": required}
        )


# --------------------------------------------------------------------------- outcomes (T010)
K_ANON = 5
PLACEMENT_WINDOW_DAYS = 90
RETENTION_DAYS = 90


def _monthly_wage(emp):
    """Monthly-equivalent contracted wage of an employment (daily × 26 working days)."""
    from decimal import Decimal

    if emp.wage_type == "monthly":
        return (
            (emp.basic_salary or Decimal(0))
            + (emp.dearness_allowance or Decimal(0))
            + (emp.other_allowance or Decimal(0))
        )
    if emp.wage_type == "daily" and emp.daily_wage:
        return emp.daily_wage * 26
    return None


def _median(values):
    import statistics

    values = [v for v in values if v is not None]
    if len(values) < K_ANON:
        return None
    return f"{statistics.median(values):.2f}"


def _k(n):
    return n if n >= K_ANON else None


def course_outcomes(course, today=None) -> dict:
    """Per-course funnel enrolled → completed → placed ≤ 90 days → still employed at 90 days, and
    median monthly wage before (last job ending before the course) / after (the placement).
    Every count below 5 is suppressed (``None``); the whole row when fewer than 5 enrolled."""
    from apps.workforce.models import Employment

    today = today or today_ad()
    enrollments = list(
        course.enrollments.filter(status__in=["enrolled", "completed", "dropped"]).select_related("worker")
    )
    enrolled = len(enrollments)
    completed = [e for e in enrollments if e.status == "completed" and e.completed_on]
    placed = judged = retained = 0
    before, after = [], []
    worker_ids = [e.worker_id for e in completed]
    emps_by_worker: dict = {}
    for emp in Employment.objects.filter(worker_id__in=worker_ids).order_by("start_date"):
        emps_by_worker.setdefault(emp.worker_id, []).append(emp)
    for e in completed:
        emps = emps_by_worker.get(e.worker_id, [])
        window_end = e.completed_on + dt.timedelta(days=PLACEMENT_WINDOW_DAYS)
        placement = next((x for x in emps if e.completed_on <= x.start_date <= window_end), None)
        prior = [x for x in emps if x.start_date < course.starts_on]
        if prior:
            before.append(_monthly_wage(prior[-1]))
        if placement is None:
            continue
        placed += 1
        after.append(_monthly_wage(placement))
        mark = placement.start_date + dt.timedelta(days=RETENTION_DAYS)
        if mark <= today:
            judged += 1
            if placement.end_date is None or placement.end_date >= mark:
                retained += 1
    suppressed = enrolled < K_ANON

    def rate(num, den):
        return round(num * 100 / den, 1) if den >= K_ANON and num is not None else None

    row = {
        "enrolled": None if suppressed else enrolled,
        "completed": None if suppressed else _k(len(completed)),
        "placed_90d": None if suppressed else _k(placed),
        "retention_judged": None if suppressed else _k(judged),
        "retained_90d": None if suppressed else _k(retained),
        "completion_rate": None if suppressed else rate(len(completed), enrolled),
        "placement_rate": None if suppressed else rate(placed, len(completed)),
        "retention_rate": None if suppressed else rate(retained, judged),
        "median_wage_before": None if suppressed else _median(before),
        "median_wage_after": None if suppressed else _median(after),
        "suppressed": suppressed,
    }
    return row


def outcomes(*, provider=None, course=None, trade=None) -> dict:
    from .models import Course
    from .serializers import course_ref

    qs = Course.objects.select_related("provider", "trade")
    if provider:
        qs = qs.filter(provider_id=provider)
    if course:
        qs = qs.filter(pk=course)
    if trade:
        qs = qs.filter(trade_id=trade)
    rows = [{"course": course_ref(c), **course_outcomes(c)} for c in qs.order_by("-starts_on")]
    return {
        "k_anonymity": K_ANON,
        "placement_window_days": PLACEMENT_WINDOW_DAYS,
        "retention_days": RETENTION_DAYS,
        "courses": rows,
    }
