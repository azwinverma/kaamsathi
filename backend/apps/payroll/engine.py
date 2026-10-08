"""Pure payroll calculation (no database access).

Implements CONTRACT.md §2 "Payroll calculation" exactly. All money is Decimal,
rounded to 2 dp with ROUND_HALF_UP; TDS is rounded to the rupee.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from decimal import Decimal

from apps.core.bs import js_weekday
from apps.core.money import D, q0, q2

ZERO = Decimal("0")
ONE = Decimal("1")
HALF = Decimal("0.5")
OT_MULTIPLIER = Decimal("1.5")
SSF_EMPLOYEE_RATE = Decimal("0.11")
SSF_EMPLOYER_RATE = Decimal("0.20")
HOURS_PER_DAY = Decimal("8")
DEFAULT_BASIC_RATIO = Decimal("12170") / Decimal("19550")


@dataclass(frozen=True)
class DayRecord:
    status: str  # present|absent|half_day|leave|holiday|weekly_off
    overtime_minutes: int = 0
    unpaid_leave: bool = False


@dataclass(frozen=True)
class TaxBand:
    lower: Decimal
    upper: Decimal | None
    rate: Decimal  # percent


@dataclass(frozen=True)
class AdvanceBalance:
    recover_per_month: Decimal
    balance: Decimal  # amount - recovered


@dataclass
class PayInput:
    wage_type: str  # monthly|daily
    start_date: dt.date
    end_date: dt.date | None
    period_start: dt.date
    period_end: dt.date
    days_in_month: int
    basic_salary: Decimal = ZERO
    dearness_allowance: Decimal = ZERO
    other_allowance: Decimal = ZERO
    daily_wage: Decimal = ZERO
    ssf_enrolled: bool = False
    attendance: dict = field(default_factory=dict)  # date -> DayRecord
    holidays: frozenset = frozenset()
    weekly_off_day: int = 6  # 0=Sunday … 6=Saturday
    basic_ratio: Decimal = DEFAULT_BASIC_RATIO  # MinimumWage basic / total
    tax_bands: tuple = ()
    advances: tuple = ()
    other_deductions: Decimal = ZERO
    include_festival_allowance: bool = False
    # Timesheet hook (CONTRACT-EXTENSIONS §4): when set, pay this many OT minutes (approved on
    # timesheets) instead of summing attendance ``overtime_minutes``. None = default behaviour.
    overtime_minutes_override: int | None = None


@dataclass
class PayResult:
    wage_type: str
    days_in_month: int
    present_days: Decimal = ZERO
    paid_leave_days: Decimal = ZERO
    holiday_days: Decimal = ZERO
    weekly_off_days: Decimal = ZERO
    absent_days: Decimal = ZERO
    payable_days: Decimal = ZERO
    overtime_hours: Decimal = ZERO
    basic_earned: Decimal = ZERO
    da_earned: Decimal = ZERO
    allowance_earned: Decimal = ZERO
    overtime_pay: Decimal = ZERO
    festival_allowance: Decimal = ZERO
    gross_pay: Decimal = ZERO
    ssf_employee: Decimal = ZERO
    ssf_employer: Decimal = ZERO
    tds: Decimal = ZERO
    advance_recovery: Decimal = ZERO
    other_deductions: Decimal = ZERO
    net_pay: Decimal = ZERO

    def as_dict(self) -> dict:
        return dict(self.__dict__)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def employment_window(inp: PayInput) -> tuple[dt.date, dt.date] | None:
    start = max(inp.start_date, inp.period_start)
    end = min(inp.end_date or inp.period_end, inp.period_end)
    if end < start:
        return None
    return start, end


def count_days(inp: PayInput) -> dict:
    """Step 1: classify each day of the employment window inside the period."""
    counts = {"present": ZERO, "paid_leave": ZERO, "holiday": ZERO, "weekly_off": ZERO, "absent": ZERO}
    ot_minutes = 0
    window = employment_window(inp)
    if window is None:
        return {**counts, "ot_minutes": 0}
    day = window[0]
    while day <= window[1]:
        rec: DayRecord | None = inp.attendance.get(day)
        if rec is not None:
            ot_minutes += int(rec.overtime_minutes or 0)
            if rec.status == "present":
                counts["present"] += ONE
            elif rec.status == "half_day":
                counts["present"] += HALF
                counts["absent"] += HALF
            elif rec.status == "leave":
                if rec.unpaid_leave:
                    counts["absent"] += ONE
                else:
                    counts["paid_leave"] += ONE
            elif rec.status == "holiday":
                counts["holiday"] += ONE
            elif rec.status == "weekly_off":
                counts["weekly_off"] += ONE
            else:
                counts["absent"] += ONE
        elif day in inp.holidays:
            counts["holiday"] += ONE
        elif js_weekday(day) == inp.weekly_off_day:
            counts["weekly_off"] += ONE
        else:
            counts["absent"] += ONE
        day += dt.timedelta(days=1)
    return {**counts, "ot_minutes": ot_minutes}


def months_employed(start: dt.date, until: dt.date) -> int:
    """Completed calendar months between start and until (inclusive end)."""
    if until < start:
        return 0
    months = (until.year - start.year) * 12 + (until.month - start.month)
    if until.day + 1 < start.day:
        months -= 1
    return max(months, 0)


def annual_tax(taxable: Decimal, bands, ssf_enrolled: bool) -> Decimal:
    tax = ZERO
    ordered = sorted(bands, key=lambda b: b.lower)
    for idx, band in enumerate(ordered):
        if taxable <= band.lower:
            break
        top = taxable if band.upper is None else min(taxable, band.upper)
        portion = top - band.lower
        if portion <= 0:
            continue
        if idx == 0 and ssf_enrolled:
            continue  # 1% social security tax waived for SSF contributors
        tax += portion * band.rate / Decimal("100")
    return tax


def monthly_tds(gross: Decimal, ssf_employee: Decimal, bands, ssf_enrolled: bool) -> Decimal:
    taxable_annual = (gross - ssf_employee) * 12
    if taxable_annual <= 0 or not bands:
        return q2(ZERO)
    return q2(q0(annual_tax(taxable_annual, bands, ssf_enrolled) / 12))


def advance_due(advances) -> Decimal:
    total = ZERO
    for adv in advances:
        balance = max(D(adv.balance), ZERO)
        if balance > 0:
            total += min(D(adv.recover_per_month), balance)
    return q2(total)


# ---------------------------------------------------------------------------
# main entry point
# ---------------------------------------------------------------------------


def calculate(inp: PayInput) -> PayResult:
    dim = Decimal(inp.days_in_month)
    res = PayResult(wage_type=inp.wage_type, days_in_month=inp.days_in_month)
    c = count_days(inp)
    res.present_days = c["present"]
    res.paid_leave_days = c["paid_leave"]
    res.holiday_days = c["holiday"]
    res.weekly_off_days = c["weekly_off"]
    res.absent_days = c["absent"]
    ot_minutes = c["ot_minutes"] if inp.overtime_minutes_override is None else inp.overtime_minutes_override
    ot_hours = Decimal(ot_minutes) / Decimal(60)
    res.overtime_hours = q2(ot_hours)

    basic = D(inp.basic_salary)
    da = D(inp.dearness_allowance)
    other = D(inp.other_allowance)
    daily = D(inp.daily_wage)
    ratio = D(inp.basic_ratio)

    if inp.wage_type == "daily":
        # Step 2 (daily): payable = present days only.
        res.payable_days = res.present_days
        wage = q2(daily * res.payable_days)
        res.basic_earned = q2(wage * ratio)
        res.da_earned = wage - res.basic_earned
        res.allowance_earned = q2(ZERO)
        hourly = daily / HOURS_PER_DAY
    else:
        res.payable_days = res.present_days + res.paid_leave_days + res.holiday_days + res.weekly_off_days
        factor = res.payable_days / dim
        res.basic_earned = q2(basic * factor)
        res.da_earned = q2(da * factor)
        res.allowance_earned = q2(other * factor)
        hourly = (basic + da) / (dim * HOURS_PER_DAY)

    # Step 3: overtime at 1.5x.
    res.overtime_pay = q2(ot_hours * hourly * OT_MULTIPLIER)

    # Step 4: festival (Dashain) allowance, prorated by months employed.
    if inp.include_festival_allowance:
        months = Decimal(months_employed(inp.start_date, inp.period_end))
        share = min(months / Decimal(12), ONE)
        base = basic if inp.wage_type == "monthly" else daily * 30 * ratio
        res.festival_allowance = q2(base * share)

    # Step 5
    res.gross_pay = q2(
        res.basic_earned + res.da_earned + res.allowance_earned + res.overtime_pay + res.festival_allowance
    )

    # Step 6: SSF on basic earned.
    if inp.ssf_enrolled:
        res.ssf_employee = q2(res.basic_earned * SSF_EMPLOYEE_RATE)
        res.ssf_employer = q2(res.basic_earned * SSF_EMPLOYER_RATE)

    # Step 7: TDS
    res.tds = monthly_tds(res.gross_pay, res.ssf_employee, inp.tax_bands, inp.ssf_enrolled)

    # Step 8/9: deductions & net (advance recovery never pushes net below zero).
    res.other_deductions = q2(inp.other_deductions)
    before_advance = res.gross_pay - res.ssf_employee - res.tds - res.other_deductions
    res.advance_recovery = q2(max(min(advance_due(inp.advances), before_advance), ZERO))
    res.net_pay = q2(before_advance - res.advance_recovery)
    return res
