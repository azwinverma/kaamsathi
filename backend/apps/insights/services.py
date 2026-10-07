"""Aggregates only (docs/CONTRACT-ECOSYSTEM.md §10).

Never expose a single worker: every cell that describes workers is suppressed when it covers
fewer than ``K_ANONYMITY`` distinct workers (value → null, ``suppressed: true``).
"""

from __future__ import annotations

import datetime as dt
import statistics
from collections import defaultdict
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from apps.core.bs import BSMonth, js_weekday
from apps.core.money import money_str, q2

K_ANONYMITY = 5
DAILY_TO_MONTHLY_DAYS = 26  # working days used to express a daily wage as a monthly figure


def suppress_count(n: int):
    """Counts of workers: 0 is safe, 1..K-1 is suppressed (null)."""
    return n if n == 0 or n >= K_ANONYMITY else None


def _round(v, nd=1):
    return round(v, nd) if v is not None else None


def _pct(num, den, nd=1):
    return round(num / den * 100, nd) if den else None


def months_window(months: int, today: dt.date | None = None) -> list[BSMonth]:
    months = max(1, min(int(months or 6), 24))
    cur = BSMonth.of(today or timezone.localdate())
    out = [cur]
    for _ in range(months - 1):
        out.append(out[-1].previous())
    return list(reversed(out))


def _month_ref(m: BSMonth) -> dict:
    return {
        "bs_year": m.year,
        "bs_month": m.month,
        "month": f"{m.year}-{m.month:02d}",
        "month_name_en": m.name_en,
        "month_name_ne": m.name_ne,
    }


# =========================================================================== employer analytics
def org_analytics(org, months: int = 6) -> dict:
    from apps.billing.models import Charge
    from apps.hiring.models import JobOpening, StageEvent
    from apps.payroll.models import Payslip
    from apps.workforce.models import Attendance, Employment

    today = timezone.localdate()
    window = months_window(months, today)
    start, end = window[0].start, min(window[-1].end, today)
    start_dt = timezone.make_aware(dt.datetime.combine(start, dt.time.min))

    emps = list(
        Employment.objects.filter(organization=org).values(
            "id", "worker_id", "start_date", "end_date", "status", "site_id"
        )
    )

    # ---- headcount / attrition / tenure
    trend = []
    for m in window:
        ref = min(m.end, today)
        active = sum(
            1 for e in emps if e["start_date"] <= ref and (e["end_date"] is None or e["end_date"] >= ref)
        )
        joined = sum(1 for e in emps if m.start <= e["start_date"] <= m.end)
        left = sum(1 for e in emps if e["end_date"] and m.start <= e["end_date"] <= m.end)
        trend.append({**_month_ref(m), "active": active, "joined": joined, "left": left})
    avg_active = statistics.fmean([t["active"] for t in trend]) if trend else 0
    left_total = sum(t["left"] for t in trend)
    active_now = [e for e in emps if e["status"] == "active"]
    tenure = (
        round(statistics.fmean([(today - e["start_date"]).days / 30.44 for e in active_now]), 1)
        if active_now
        else None
    )

    # ---- hiring speed
    fill_days = []
    for ev in StageEvent.objects.filter(
        to_stage="joined", application__job__organization=org, created_at__gte=start_dt
    ).select_related("application__job"):
        job = ev.application.job
        opened = job.published_at or job.created_at
        fill_days.append((ev.created_at - opened).total_seconds() / 86400)
    shortlist_hours = [
        (j.first_shortlist_at - j.published_at).total_seconds() / 3600
        for j in JobOpening.objects.filter(
            organization=org, published_at__gte=start_dt, first_shortlist_at__isnull=False
        ).only("published_at", "first_shortlist_at")
    ]

    # ---- attendance & overtime (per month, suppressed below K workers)
    att_rows = list(
        Attendance.objects.filter(employment__organization=org, date__range=(start, end)).values(
            "date",
            "status",
            "overtime_minutes",
            "employment__worker_id",
            "employment__site_id",
            "employment__site__name",
        )
    )
    by_month = defaultdict(lambda: {"p": 0, "h": 0, "a": 0, "ot": 0, "workers": set()})
    for r in att_rows:
        m = BSMonth.of(r["date"])
        b = by_month[(m.year, m.month)]
        b["workers"].add(r["employment__worker_id"])
        b["ot"] += r["overtime_minutes"] or 0
        if r["status"] == "present":
            b["p"] += 1
        elif r["status"] == "half_day":
            b["h"] += 1
        elif r["status"] == "absent":
            b["a"] += 1
    attendance_trend, overtime_trend = [], []
    for m in window:
        b = by_month.get((m.year, m.month))
        n = len(b["workers"]) if b else 0
        ok = n >= K_ANONYMITY
        rate = _pct(b["p"] + 0.5 * b["h"], b["p"] + b["h"] + b["a"]) if b else None
        attendance_trend.append(
            {
                **_month_ref(m),
                "rate": rate if ok else None,
                "workers": suppress_count(n),
                "suppressed": not ok and n > 0,
            }
        )
        overtime_trend.append(
            {
                **_month_ref(m),
                "hours": round(b["ot"] / 60, 1) if ok else None,
                "workers": suppress_count(n),
                "suppressed": not ok and n > 0,
            }
        )

    # ---- wage bill (from payroll runs in the window)
    wage = []
    for m in window:
        slips = list(
            Payslip.objects.filter(run__organization=org, run__bs_year=m.year, run__bs_month=m.month).values(
                "gross_pay", "net_pay", "ssf_employer", "worker_id", "run__status"
            )
        )
        n = len({s["worker_id"] for s in slips})
        ok = n >= K_ANONYMITY
        gross = sum((s["gross_pay"] for s in slips), Decimal("0"))
        net = sum((s["net_pay"] for s in slips), Decimal("0"))
        employer = gross + sum((s["ssf_employer"] for s in slips), Decimal("0"))
        wage.append(
            {
                **_month_ref(m),
                "gross": money_str(gross) if ok else None,
                "net": money_str(net) if ok else None,
                "employer_cost": money_str(employer) if ok else None,
                "run_status": slips[0]["run__status"] if slips else None,
                "workers": suppress_count(n),
                "suppressed": not ok and n > 0,
            }
        )

    # ---- cost per hire (placement fees / hires via KaamSathi in the window)
    hires = StageEvent.objects.filter(
        to_stage="joined", application__job__organization=org, created_at__gte=start_dt
    ).count()
    fees = sum(
        Charge.objects.filter(organization=org, kind="placement", created_at__gte=start_dt)
        .exclude(status="waived")
        .values_list("amount", flat=True),
        Decimal("0"),
    )

    # ---- absenteeism by site & weekday
    sites = defaultdict(lambda: {"a": 0, "rec": 0, "workers": set(), "name": None})
    weekdays = defaultdict(lambda: {"a": 0, "rec": 0})
    for r in att_rows:
        if r["status"] not in ("present", "half_day", "absent"):
            continue
        s = sites[r["employment__site_id"]]
        s["name"] = r["employment__site__name"]
        s["workers"].add(r["employment__worker_id"])
        s["rec"] += 1
        w = weekdays[js_weekday(r["date"])]
        w["rec"] += 1
        if r["status"] == "absent":
            s["a"] += 1
            w["a"] += 1
    absenteeism = []
    for site_id, s in sites.items():
        n = len(s["workers"])
        ok = n >= K_ANONYMITY
        absenteeism.append(
            {
                "site": {"id": str(site_id), "name": s["name"]} if site_id else None,
                "absence_rate": _pct(s["a"], s["rec"]) if ok else None,
                "absent_days": s["a"] if ok else None,
                "workers": suppress_count(n),
                "suppressed": not ok,
            }
        )
    absenteeism.sort(key=lambda x: (x["absence_rate"] is None, -(x["absence_rate"] or 0)))
    org_workers = len({r["employment__worker_id"] for r in att_rows})
    top_weekdays = []
    if org_workers >= K_ANONYMITY:
        top_weekdays = sorted(
            (
                {"weekday": wd, "absences": v["a"], "absence_rate": _pct(v["a"], v["rec"])}
                for wd, v in weekdays.items()
            ),
            key=lambda x: (-x["absences"], x["weekday"]),
        )

    return {
        "months": len(window),
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "k_anonymity": K_ANONYMITY,
        "headcount_trend": trend,
        "active_now": len(active_now),
        "attrition_rate": _pct(left_total, avg_active),
        "avg_tenure_months": tenure,
        "time_to_fill_days_avg": _round(statistics.fmean(fill_days)) if fill_days else None,
        "time_to_shortlist_hours_avg": _round(statistics.fmean(shortlist_hours)) if shortlist_hours else None,
        "attendance_rate_trend": attendance_trend,
        "overtime_hours_trend": overtime_trend,
        "wage_bill_trend": wage,
        "hires": hires,
        "cost_per_hire": money_str(q2(fees / hires)) if hires else None,
        "absenteeism_by_site": absenteeism,
        "top_absence_weekdays": top_weekdays,
    }


# =========================================================================== labour market (ops)
def _quartiles(values: list[float]):
    values = sorted(values)
    if len(values) < 2:
        return values[0], values[0], values[0]
    q1, q2_, q3 = statistics.quantiles(values, n=4, method="inclusive")
    return q1, q2_, q3


def _ref_maps():
    from apps.geo.models import District
    from apps.workers.models import Trade

    trades = {
        t.code: {"code": t.code, "name_en": t.name_en, "name_ne": t.name_ne} for t in Trade.objects.all()
    }
    districts = {
        d.code: {"code": d.code, "name_en": d.name_en, "name_ne": d.name_ne} for d in District.objects.all()
    }
    return trades, districts


def wage_bands(district=None, trade=None, trades=None, districts=None) -> list[dict]:
    from apps.workforce.models import Employment

    since = timezone.localdate() - dt.timedelta(days=365)
    qs = Employment.objects.filter(trade__isnull=False).filter(Q(status="active") | Q(end_date__gte=since))
    if trade:
        qs = qs.filter(trade_id=trade)
    rows = qs.values(
        "worker_id",
        "trade_id",
        "site__district_id",
        "organization__district_id",
        "wage_type",
        "basic_salary",
        "dearness_allowance",
        "other_allowance",
        "daily_wage",
        "start_date",
    ).order_by("start_date")
    cells: dict[tuple, dict] = defaultdict(dict)
    for r in rows:
        dist = r["site__district_id"] or r["organization__district_id"]
        if district and dist != district:
            continue
        if r["wage_type"] == "daily":
            monthly = (r["daily_wage"] or 0) * DAILY_TO_MONTHLY_DAYS
        else:
            monthly = (r["basic_salary"] or 0) + (r["dearness_allowance"] or 0) + (r["other_allowance"] or 0)
        if monthly:
            cells[(r["trade_id"], dist)][r["worker_id"]] = float(monthly)  # latest employment per worker
    out = []
    for (t, d), per_worker in cells.items():
        vals = list(per_worker.values())
        ok = len(vals) >= K_ANONYMITY
        p25, med, p75 = _quartiles(vals) if ok else (None, None, None)
        out.append(
            {
                "trade": (trades or {}).get(t, {"code": t}),
                "district": (districts or {}).get(d, {"code": d}),
                "median_monthly": money_str(med) if ok else None,
                "p25": money_str(p25) if ok else None,
                "p75": money_str(p75) if ok else None,
                "sample": len(vals) if ok else None,
                "suppressed": not ok,
            }
        )
    out.sort(key=lambda x: (x["suppressed"], x["trade"].get("code", ""), x["district"].get("code") or ""))
    return out


def demand(district=None, trade=None, trades=None) -> list[dict]:
    from apps.hiring.models import JobOpening, StageEvent

    since = timezone.now() - dt.timedelta(days=90)
    jobs = JobOpening.objects.all()
    if trade:
        jobs = jobs.filter(trade_id=trade)
    if district:
        jobs = jobs.filter(
            Q(site__district_id=district) | Q(site__isnull=True, organization__district_id=district)
        )
    out: dict[str, dict] = defaultdict(
        lambda: {"open_positions": 0, "filled_90d": 0, "fill_days": [], "open_jobs": 0}
    )
    for j in jobs.filter(status="open").prefetch_related("applications"):
        joined = sum(1 for a in j.applications.all() if a.stage == "joined")
        out[j.trade_id]["open_positions"] += max(j.openings_count - joined, 0)
        out[j.trade_id]["open_jobs"] += 1
    for ev in StageEvent.objects.filter(
        to_stage="joined", created_at__gte=since, application__job__in=jobs
    ).select_related("application__job"):
        job = ev.application.job
        cell = out[job.trade_id]
        cell["filled_90d"] += 1
        cell["fill_days"].append(
            (ev.created_at - (job.published_at or job.created_at)).total_seconds() / 86400
        )
    rows = [
        {
            "trade": (trades or {}).get(t, {"code": t}),
            "open_jobs": v["open_jobs"],
            "open_positions": v["open_positions"],
            "filled_90d": v["filled_90d"],
            "avg_days_to_fill": _round(statistics.fmean(v["fill_days"])) if v["fill_days"] else None,
        }
        for t, v in out.items()
    ]
    rows.sort(key=lambda x: -x["open_positions"])
    return rows


def supply(district=None, trade=None, trades=None) -> list[dict]:
    from apps.workers.models import WorkerSkill

    qs = WorkerSkill.objects.all()
    if trade:
        qs = qs.filter(trade_id=trade)
    if district:
        qs = qs.filter(worker__current_district_id=district)
    cells: dict[str, dict] = defaultdict(lambda: {"registered": set(), "verified": set(), "available": set()})
    for r in qs.values("trade_id", "worker_id", "worker__verification_status", "worker__is_available"):
        c = cells[r["trade_id"]]
        c["registered"].add(r["worker_id"])
        if r["worker__verification_status"] == "verified":
            c["verified"].add(r["worker_id"])
            if r["worker__is_available"]:
                c["available"].add(r["worker_id"])
    rows = []
    for t, c in cells.items():
        n = len(c["registered"])
        rows.append(
            {
                "trade": (trades or {}).get(t, {"code": t}),
                "registered": suppress_count(n),
                "verified": suppress_count(len(c["verified"])),
                "available": suppress_count(len(c["available"])),
                "suppressed": n < K_ANONYMITY,
            }
        )
    rows.sort(key=lambda x: (x["suppressed"], -(x["registered"] or 0)))
    return rows


def shortages(district=None, trade=None) -> list[dict]:
    """Delegates to the training shortage engine; [] until that app provides it."""
    try:
        from apps.training.services import shortages as training_shortages
    except ImportError:
        return []
    try:
        rows = list(training_shortages(district=district, days=90))
    except Exception:  # noqa: BLE001 - insights must not break if training errors
        return []
    if trade:
        rows = [r for r in rows if _trade_code(r.get("trade")) == trade]
    return rows


def _trade_code(t):
    return t.get("code") if isinstance(t, dict) else t


def _worker_net(district=None, trade=None) -> dict:
    """Per-worker average monthly net pay from paid payslips in the last 12 months."""
    from apps.payroll.models import Payslip

    since = timezone.localdate() - dt.timedelta(days=365)
    qs = Payslip.objects.filter(payment_status="paid", run__period_end__gte=since)
    if trade:
        qs = qs.filter(worker__skills__trade_id=trade)
    if district:
        qs = qs.filter(worker__current_district_id=district)
    months: dict = defaultdict(lambda: defaultdict(Decimal))
    for r in qs.values("id", "worker_id", "run__bs_year", "run__bs_month", "net_pay").distinct():
        months[r["worker_id"]][(r["run__bs_year"], r["run__bs_month"])] += r["net_pay"]
    return {w: float(sum(m.values()) / len(m)) for w, m in months.items() if m}


def certification_uplift(district=None, trade=None) -> list[dict]:
    from apps.workers.models import WorkerSkill

    nets = _worker_net(district, trade)
    if not nets:
        return []
    skills = WorkerSkill.objects.filter(worker_id__in=nets.keys())
    if trade:
        skills = skills.filter(trade_id=trade)
    levels: dict = defaultdict(set)
    for w, lvl in skills.values_list("worker_id", "nstb_level"):
        levels[w].add(lvl)
    certified = {"level1", "level2", "level3"}
    groups = {
        "nstb_any": {w for w, ls in levels.items() if ls & certified},
        "nstb_level1": {w for w, ls in levels.items() if "level1" in ls},
        "nstb_level2": {w for w, ls in levels.items() if "level2" in ls},
        "nstb_level3": {w for w, ls in levels.items() if "level3" in ls},
    }
    try:  # verified credentials by kind (credentials app, phase 2)
        from apps.credentials.models import Credential

        for w, kind in Credential.objects.filter(worker_id__in=nets.keys(), status="verified").values_list(
            "worker_id", "kind"
        ):
            groups.setdefault(f"credential_{kind}", set()).add(w)
    except Exception:  # noqa: BLE001 - app/table not ready yet
        pass
    baseline = {w for w in nets if not (levels.get(w, set()) & certified)}
    rows = []
    for key, members in groups.items():
        with_vals = [nets[w] for w in members]
        without_vals = [nets[w] for w in baseline - members]
        ok = len(with_vals) >= K_ANONYMITY and len(without_vals) >= K_ANONYMITY
        mw = statistics.median(with_vals) if ok else None
        mo = statistics.median(without_vals) if ok else None
        rows.append(
            {
                "kind_or_level": key,
                "median_net_with": money_str(mw) if ok else None,
                "median_net_without": money_str(mo) if ok else None,
                "uplift_pct": _round((mw - mo) / mo * 100) if ok and mo else None,
                "sample": len(with_vals) + len(without_vals) if ok else None,
                "suppressed": not ok,
            }
        )
    return rows


def origin_districts(district=None, trade=None, districts=None) -> list[dict]:
    from apps.workers.models import Worker

    qs = Worker.objects.filter(permanent_district__isnull=False)
    if trade:
        qs = qs.filter(skills__trade_id=trade)
    if district:
        qs = qs.filter(current_district_id=district)
    counts: dict = defaultdict(set)
    for w, d in qs.values_list("id", "permanent_district_id").distinct():
        counts[d].add(w)
    rows, other = [], 0
    for d, ws in counts.items():
        if len(ws) >= K_ANONYMITY:
            rows.append(
                {"district": (districts or {}).get(d, {"code": d}), "workers": len(ws), "suppressed": False}
            )
        else:
            other += len(ws)
    rows.sort(key=lambda x: -x["workers"])
    if other >= K_ANONYMITY:
        rows.append({"district": None, "workers": other, "suppressed": True})  # small districts pooled
    return rows


def labour_market(district=None, trade=None) -> dict:
    trades, districts = _ref_maps()
    return {
        "filters": {"district": district or None, "trade": trade or None},
        "k_anonymity": K_ANONYMITY,
        "wages": wage_bands(district, trade, trades, districts),
        "demand": demand(district, trade, trades),
        "supply": supply(district, trade, trades),
        "shortages": shortages(district, trade),
        "certification_uplift": certification_uplift(district, trade),
        "origin_districts": origin_districts(district, trade, districts),
        "generated_at": timezone.now().isoformat(),
    }


# =========================================================================== CSV export
def _flat(value, prefix=""):
    out = {}
    if isinstance(value, dict):
        if set(value.keys()) >= {"code"} and "name_en" in value:  # trade/district ref
            out[prefix] = value["code"]
            out[f"{prefix}_name"] = value["name_en"]
            return out
        for k, v in value.items():
            out.update(_flat(v, f"{prefix}_{k}" if prefix else k))
        return out
    if isinstance(value, list):
        out[prefix] = "; ".join(str(v) for v in value)
        return out
    out[prefix] = "" if value is None else value
    return out


REPORTS = ("wages", "demand", "supply", "shortages", "certification_uplift", "origin_districts")


def export_rows(report: str, district=None, trade=None) -> list[dict]:
    data = labour_market(district, trade)
    rows = data.get(report) or []
    return [_flat(r) for r in rows]
