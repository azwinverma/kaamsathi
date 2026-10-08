"""Payroll persistence: builds engine inputs from the DB and stores Payslips."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.core.bs import BSMonth, fiscal_year
from apps.core.exceptions import Duplicate, InvalidState
from apps.core.money import D, q2
from apps.hiring.models import MinimumWage
from apps.workforce.models import Advance, Attendance, Employment, Holiday, LeaveRequest

from . import engine
from .models import PayrollRun, Payslip, TaxSlab


def tax_bands_for(period_start: dt.date):
    fy = fiscal_year(period_start)
    qs = TaxSlab.objects.filter(fiscal_year=fy, applies_to="single")
    if not qs.exists():
        latest = TaxSlab.objects.order_by("-fiscal_year").values_list("fiscal_year", flat=True).first()
        qs = TaxSlab.objects.filter(fiscal_year=latest, applies_to="single")
    return tuple(engine.TaxBand(s.lower, s.upper, s.rate) for s in qs.order_by("lower"))


def basic_ratio(on: dt.date) -> Decimal:
    mw = MinimumWage.current(on)
    if mw and mw.monthly_total:
        return D(mw.monthly_basic) / D(mw.monthly_total)
    return engine.DEFAULT_BASIC_RATIO


def holidays_between(org, start, end) -> set:
    return set(
        Holiday.objects.filter(
            Q(organization__isnull=True) | Q(organization=org), date__range=(start, end)
        ).values_list("date", flat=True)
    )


def employments_for_period(org, start, end):
    return (
        Employment.objects.filter(organization=org, start_date__lte=end)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=start))
        .select_related("worker")
    )


def is_month_locked(org, day: dt.date) -> bool:
    return PayrollRun.objects.filter(
        organization=org, status__in=["approved", "paid"], period_start__lte=day, period_end__gte=day
    ).exists()


def build_input(employment, run_meta: dict, other_deductions=Decimal("0")) -> engine.PayInput:
    start, end = run_meta["period_start"], run_meta["period_end"]
    records = Attendance.objects.filter(employment=employment, date__range=(start, end))
    unpaid_dates = set()
    for lv in LeaveRequest.objects.filter(
        employment=employment, status="approved", leave_type="unpaid", from_date__lte=end, to_date__gte=start
    ):
        d = lv.from_date
        while d <= lv.to_date:
            unpaid_dates.add(d)
            d += dt.timedelta(days=1)
    attendance = {
        r.date: engine.DayRecord(r.status, r.overtime_minutes, r.status == "leave" and r.date in unpaid_dates)
        for r in records
    }
    advances = tuple(
        engine.AdvanceBalance(a.recover_per_month, a.amount - a.recovered_amount)
        for a in Advance.objects.filter(employment=employment, given_on__lte=end).order_by("given_on")
        if a.amount > a.recovered_amount
    )
    return engine.PayInput(
        wage_type=employment.wage_type,
        start_date=employment.start_date,
        end_date=employment.end_date,
        period_start=start,
        period_end=end,
        days_in_month=run_meta["days_in_month"],
        basic_salary=D(employment.basic_salary),
        dearness_allowance=D(employment.dearness_allowance),
        other_allowance=D(employment.other_allowance),
        daily_wage=D(employment.daily_wage),
        ssf_enrolled=employment.ssf_enrolled,
        attendance=attendance,
        holidays=frozenset(run_meta["holidays"]),
        weekly_off_day=run_meta["weekly_off_day"],
        basic_ratio=run_meta["basic_ratio"],
        tax_bands=run_meta["tax_bands"],
        advances=advances,
        other_deductions=D(other_deductions),
        include_festival_allowance=run_meta["include_festival_allowance"],
        overtime_minutes_override=_approved_ot(employment, start, end),
    )


def _approved_ot(employment, start, end):
    """Approved timesheet OT when the org's policy requires approval; None otherwise (no-op if absent)."""
    try:
        from apps.timesheets.services import approved_ot_minutes
    except ImportError:  # pragma: no cover
        return None
    return approved_ot_minutes(employment, start, end)


def _run_meta(run: PayrollRun) -> dict:
    return {
        "period_start": run.period_start,
        "period_end": run.period_end,
        "days_in_month": run.days_in_month,
        "holidays": holidays_between(run.organization, run.period_start, run.period_end),
        "weekly_off_day": run.organization.weekly_off_day,
        "basic_ratio": basic_ratio(run.period_end),
        "tax_bands": tax_bands_for(run.period_start),
        "include_festival_allowance": run.include_festival_allowance,
    }


RESULT_FIELDS = [
    "wage_type",
    "days_in_month",
    "present_days",
    "paid_leave_days",
    "holiday_days",
    "weekly_off_days",
    "absent_days",
    "payable_days",
    "overtime_hours",
    "basic_earned",
    "da_earned",
    "allowance_earned",
    "overtime_pay",
    "festival_allowance",
    "gross_pay",
    "ssf_employee",
    "ssf_employer",
    "tds",
    "advance_recovery",
    "other_deductions",
    "net_pay",
]


@transaction.atomic
def compute_run(run: PayrollRun) -> PayrollRun:
    if run.status != "draft":
        raise InvalidState()
    meta = _run_meta(run)
    existing = {p.employment_id: p for p in run.payslips.all()}
    seen = set()
    for emp in employments_for_period(run.organization, run.period_start, run.period_end):
        prev = existing.get(emp.id)
        other = prev.other_deductions if prev else Decimal("0")
        result = engine.calculate(build_input(emp, meta, other))
        values = {k: getattr(result, k) for k in RESULT_FIELDS}
        if prev:
            for k, v in values.items():
                setattr(prev, k, v)
            prev.save()
        else:
            Payslip.objects.create(
                run=run, employment=emp, worker=emp.worker, payment_method=emp.worker.payment_method, **values
            )
        seen.add(emp.id)
    run.payslips.exclude(employment_id__in=seen).delete()
    return run


def create_run(org, bs_year: int, bs_month: int, include_festival_allowance=False) -> PayrollRun:
    if PayrollRun.objects.filter(organization=org, bs_year=bs_year, bs_month=bs_month).exists():
        raise Duplicate(message="A payroll run already exists for this month.")
    month = BSMonth(bs_year, bs_month)
    with transaction.atomic():
        run = PayrollRun.objects.create(
            organization=org,
            bs_year=bs_year,
            bs_month=bs_month,
            period_start=month.start,
            period_end=month.end,
            days_in_month=month.days,
            include_festival_allowance=include_festival_allowance,
        )
        compute_run(run)
    return run


def recompute_payslip(slip: Payslip) -> Payslip:
    """Recompute net after a manual edit of other_deductions (draft only)."""
    if slip.run.status != "draft":
        raise InvalidState()
    meta = _run_meta(slip.run)
    result = engine.calculate(build_input(slip.employment, meta, slip.other_deductions))
    for k in RESULT_FIELDS:
        setattr(slip, k, getattr(result, k))
    slip.save()
    return slip


def approve_run(run: PayrollRun, user) -> PayrollRun:
    if run.status != "draft":
        raise InvalidState()
    run.status = "approved"
    run.approved_by = user
    run.approved_at = timezone.now()
    run.save(update_fields=["status", "approved_by", "approved_at"])
    return run


@transaction.atomic
def mark_paid(run: PayrollRun, paid_on: dt.date, method: str | None = None) -> PayrollRun:
    if run.status != "approved":
        raise InvalidState()
    paid_at = timezone.make_aware(dt.datetime.combine(paid_on, dt.time(12, 0)))
    for slip in run.payslips.select_related("employment").select_for_update():
        remaining = slip.advance_recovery
        for adv in (
            Advance.objects.select_for_update()
            .filter(employment=slip.employment, given_on__lte=run.period_end)
            .order_by("given_on")
        ):
            if remaining <= 0:
                break
            balance = adv.amount - adv.recovered_amount
            if balance <= 0:
                continue
            take = min(balance, remaining)
            adv.recovered_amount = q2(adv.recovered_amount + take)
            adv.save(update_fields=["recovered_amount"])
            remaining -= take
        slip.payment_status = "paid"
        slip.paid_at = paid_at
        if method:
            slip.payment_method = method
        slip.save(update_fields=["payment_status", "paid_at", "payment_method"])
    run.status = "paid"
    run.paid_at = paid_at
    run.save(update_fields=["status", "paid_at"])
    return run


def run_totals(run: PayrollRun) -> dict:
    from django.db.models import Count, Sum

    agg = run.payslips.aggregate(
        workers=Count("id"),
        gross=Sum("gross_pay"),
        ssf_employee=Sum("ssf_employee"),
        ssf_employer=Sum("ssf_employer"),
        tds=Sum("tds"),
        advance_recovery=Sum("advance_recovery"),
        other_deductions=Sum("other_deductions"),
        net=Sum("net_pay"),
    )
    out = {"workers": agg.pop("workers") or 0}
    for k, v in agg.items():
        out[k] = f"{q2(v or 0):.2f}"
    employer_cost = f"{q2(D(out['gross']) + D(out['ssf_employer'])):.2f}"
    return {"totals": out, "employer_cost": employer_cost}
