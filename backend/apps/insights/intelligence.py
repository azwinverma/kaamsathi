"""District heatmap, platform KPIs and worker career recommendations (docs/CONTRACT-EXTENSIONS.md §5).

Same k-anonymity rule as ``services.py``: any value describing workers is suppressed (null,
``suppressed: true``) when it rests on 1..K-1 distinct workers.
"""

from __future__ import annotations

import datetime as dt
import statistics
from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Q
from django.utils import timezone

from apps.core.money import money_str

from .services import DAILY_TO_MONTHLY_DAYS, K_ANONYMITY, certification_uplift

HEATMAP_METRICS = ("demand", "supply", "shortage", "median_wage")
KPI_PERIODS = (30, 90, 365)
PHASE1_TARGETS = {
    "workers": 1000,
    "organizations": 50,
    "paying_organizations": 20,
    "placements": 100,
    "median_fill_days": 14,
}


# =========================================================================== heatmap
def _worker_district(row) -> str | None:
    return row["current_district_id"] or row["permanent_district_id"]


def _district_demand(trade=None) -> dict[str, int]:
    """Open positions (openings − joined) on open jobs, by the job's site district (else org's)."""
    from apps.hiring.models import JobOpening

    jobs = JobOpening.objects.filter(status="open").annotate(
        joined=Count("applications", filter=Q(applications__stage="joined"))
    )
    if trade:
        jobs = jobs.filter(trade_id=trade)
    out: dict[str, int] = defaultdict(int)
    for j in jobs.values("openings_count", "joined", "site__district_id", "organization__district_id"):
        d = j["site__district_id"] or j["organization__district_id"]
        out[d] += max(j["openings_count"] - j["joined"], 0)
    return out


def _district_supply(trade=None) -> dict[str, int]:
    """Available verified workers (with the trade), by current district (else permanent)."""
    from apps.workers.models import Worker

    qs = Worker.objects.filter(is_available=True, verification_status="verified")
    if trade:
        qs = qs.filter(skills__trade_id=trade)
    out: dict[str, set] = defaultdict(set)
    for r in qs.values("id", "current_district_id", "permanent_district_id").distinct():
        d = _worker_district(r)
        if d:
            out[d].add(r["id"])
    return {d: len(ws) for d, ws in out.items()}


def _district_wages(trade=None) -> dict[str, list[float]]:
    """Latest monthly-equivalent wage per worker from employments active or ended in the last year."""
    from apps.workforce.models import Employment

    since = timezone.localdate() - dt.timedelta(days=365)
    qs = Employment.objects.filter(Q(status="active") | Q(end_date__gte=since))
    if trade:
        qs = qs.filter(trade_id=trade)
    per: dict[str, dict] = defaultdict(dict)
    for r in qs.values(
        "worker_id",
        "site__district_id",
        "organization__district_id",
        "wage_type",
        "basic_salary",
        "dearness_allowance",
        "other_allowance",
        "daily_wage",
        "hourly_wage",
        "start_date",
    ).order_by("start_date"):
        d = r["site__district_id"] or r["organization__district_id"]
        if r["wage_type"] == "daily":
            monthly = (r["daily_wage"] or 0) * DAILY_TO_MONTHLY_DAYS
        elif r["wage_type"] == "hourly":
            monthly = (r["hourly_wage"] or 0) * 8 * DAILY_TO_MONTHLY_DAYS
        else:
            monthly = (r["basic_salary"] or 0) + (r["dearness_allowance"] or 0) + (r["other_allowance"] or 0)
        if monthly and d:
            per[d][r["worker_id"]] = float(monthly)
    return {d: list(v.values()) for d, v in per.items()}


def heatmap(metric: str, trade: str | None = None) -> dict:
    from apps.geo.models import District
    from apps.workers.models import Trade

    demand = _district_demand(trade) if metric in ("demand", "shortage") else {}
    supply = _district_supply(trade) if metric in ("supply", "shortage") else {}
    wages = _district_wages(trade) if metric == "median_wage" else {}

    cells = []
    for d in District.objects.select_related("province").order_by("province_id", "name_en"):
        value, suppressed, sample = None, False, None
        if metric == "demand":
            value = demand.get(d.code, 0)  # job openings, not people: no suppression needed
        elif metric == "supply":
            n = supply.get(d.code, 0)
            suppressed = 0 < n < K_ANONYMITY
            value = None if suppressed else n
        elif metric == "shortage":
            n = supply.get(d.code, 0)
            # shortage = demand − supply would reveal a small supply count: suppress with it.
            suppressed = 0 < n < K_ANONYMITY
            value = None if suppressed else max(demand.get(d.code, 0) - n, 0)
        else:  # median_wage
            vals = wages.get(d.code, [])
            suppressed = 0 < len(vals) < K_ANONYMITY
            if len(vals) >= K_ANONYMITY:
                value = money_str(statistics.median(vals))
                sample = len(vals)
        cells.append(
            {
                "district": {
                    "code": d.code,
                    "name_en": d.name_en,
                    "name_ne": d.name_ne,
                    "province": {
                        "code": d.province.code,
                        "name_en": d.province.name_en,
                        "name_ne": d.province.name_ne,
                    },
                },
                "value": value,
                "sample": sample,
                "suppressed": suppressed,
            }
        )
    numeric = [float(c["value"]) for c in cells if c["value"] is not None]
    trade_obj = Trade.objects.filter(code=trade).first() if trade else None
    return {
        "metric": metric,
        "trade": (
            {"code": trade_obj.code, "name_en": trade_obj.name_en, "name_ne": trade_obj.name_ne}
            if trade_obj
            else None
        ),
        "k_anonymity": K_ANONYMITY,
        "min": min(numeric) if numeric else None,
        "max": max(numeric) if numeric else None,
        "cells": cells,
        "generated_at": timezone.now().isoformat(),
    }


# =========================================================================== KPIs
def _median(values):
    return round(statistics.median(values), 1) if values else None


def _ratio(num, den, nd=3):
    return round(num / den, nd) if den else None


def _avg_rating(rater: str, since) -> float | None:
    from apps.workers.models import Rating

    rows = list(
        Rating.objects.filter(rater=rater, created_at__gte=since, voided=False).values_list(
            "score_a", "score_b"
        )
    )
    if not rows:
        return None
    return round(statistics.fmean((a + b) / 2 for a, b in rows), 2)


def kpis(days: int = 30, now=None) -> dict:
    """Platform KPIs for the last ``days`` days plus phase-1 exit criteria (all-time counts).

    Definitions:
    - time_to_fill_days_median: job published (else created) → application ``joined``, for joins
      in the period.
    - time_to_shortlist_hours_median: published → first shortlist, for jobs published in the period.
    - fill_rate: positions joined / positions offered on non-draft jobs published (else created)
      in the period.
    - placements: applications that reached ``joined`` in the period.
    - placement_revenue: placement charges raised in the period (excluding waived).
    - repeat_employer_rate: organisations with a placement in the period that also had a placement before it.
    - worker_activation_rate: workers registered in the period who reached shortlist or got employed.
    - verified_workers_added: workers verified in the period.
    - dispute_rate: disputes raised in the period / employments starting in the period.
    """
    from apps.billing.models import Charge
    from apps.hiring.models import Application, JobOpening, StageEvent
    from apps.orgs.models import Organization
    from apps.workers.models import Worker
    from apps.workforce.models import Employment

    now = now or timezone.now()
    since = now - dt.timedelta(days=days)

    joins = list(
        StageEvent.objects.filter(
            to_stage="joined", created_at__gte=since, created_at__lte=now
        ).select_related("application__job")
    )
    fill_days = [
        (ev.created_at - (ev.application.job.published_at or ev.application.job.created_at)).total_seconds()
        / 86400
        for ev in joins
    ]
    shortlist_hours = [
        (j.first_shortlist_at - j.published_at).total_seconds() / 3600
        for j in JobOpening.objects.filter(
            published_at__gte=since, published_at__lte=now, first_shortlist_at__isnull=False
        ).only("published_at", "first_shortlist_at")
    ]
    period_jobs = (
        JobOpening.objects.exclude(status="draft")
        .filter(
            Q(published_at__gte=since, published_at__lte=now)
            | Q(published_at__isnull=True, created_at__gte=since, created_at__lte=now)
        )
        .annotate(joined=Count("applications", filter=Q(applications__stage="joined")))
    )
    offered = filled = 0
    for j in period_jobs.values("openings_count", "joined"):
        offered += j["openings_count"]
        filled += min(j["joined"], j["openings_count"])

    revenue = sum(
        Charge.objects.filter(kind="placement", created_at__gte=since, created_at__lte=now)
        .exclude(status="waived")
        .values_list("amount", flat=True),
        Decimal("0"),
    )

    period_orgs = {ev.application.job.organization_id for ev in joins}
    repeat = set(
        StageEvent.objects.filter(
            to_stage="joined", created_at__lt=since, application__job__organization_id__in=period_orgs
        ).values_list("application__job__organization_id", flat=True)
    )

    new_workers = Worker.objects.filter(created_at__gte=since, created_at__lte=now)
    n_new = new_workers.count()
    activated = (
        new_workers.filter(
            Q(applications__stage__in=["shortlisted", "interview", "selected", "joined"])
            | Q(employments__isnull=False)
        )
        .distinct()
        .count()
    )
    verified_added = Worker.objects.filter(
        verification_status="verified", verified_at__gte=since, verified_at__lte=now
    ).count()

    employments_started = Employment.objects.filter(
        start_date__gte=timezone.localtime(since).date(), start_date__lte=timezone.localtime(now).date()
    ).count()
    try:
        from apps.trust.models import Dispute

        disputes = Dispute.objects.filter(raised_at__gte=since, raised_at__lte=now).count()
    except Exception:  # noqa: BLE001 - trust not migrated
        disputes = 0

    # ---- phase-1 exit criteria (all-time, except the fill-time median which uses the period)
    total_workers = Worker.objects.count()
    total_orgs = Organization.objects.filter(is_active=True).count()
    paying_orgs = Charge.objects.filter(status="paid").values("organization_id").distinct().count()
    total_placements = Application.objects.filter(stage="joined").count()
    median_fill = _median(fill_days)
    exit_rows = [
        {"key": "workers", "target": PHASE1_TARGETS["workers"], "actual": total_workers},
        {"key": "organizations", "target": PHASE1_TARGETS["organizations"], "actual": total_orgs},
        {
            "key": "paying_organizations",
            "target": PHASE1_TARGETS["paying_organizations"],
            "actual": paying_orgs,
        },
        {"key": "placements", "target": PHASE1_TARGETS["placements"], "actual": total_placements},
    ]
    for r in exit_rows:
        r["comparator"] = "gte"
        r["met"] = r["actual"] >= r["target"]
    exit_rows.append(
        {
            "key": "median_fill_days",
            "target": PHASE1_TARGETS["median_fill_days"],
            "actual": median_fill,
            "comparator": "lt",
            "met": median_fill is not None and median_fill < PHASE1_TARGETS["median_fill_days"],
        }
    )

    return {
        "days": days,
        "period_start": since.isoformat(),
        "period_end": now.isoformat(),
        "time_to_fill_days_median": median_fill,
        "time_to_shortlist_hours_median": _median(shortlist_hours),
        "fill_rate": _ratio(filled, offered),
        "placements": len(joins),
        "placement_revenue": money_str(revenue),
        "repeat_employer_rate": _ratio(len(repeat), len(period_orgs)),
        "worker_activation_rate": _ratio(activated, n_new),
        "verified_workers_added": verified_added,
        "dispute_rate": _ratio(disputes, employments_started),
        "avg_employer_rating_of_workers": _avg_rating("employer", since),
        "avg_worker_rating_of_employers": _avg_rating("worker", since),
        "phase1_exit": exit_rows,
        "phase1_exit_met": all(r["met"] for r in exit_rows),
        "generated_at": timezone.now().isoformat(),
    }


# =========================================================================== career
def _uplift_for(trade_code: str | None, key: str):
    for row in certification_uplift(None, trade_code):
        if row["kind_or_level"] == key and row["uplift_pct"] is not None:
            return row["uplift_pct"]
    if trade_code:  # fall back to all trades
        for row in certification_uplift(None, None):
            if row["kind_or_level"] == key and row["uplift_pct"] is not None:
                return row["uplift_pct"]
    return None


NEXT_LEVEL = {
    "none": "level1",
    "elementary": "level1",
    None: "level1",
    "level1": "level2",
    "level2": "level3",
}
LEVEL_NE = {"level1": "तह १", "level2": "तह २", "level3": "तह ३"}
LEVEL_EN = {"level1": "Level 1", "level2": "Level 2", "level3": "Level 3"}


def career(worker) -> dict:
    """Recommendations from certification uplift, shortages near the worker and profile gaps."""
    from apps.core.serializers import trade_ref

    skills = list(worker.skills.select_related("trade").all())
    trade_codes = {s.trade_id for s in skills}
    recs: list[dict] = []

    # ---- profile gaps
    if worker.verification_status != "verified":
        recs.append(
            {
                "kind": "profile",
                "key": "verify_identity",
                "title": "Get your identity verified",
                "title_ne": "आफ्नो परिचय प्रमाणित गराउनुहोस्",
                "reason": "Employers shortlist verified workers first.",
                "reason_ne": "रोजगारदाताले प्रमाणित कामदारलाई पहिले छान्छन्।",
                "expected_uplift_pct": None,
                "link": "ks://profile",
            }
        )
    has_verified_credential = False
    try:
        from apps.credentials.models import Credential

        has_verified_credential = Credential.objects.filter(worker=worker, status="verified").exists()
    except Exception:  # noqa: BLE001
        pass
    if not has_verified_credential:
        recs.append(
            {
                "kind": "credential",
                "key": "add_credential",
                "title": "Add a certificate and get it verified",
                "title_ne": "प्रमाणपत्र थपेर प्रमाणित गराउनुहोस्",
                "reason": "Verified certificates appear on your Skill Passport.",
                "reason_ne": "प्रमाणित प्रमाणपत्र तपाईंको सीप राहदानीमा देखिन्छ।",
                "expected_uplift_pct": _uplift_for(None, "credential_training_course")
                or _uplift_for(None, "nstb_any"),
                "link": "ks://credentials",
            }
        )
    has_history = True
    try:
        from apps.experience.models import WorkHistoryEntry

        has_history = WorkHistoryEntry.objects.filter(worker=worker).exists()
    except Exception:  # noqa: BLE001 - experience app not ready
        has_history = True
    if not has_history:
        recs.append(
            {
                "kind": "profile",
                "key": "add_work_history",
                "title": "Add your past work with a reference",
                "title_ne": "पहिलेको काम सन्दर्भ व्यक्तिसहित थप्नुहोस्",
                "reason": "Verified experience raises your trust level.",
                "reason_ne": "प्रमाणित अनुभवले तपाईंको विश्वास तह बढाउँछ।",
                "expected_uplift_pct": None,
                "link": "ks://work-history",
            }
        )

    # ---- certification (NSTB next level per trade)
    for s in skills:
        nxt = NEXT_LEVEL.get(s.nstb_level or None)
        if not nxt:
            continue
        recs.append(
            {
                "kind": "credential",
                "key": f"nstb_{nxt}_{s.trade_id}",
                "title": f"Take the NSTB {LEVEL_EN[nxt]} skill test — {s.trade.name_en}",
                "title_ne": f"राष्ट्रिय सीप परीक्षण {LEVEL_NE[nxt]} दिनुहोस् — {s.trade.name_ne}",
                "reason": "Certified workers earn more in this trade.",
                "reason_ne": "यस पेसामा प्रमाणित कामदारले बढी कमाउँछन्।",
                "expected_uplift_pct": _uplift_for(s.trade_id, f"nstb_{nxt}")
                or _uplift_for(s.trade_id, "nstb_any"),
                "link": "ks://courses",
            }
        )

    # ---- shortages near the worker
    district = worker.current_district_id or worker.permanent_district_id
    rows = []
    try:
        from apps.training.services import shortages

        rows = [r for r in shortages(district=district, days=90) if r.get("shortage", 0) > 0][:5]
    except Exception:  # noqa: BLE001
        rows = []
    courses_by_trade = {}
    try:
        from apps.training.models import Course

        for c in Course.objects.filter(
            status="open",
            starts_on__gte=timezone.localdate(),
            trade_id__in=[r["trade"]["code"] for r in rows],
        ).order_by("starts_on"):
            courses_by_trade.setdefault(c.trade_id, c)
    except Exception:  # noqa: BLE001
        pass
    for r in rows:
        code = r["trade"]["code"]
        course = courses_by_trade.get(code)
        in_trade = code in trade_codes
        base = {
            "reason": f"{r['shortage']} more {r['trade']['name_en']} workers are needed near you.",
            "reason_ne": f"तपाईंको नजिक {r['trade']['name_ne']} कामदार अझै {r['shortage']} जना चाहिन्छ।",
            "expected_uplift_pct": None,
        }
        if course is not None:
            recs.append(
                {
                    "kind": "course",
                    "key": f"course_{course.id}",
                    "title": course.title,
                    "title_ne": course.title_ne or course.title,
                    **base,
                    "course_id": str(course.id),
                    "link": f"ks://courses/{course.id}",
                }
            )
        elif not in_trade:
            recs.append(
                {
                    "kind": "skill",
                    "key": f"skill_{code}",
                    "title": f"Learn {r['trade']['name_en']} — in demand near you",
                    "title_ne": f"{r['trade']['name_ne']} सिक्नुहोस् — तपाईंको नजिक माग छ",
                    **base,
                    "link": "ks://courses",
                }
            )

    return {
        "trades": [
            {**trade_ref(s.trade), "years_experience": s.years_experience, "nstb_level": s.nstb_level}
            for s in skills
        ],
        "district": district,
        "recommendations": recs,
        "generated_at": timezone.now().isoformat(),
    }
