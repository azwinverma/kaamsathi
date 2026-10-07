"""Pure payroll engine tests with hand-computed expectations (CONTRACT §2 Payroll calculation).

Reference month: Shrawan 2083 = 2026-07-17 (Fri) .. 2026-08-16 (Sun), 31 days.
Saturdays (weekly off, day 6): Jul 18, Jul 25, Aug 1, Aug 8, Aug 15 → 26 working days.
"""

import datetime as dt
from decimal import Decimal as D

from apps.core.money import q2
from apps.payroll import engine
from apps.payroll.engine import AdvanceBalance, DayRecord, PayInput, TaxBand, calculate

START = dt.date(2026, 7, 17)
END = dt.date(2026, 8, 16)
DIM = 31
SATURDAYS = {
    dt.date(2026, 7, 18),
    dt.date(2026, 7, 25),
    dt.date(2026, 8, 1),
    dt.date(2026, 8, 8),
    dt.date(2026, 8, 15),
}

BANDS = (
    TaxBand(D("0"), D("500000"), D("1")),
    TaxBand(D("500000"), D("700000"), D("10")),
    TaxBand(D("700000"), D("1000000"), D("20")),
    TaxBand(D("1000000"), D("2000000"), D("30")),
    TaxBand(D("2000000"), D("5000000"), D("36")),
    TaxBand(D("5000000"), None, D("39")),
)


def days(start=START, end=END):
    d = start
    while d <= end:
        yield d
        d += dt.timedelta(days=1)


def working_days(start=START, end=END):
    return [d for d in days(start, end) if d not in SATURDAYS]


def full_present(start=START, end=END, ot=None):
    """Present on every working day; Saturdays have no record (→ weekly_off)."""
    ot = ot or {}
    return {d: DayRecord("present", ot.get(d, 0)) for d in working_days(start, end)}


def make(**kw):
    base = dict(
        wage_type="monthly",
        start_date=dt.date(2025, 1, 1),
        end_date=None,
        period_start=START,
        period_end=END,
        days_in_month=DIM,
        basic_salary=D("12170"),
        dearness_allowance=D("7380"),
        weekly_off_day=6,
    )
    base.update(kw)
    if "attendance" not in base:
        base["attendance"] = full_present()
    return PayInput(**base)


# --- monthly basics -----------------------------------------------------------


def test_full_month_minimum_wage_non_ssf_with_tds():
    r = calculate(make(tax_bands=BANDS))
    assert r.present_days == 26 and r.weekly_off_days == 5 and r.absent_days == 0
    assert r.payable_days == 31
    assert r.basic_earned == D("12170.00")
    assert r.da_earned == D("7380.00")
    assert r.gross_pay == D("19550.00")
    # 19550×12 = 234600 @1% = 2346 / 12 = 195.5 → rupee (half up) 196
    assert r.tds == D("196.00")
    assert r.ssf_employee == 0 and r.ssf_employer == 0
    assert r.net_pay == D("19354.00")


def test_full_month_ssf_enrolled_waives_one_percent_slab():
    r = calculate(make(tax_bands=BANDS, ssf_enrolled=True))
    assert r.ssf_employee == D("1338.70")  # 11% of 12170
    assert r.ssf_employer == D("2434.00")  # 20% of 12170
    assert r.tds == D("0.00")  # (19550-1338.70)×12 = 218535.60 all in the waived 1% slab
    assert r.net_pay == D("18211.30")  # employer share not deducted


def test_proration_by_join_date():
    # joins 2026-07-27 → window 27 Jul..16 Aug = 21 days (Saturdays Aug 1, 8, 15)
    join = dt.date(2026, 7, 27)
    r = calculate(
        make(
            start_date=join,
            basic_salary=D("20000"),
            dearness_allowance=D("10000"),
            attendance=full_present(join, END),
        )
    )
    assert r.present_days == 18 and r.weekly_off_days == 3 and r.absent_days == 0
    assert r.payable_days == 21
    assert r.basic_earned == D("13548.39")  # 20000×21/31 = 13548.387
    assert r.da_earned == D("6774.19")  # 10000×21/31 = 6774.194
    assert r.gross_pay == D("20322.58")


def test_proration_by_end_date():
    # leaves 2026-08-06 → window 17 Jul..6 Aug = 21 days (Saturdays Jul 18, 25, Aug 1)
    leave = dt.date(2026, 8, 6)
    r = calculate(
        make(
            end_date=leave,
            basic_salary=D("20000"),
            dearness_allowance=D("10000"),
            attendance=full_present(START, leave),
        )
    )
    assert r.payable_days == 21
    assert r.weekly_off_days == 3
    assert r.basic_earned == D("13548.39")
    assert r.da_earned == D("6774.19")


def test_attendance_outside_employment_window_ignored():
    join = dt.date(2026, 8, 10)
    r = calculate(make(start_date=join, attendance=full_present()))  # records before join present
    # window 10..16 Aug = 7 days, Saturday Aug 15 → 6 present + 1 weekly off
    assert r.present_days == 6 and r.weekly_off_days == 1 and r.payable_days == 7


def test_employment_not_overlapping_period_is_zero():
    r = calculate(make(start_date=dt.date(2026, 9, 1), attendance={}))
    assert r.payable_days == 0 and r.gross_pay == 0 and r.net_pay == 0


def test_no_records_counts_absent_except_weekly_off_and_holidays():
    hol = dt.date(2026, 7, 22)  # Wednesday
    r = calculate(make(attendance={}, holidays=frozenset({hol})))
    assert r.weekly_off_days == 5
    assert r.holiday_days == 1
    assert r.absent_days == 25
    assert r.payable_days == 6
    assert r.basic_earned == D("2355.48")  # 12170×6/31 = 2355.484


def test_weekly_off_day_follows_org_setting():
    # Sundays in period: Jul 19, 26, Aug 2, 9, 16
    r = calculate(make(attendance={}, weekly_off_day=0))
    assert r.weekly_off_days == 5 and r.absent_days == 26


def test_payable_days_mixed_statuses():
    wd = working_days()
    att = {}
    for d in wd[:20]:
        att[d] = DayRecord("present")
    att[wd[20]] = DayRecord("half_day")
    att[wd[21]] = DayRecord("leave")  # paid
    att[wd[22]] = DayRecord("leave", unpaid_leave=True)  # unpaid → excluded
    att[wd[23]] = DayRecord("holiday")
    holiday_no_record = wd[24]
    # wd[25] has no record → absent
    r = calculate(
        make(
            attendance=att,
            holidays=frozenset({holiday_no_record}),
            basic_salary=D("15000"),
            dearness_allowance=D("9000"),
            other_allowance=D("1000"),
        )
    )
    assert r.present_days == D("20.5")
    assert r.paid_leave_days == 1
    assert r.holiday_days == 2
    assert r.weekly_off_days == 5
    assert r.absent_days == D("2.5")
    assert r.payable_days == D("28.5")
    assert r.basic_earned == D("13790.32")  # 15000×28.5/31 = 13790.3226
    assert r.da_earned == D("8274.19")  # 9000×28.5/31 = 8274.1935
    assert r.allowance_earned == D("919.35")  # 1000×28.5/31 = 919.3548
    assert r.gross_pay == D("22983.86")


def test_explicit_absent_record_on_weekly_off_is_absent():
    att = full_present()
    att[dt.date(2026, 7, 18)] = DayRecord("absent")
    r = calculate(make(attendance=att))
    assert r.weekly_off_days == 4 and r.absent_days == 1 and r.payable_days == 30


# --- overtime -------------------------------------------------------------------


def test_overtime_monthly_one_and_half_times():
    wd = working_days()
    att = full_present(ot={wd[0]: 90, wd[1]: 30})  # 2 hours
    r = calculate(make(attendance=att, basic_salary=D("15000"), dearness_allowance=D("9000")))
    assert r.overtime_hours == D("2.00")
    # hourly = 24000 / (31×8) = 96.7742; ×2×1.5 = 290.3226
    assert r.overtime_pay == D("290.32")
    assert r.gross_pay == D("24290.32")


def test_overtime_daily_uses_daily_wage_over_eight():
    wd = working_days()
    att = {d: DayRecord("present") for d in wd[:10]}
    att[wd[0]] = DayRecord("present", 180)  # 3 h
    r = calculate(
        make(
            wage_type="daily",
            daily_wage=D("1000"),
            basic_salary=D("0"),
            dearness_allowance=D("0"),
            attendance=att,
        )
    )
    assert r.overtime_pay == D("562.50")  # 3 × 125 × 1.5


# --- daily wage -----------------------------------------------------------------


def test_daily_wage_present_only_split_by_min_wage_ratio():
    wd = working_days()
    att = {d: DayRecord("present") for d in wd[:20]}
    att[wd[20]] = DayRecord("half_day")
    att[wd[21]] = DayRecord("leave")  # paid leave not paid for daily wage
    att[wd[22]] = DayRecord("holiday")
    r = calculate(
        make(
            wage_type="daily",
            daily_wage=D("1000"),
            basic_salary=None,
            dearness_allowance=None,
            attendance=att,
            basic_ratio=D("12170") / D("19550"),
        )
    )
    assert r.payable_days == D("20.5")
    # 20500 × 12170/19550 = 12761.381
    assert r.basic_earned == D("12761.38")
    assert r.da_earned == D("7738.62")
    assert r.basic_earned + r.da_earned == D("20500.00")
    assert r.allowance_earned == 0
    assert r.gross_pay == D("20500.00")


def test_daily_wage_ssf_on_basic_earned():
    wd = working_days()
    att = {d: DayRecord("present") for d in wd[:20]}
    r = calculate(make(wage_type="daily", daily_wage=D("1000"), ssf_enrolled=True, attendance=att))
    # wage 20000 → basic 20000×0.6225064 = 12450.13
    assert r.basic_earned == D("12450.13")
    assert r.ssf_employee == D("1369.51")  # 11% = 1369.5143
    assert r.ssf_employer == D("2490.03")  # 20% = 2490.026


# --- festival allowance ------------------------------------------------------------


def test_festival_allowance_prorated_monthly():
    # employed 2026-02-16 → 6 completed months by 2026-08-16
    r = calculate(
        make(
            start_date=dt.date(2026, 2, 16),
            basic_salary=D("15000"),
            dearness_allowance=D("9000"),
            include_festival_allowance=True,
        )
    )
    assert r.festival_allowance == D("7500.00")  # 15000 × 6/12
    assert r.gross_pay == D("31500.00")


def test_festival_allowance_capped_at_one_basic():
    r = calculate(
        make(
            start_date=dt.date(2020, 1, 1),
            basic_salary=D("15000"),
            dearness_allowance=D("9000"),
            include_festival_allowance=True,
        )
    )
    assert r.festival_allowance == D("15000.00")


def test_festival_allowance_daily_wage():
    wd = working_days()
    r = calculate(
        make(
            wage_type="daily",
            daily_wage=D("1000"),
            start_date=dt.date(2020, 1, 1),
            attendance={d: DayRecord("present") for d in wd},
            include_festival_allowance=True,
        )
    )
    # 1000 × 30 × 12170/19550 = 18675.1918
    assert r.festival_allowance == D("18675.19")


def test_festival_allowance_off_by_default():
    r = calculate(make(start_date=dt.date(2020, 1, 1)))
    assert r.festival_allowance == 0


def test_months_employed():
    assert engine.months_employed(dt.date(2026, 2, 16), dt.date(2026, 8, 16)) == 6
    assert engine.months_employed(dt.date(2026, 8, 1), dt.date(2026, 8, 16)) == 0
    assert engine.months_employed(dt.date(2026, 9, 1), dt.date(2026, 8, 16)) == 0


# --- TDS ---------------------------------------------------------------------------


def test_tds_multiple_slabs_non_ssf():
    r = calculate(make(basic_salary=D("40000"), dearness_allowance=D("20000"), tax_bands=BANDS))
    # annual 720000: 5000 + 20000 + 4000 = 29000 / 12 = 2416.67 → 2417
    assert r.tds == D("2417.00")
    assert r.net_pay == D("57583.00")


def test_tds_multiple_slabs_ssf_skips_first_slab():
    r = calculate(
        make(basic_salary=D("40000"), dearness_allowance=D("20000"), tax_bands=BANDS, ssf_enrolled=True)
    )
    assert r.ssf_employee == D("4400.00")
    assert r.ssf_employer == D("8000.00")
    # (60000-4400)×12 = 667200 → (667200-500000)×10% = 16720 / 12 = 1393.33 → 1393
    assert r.tds == D("1393.00")
    assert r.net_pay == D("54207.00")


def test_tds_high_income_all_slabs():
    r = calculate(make(basic_salary=D("150000"), dearness_allowance=D("50000"), tax_bands=BANDS))
    # 2,400,000: 5000+20000+60000+300000+144000 = 529000 / 12 = 44083.33 → 44083
    assert r.tds == D("44083.00")


def test_tds_top_slab():
    assert engine.annual_tax(D("6000000"), BANDS, False) == D("5000") + D("20000") + D("60000") + D(
        "300000"
    ) + D("1080000") + D("390000")


def test_tds_without_bands_is_zero():
    assert calculate(make()).tds == 0


# --- advances, deductions, net -------------------------------------------------------


def test_advance_recovery_capped_by_balance():
    advances = (
        AdvanceBalance(D("2000"), D("1500")),
        AdvanceBalance(D("1000"), D("5000")),
        AdvanceBalance(D("500"), D("0")),
    )
    r = calculate(make(advances=advances))
    assert r.advance_recovery == D("2500.00")  # min(2000,1500) + min(1000,5000) + 0
    assert r.net_pay == D("17050.00")


def test_net_formula_with_all_deductions():
    r = calculate(
        make(
            basic_salary=D("40000"),
            dearness_allowance=D("20000"),
            tax_bands=BANDS,
            ssf_enrolled=True,
            other_deductions=D("250.50"),
            advances=(AdvanceBalance(D("3000"), D("10000")),),
        )
    )
    assert r.net_pay == r.gross_pay - r.ssf_employee - r.tds - r.advance_recovery - r.other_deductions
    assert r.net_pay == D("50956.50")  # 60000 - 4400 - 1393 - 3000 - 250.50


def test_rounding_half_up_two_dp():
    # basic_earned 12171.50 × 11% = 1338.865 → HALF_UP 1338.87 (banker's would give 1338.86)
    r = calculate(make(basic_salary=D("12171.50"), ssf_enrolled=True))
    assert r.ssf_employee == D("1338.87")
    assert q2("0.125") == D("0.13")
    assert q2("2.345") == D("2.35")
    assert q2("-0.005") == D("-0.01")


def test_all_money_fields_have_two_places():
    r = calculate(
        make(
            tax_bands=BANDS,
            ssf_enrolled=True,
            include_festival_allowance=True,
            start_date=dt.date(2026, 2, 16),
        )
    )
    for name in (
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
        "net_pay",
    ):
        assert getattr(r, name).as_tuple().exponent == -2, name
