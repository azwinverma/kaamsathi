"""Payroll persistence + endpoints.

Month: Shrawan 2083 (2026-07-17..2026-08-16, 31 days, no national holidays).
"""

import datetime as dt
from decimal import Decimal as D

import pytest

from apps.payroll.models import PayrollRun, Payslip
from apps.workforce.models import Advance
from tests import factories as f

pytestmark = pytest.mark.django_db

START, END = dt.date(2026, 7, 17), dt.date(2026, 8, 16)
SATURDAYS = {
    dt.date(2026, 7, 18),
    dt.date(2026, 7, 25),
    dt.date(2026, 8, 1),
    dt.date(2026, 8, 8),
    dt.date(2026, 8, 15),
}


def working_days():
    d, out = START, []
    while d <= END:
        if d not in SATURDAYS:
            out.append(d)
        d += dt.timedelta(days=1)
    return out


def mark_present(emp, dates, **kw):
    for d in dates:
        f.AttendanceFactory(employment=emp, date=d, **kw)


def create_run(client, **extra):
    return client.post("/api/v1/org/payroll-runs", {"bs_year": 2083, "bs_month": 4, **extra}, format="json")


def test_create_run_computes_payslips(owner_client, org):
    emp = f.EmploymentFactory(organization=org, ssf_enrolled=True)
    mark_present(emp, working_days())
    res = create_run(owner_client)
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["period_start"] == "2026-07-17" and body["period_end"] == "2026-08-16"
    assert body["days_in_month"] == 31 and body["month_name_en"] == "Shrawan"
    assert body["totals"]["workers"] == 1
    assert body["totals"]["gross"] == "19550.00"
    assert body["totals"]["ssf_employee"] == "1338.70"
    assert body["totals"]["ssf_employer"] == "2434.00"
    assert body["totals"]["tds"] == "0.00"
    assert body["totals"]["net"] == "18211.30"
    assert body["employer_cost"] == "21984.00"
    slip = Payslip.objects.get(employment=emp)
    assert slip.payable_days == 31 and slip.weekly_off_days == 5


def test_tds_uses_seeded_slabs(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    mark_present(emp, working_days())
    create_run(owner_client)
    assert Payslip.objects.get(employment=emp).tds == D("196.00")


def test_duplicate_run(owner_client, org):
    assert create_run(owner_client).status_code == 201
    res = create_run(owner_client)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "duplicate"


def test_missing_attendance_is_absent_and_org_holiday_paid(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    f.HolidayFactory(organization=org, date=dt.date(2026, 7, 22))
    create_run(owner_client)
    slip = Payslip.objects.get(employment=emp)
    assert slip.holiday_days == 1 and slip.weekly_off_days == 5 and slip.absent_days == 25
    assert slip.basic_earned == D("2355.48")


def test_other_org_holiday_not_counted(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    f.HolidayFactory(organization=f.OrganizationFactory(), date=dt.date(2026, 7, 22))
    create_run(owner_client)
    assert Payslip.objects.get(employment=emp).holiday_days == 0


def test_unpaid_leave_excluded(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    wd = working_days()
    mark_present(emp, wd[2:])
    unpaid = f.LeaveFactory(employment=emp, leave_type="unpaid", from_date=wd[0], to_date=wd[0])
    paid = f.LeaveFactory(employment=emp, leave_type="sick", from_date=wd[1], to_date=wd[1])
    for lv in (unpaid, paid):
        assert owner_client.post(f"/api/v1/org/leaves/{lv.id}/approve").status_code == 200
    create_run(owner_client)
    slip = Payslip.objects.get(employment=emp)
    assert slip.paid_leave_days == 1
    assert slip.absent_days == 1
    assert slip.payable_days == 30
    assert slip.basic_earned == D("11777.42")  # 12170 × 30/31


def test_employment_joined_mid_month_and_ended_excluded(owner_client, org):
    join = dt.date(2026, 7, 27)
    emp = f.EmploymentFactory(
        organization=org, start_date=join, basic_salary=D("20000"), dearness_allowance=D("10000")
    )
    mark_present(emp, [d for d in working_days() if d >= join])
    f.EmploymentFactory(
        organization=org, start_date=dt.date(2025, 1, 1), end_date=dt.date(2026, 7, 1), status="ended"
    )
    create_run(owner_client)
    run = PayrollRun.objects.get(organization=org)
    assert run.payslips.count() == 1
    slip = run.payslips.get()
    assert slip.payable_days == 21 and slip.basic_earned == D("13548.39")


def test_daily_wage_uses_min_wage_ratio(owner_client, org):
    emp = f.EmploymentFactory(
        organization=org, wage_type="daily", daily_wage=D("1000"), basic_salary=None, dearness_allowance=None
    )
    mark_present(emp, working_days()[:20])
    create_run(owner_client)
    slip = Payslip.objects.get(employment=emp)
    assert slip.gross_pay == D("20000.00")
    assert slip.basic_earned == D("12450.13")
    assert slip.da_earned == D("7549.87")


def test_festival_allowance_flag(owner_client, org):
    emp = f.EmploymentFactory(
        organization=org,
        start_date=dt.date(2026, 2, 16),
        basic_salary=D("15000"),
        dearness_allowance=D("9000"),
    )
    mark_present(emp, working_days())
    create_run(owner_client, include_festival_allowance=True)
    assert Payslip.objects.get(employment=emp).festival_allowance == D("7500.00")


def test_payslip_edit_recomputes_net_and_lifecycle(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    mark_present(emp, working_days())
    adv = f.AdvanceFactory(employment=emp, amount=D("5000"), recover_per_month=D("2000"))
    run_id = create_run(owner_client).json()["id"]
    slip = Payslip.objects.get(employment=emp)
    assert slip.advance_recovery == D("2000.00")
    assert slip.net_pay == D("17354.00")  # 19550 − 196 − 2000

    res = owner_client.patch(f"/api/v1/org/payslips/{slip.id}", {"other_deductions": "500.00"}, format="json")
    assert res.status_code == 200, res.json()
    slip.refresh_from_db()
    assert slip.other_deductions == D("500.00") and slip.net_pay == D("16854.00")

    # recalculate keeps the manual deduction
    assert owner_client.post(f"/api/v1/org/payroll-runs/{run_id}/recalculate").status_code == 200
    slip.refresh_from_db()
    assert slip.net_pay == D("16854.00")

    # mark-paid before approval → invalid_state
    res = owner_client.post(
        f"/api/v1/org/payroll-runs/{run_id}/mark-paid", {"paid_on": "2026-08-20"}, format="json"
    )
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"

    assert owner_client.post(f"/api/v1/org/payroll-runs/{run_id}/approve").json()["status"] == "approved"
    res = owner_client.patch(f"/api/v1/org/payslips/{slip.id}", {"other_deductions": "1.00"}, format="json")
    assert res.json()["error"]["code"] == "invalid_state"
    res = owner_client.post(f"/api/v1/org/payroll-runs/{run_id}/recalculate")
    assert res.json()["error"]["code"] == "invalid_state"

    res = owner_client.post(
        f"/api/v1/org/payroll-runs/{run_id}/mark-paid", {"paid_on": "2026-08-20"}, format="json"
    )
    assert res.status_code == 200 and res.json()["status"] == "paid"
    adv.refresh_from_db()
    assert adv.recovered_amount == D("2000.00")
    slip.refresh_from_db()
    assert slip.payment_status == "paid"


def test_advance_recovery_capped_at_remaining_balance(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    mark_present(emp, working_days())
    f.AdvanceFactory(
        employment=emp, amount=D("5000"), recover_per_month=D("2000"), recovered_amount=D("4500")
    )
    create_run(owner_client)
    assert Payslip.objects.get(employment=emp).advance_recovery == D("500.00")


def test_mark_paid_spreads_recovery_over_advances(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    mark_present(emp, working_days())
    a1 = f.AdvanceFactory(
        employment=emp, amount=D("1000"), recover_per_month=D("1000"), given_on=dt.date(2026, 6, 1)
    )
    a2 = f.AdvanceFactory(
        employment=emp, amount=D("3000"), recover_per_month=D("500"), given_on=dt.date(2026, 7, 1)
    )
    run_id = create_run(owner_client).json()["id"]
    assert Payslip.objects.get(employment=emp).advance_recovery == D("1500.00")
    owner_client.post(f"/api/v1/org/payroll-runs/{run_id}/approve")
    owner_client.post(
        f"/api/v1/org/payroll-runs/{run_id}/mark-paid", {"paid_on": "2026-08-20"}, format="json"
    )
    a1.refresh_from_db()
    a2.refresh_from_db()
    assert a1.recovered_amount == D("1000.00")
    assert a2.recovered_amount == D("500.00")
    assert Advance.objects.filter(employment=emp).count() == 2


def test_payroll_hr_allowed_supervisor_forbidden(org, make_member):
    _, hr = make_member("hr")
    assert create_run(hr).status_code == 201
    _, sup = make_member("supervisor")
    res = sup.get("/api/v1/org/payroll-runs")
    assert res.status_code == 403 and res.json()["error"]["code"] == "permission_denied"


def test_exports(owner_client, org):
    emp = f.EmploymentFactory(organization=org, ssf_enrolled=True)
    mark_present(emp, working_days())
    run_id = create_run(owner_client).json()["id"]
    res = owner_client.get(f"/api/v1/org/payroll-runs/{run_id}/ssf.csv")
    assert res.status_code == 200
    text = res.content.decode("utf-8-sig")
    assert "1338.70" in text and "2434.00" in text
    assert owner_client.get(f"/api/v1/org/payroll-runs/{run_id}/bank-transfer.csv").status_code == 200
    assert owner_client.get(f"/api/v1/org/payroll-runs/{run_id}/wage-sheet.xlsx").status_code == 200
    slip = Payslip.objects.get(employment=emp)
    res = owner_client.get(f"/api/v1/org/payslips/{slip.id}/payslip.pdf")
    assert res.status_code == 200 and res["Content-Type"] == "application/pdf"
