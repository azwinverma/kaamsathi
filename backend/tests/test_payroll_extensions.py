"""Payroll extensions: hourly wage type (R005), pay groups (R001), pay policy (R003).

Hand-computed expectations. Month: Shrawan 2083 = 2026-07-17 .. 2026-08-16 (31 days),
Saturdays (weekly off) Jul 18, Jul 25, Aug 1, Aug 8, Aug 15 → 26 working days.
Minimum-wage basic ratio = 12170 / 19550.
"""

import datetime as dt
from decimal import Decimal as D

import pytest
from django.utils import timezone

from apps.payroll.engine import DayRecord, PayInput, calculate
from apps.payroll.models import PayGroup, PayPolicy, PayrollRun, Payslip
from tests import factories as f

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


def make(**kw):
    base = dict(
        wage_type="monthly",
        start_date=dt.date(2025, 1, 1),
        end_date=None,
        period_start=START,
        period_end=END,
        days_in_month=31,
        basic_salary=D("12170"),
        dearness_allowance=D("7380"),
        weekly_off_day=6,
        attendance={d: DayRecord("present") for d in working_days()},
    )
    base.update(kw)
    return PayInput(**base)


# ============================================================== engine: hourly (R005)


def test_hourly_regular_hours_overtime_and_basic_da_split():
    att = {
        dt.date(2026, 7, 20): DayRecord("present", hours=D("8")),  # 8 regular
        dt.date(2026, 7, 21): DayRecord("present", hours=D("10")),  # 8 regular + 2 OT
        dt.date(2026, 7, 22): DayRecord("half_day"),  # unknown hours → 8 × 0.5 = 4 regular
        dt.date(2026, 7, 23): DayRecord("present", overtime_minutes=30),  # unknown → 8 + 0.5 OT
        dt.date(2026, 7, 24): DayRecord("absent", hours=D("9")),  # not worked → ignored
    }
    r = calculate(make(wage_type="hourly", hourly_wage=D("110"), attendance=att))
    assert r.regular_hours == D("28.00")
    assert r.overtime_hours == D("2.50")
    assert r.present_days == D("3.5") and r.payable_days == D("3.5")
    # wage 110 × 28 = 3080.00 → basic 3080 × 12170/19550 = 1917.3197 → 1917.32; DA = 1162.68
    assert r.basic_earned == D("1917.32") and r.da_earned == D("1162.68")
    assert r.overtime_pay == D("412.50")  # 2.5 × 110 × 1.5
    assert r.gross_pay == D("3492.50") and r.net_pay == D("3492.50")


def test_hourly_festival_uses_240_hour_month_and_ssf_on_basic():
    att = {dt.date(2026, 7, 20): DayRecord("present", hours=D("8"))}
    r = calculate(
        make(
            wage_type="hourly",
            hourly_wage=D("101"),
            attendance=att,
            include_festival_allowance=True,
            ssf_enrolled=True,
        )
    )
    # 101 × 8 = 808 → basic 808 × 12170/19550 = 502.9852 → 502.99; DA = 305.01
    assert r.basic_earned == D("502.99") and r.da_earned == D("305.01")
    # festival: 101 × 8 × 30 × ratio = 24240 × 12170/19550 = 15089.5549 → 15089.55 (12+ months employed)
    assert r.festival_allowance == D("15089.55")
    assert r.ssf_employee == D("55.33")  # 502.99 × 11% = 55.3289
    assert r.ssf_employer == D("100.60")  # 502.99 × 20% = 100.598


# ============================================================== engine: pay policy (R003)


def test_policy_defaults_reproduce_contract():
    assert (
        calculate(make()).as_dict()
        == calculate(
            make(
                ot_multiplier=D("1.5"),
                festival_rule="one_month_basic",
                rounding="two_decimals",
                weekly_off_paid=True,
                half_day_fraction=D("0.5"),
            )
        ).as_dict()
    )


def test_policy_ot_multiplier_two_and_floor_at_one_point_five():
    att = {d: DayRecord("present") for d in working_days()}
    att[dt.date(2026, 7, 20)] = DayRecord("present", overtime_minutes=240)
    # hourly = 19550 / (31 × 8) = 78.830645; × 4 h × 2 = 630.645 → 630.65
    assert calculate(make(attendance=att, ot_multiplier=D("2"))).overtime_pay == D("630.65")
    # below the Labour Act floor is clamped to 1.5: 78.830645 × 4 × 1.5 = 472.98
    assert calculate(make(attendance=att, ot_multiplier=D("1.2"))).overtime_pay == D("472.98")


def test_policy_weekly_off_unpaid_and_nearest_rupee():
    r = calculate(make(weekly_off_paid=False))
    assert r.weekly_off_days == 5 and r.payable_days == 26
    # 12170 × 26/31 = 10207.097 → 10207.10 ; 7380 × 26/31 = 6189.677 → 6189.68
    assert r.basic_earned == D("10207.10") and r.da_earned == D("6189.68")
    r = calculate(make(weekly_off_paid=False, rounding="nearest_rupee"))
    assert r.basic_earned == D("10207.00") and r.da_earned == D("6190.00")
    assert r.gross_pay == D("16397.00")


def test_policy_half_day_fraction():
    att = {d: DayRecord("present") for d in working_days()}
    att[dt.date(2026, 7, 20)] = DayRecord("half_day")
    r = calculate(make(attendance=att, half_day_fraction=D("0.75")))
    assert r.present_days == D("25.75") and r.absent_days == D("0.25")


def test_policy_festival_rules():
    assert calculate(make(include_festival_allowance=True)).festival_allowance == D("12170.00")
    r = calculate(
        make(include_festival_allowance=True, festival_rule="custom_amount", festival_amount=D("15000"))
    )
    assert r.festival_allowance == D("15000.00")
    # 6 months employed by period end → half
    r = calculate(
        make(
            include_festival_allowance=True,
            festival_rule="custom_amount",
            festival_amount=D("15000"),
            start_date=dt.date(2026, 2, 16),
        )
    )
    assert r.festival_allowance == D("7500.00")
    r = calculate(make(include_festival_allowance=True, festival_rule="none"))
    assert r.festival_allowance == D("0.00") and r.gross_pay == D("19550.00")


# ============================================================== API


def create_run(client, **extra):
    return client.post("/api/v1/org/payroll-runs", {"bs_year": 2083, "bs_month": 4, **extra}, format="json")


def emp_payload(**kw):
    return {
        "worker": {"phone": "9841000077", "full_name": "Ram Hourly"},
        "designation": "Helper",
        "start_date": "2026-07-01",
        "ssf_enrolled": False,
        **kw,
    }


@pytest.mark.django_db
@pytest.mark.parametrize(
    "wage,status,code",
    [
        ({"wage_type": "hourly", "hourly_wage": "100"}, 400, "below_minimum_wage"),
        ({"wage_type": "hourly", "hourly_wage": "101"}, 201, None),
        ({"wage_type": "hourly", "hourly_wage": "105", "part_time": True}, 400, "below_minimum_wage"),
        ({"wage_type": "hourly", "hourly_wage": "107", "part_time": True}, 201, None),
        ({"wage_type": "hourly"}, 400, "validation_error"),
    ],
)
def test_hourly_employment_minimum_wage(owner_client, wage, status, code):
    res = owner_client.post("/api/v1/org/employments", emp_payload(**wage), format="json")
    assert res.status_code == status, res.json()
    if code:
        assert res.json()["error"]["code"] == code
        if code == "below_minimum_wage":
            assert "hourly_wage" in res.json()["error"]["fields"]
    else:
        body = res.json()
        assert body["wage_type"] == "hourly" and body["hourly_wage"] == f"{D(wage['hourly_wage']):.2f}"
        assert body["part_time"] is bool(wage.get("part_time"))


@pytest.mark.django_db
def test_hourly_job_minimum_wage(owner_client):
    job = {"title": "Packer", "trade": "cook", "openings_count": 1, "wage_type": "hourly"}
    res = owner_client.post("/api/v1/org/jobs", {**job, "wage_amount": "90"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "below_minimum_wage"
    res = owner_client.post("/api/v1/org/jobs", {**job, "wage_amount": "120"}, format="json")
    assert res.status_code == 201, res.json()


@pytest.mark.django_db
def test_hourly_payroll_from_check_in_out_and_hours_worked(owner_client, org):
    shift = f.ShiftFactory(organization=org, break_minutes=60)
    emp = f.EmploymentFactory(
        organization=org,
        wage_type="hourly",
        hourly_wage=D("110"),
        basic_salary=None,
        dearness_allowance=None,
        shift=shift,
    )
    tz = timezone.get_current_timezone()
    f.AttendanceFactory(
        employment=emp,
        date=dt.date(2026, 7, 20),
        check_in_at=dt.datetime(2026, 7, 20, 9, 0, tzinfo=tz),
        check_out_at=dt.datetime(2026, 7, 20, 19, 0, tzinfo=tz),
    )  # 10 h − 1 h break = 9 h → 8 regular + 1 OT
    f.AttendanceFactory(employment=emp, date=dt.date(2026, 7, 21), hours_worked=D("6"))
    res = create_run(owner_client)
    assert res.status_code == 201, res.json()
    slip = Payslip.objects.get(employment=emp)
    assert slip.wage_type == "hourly"
    assert slip.regular_hours == D("14.00") and slip.overtime_hours == D("1.00")
    # 110 × 14 = 1540 → basic 958.66 (1540 × 12170/19550 = 958.6598), DA 581.34; OT 165.00
    assert slip.basic_earned == D("958.66") and slip.da_earned == D("581.34")
    assert slip.overtime_pay == D("165.00") and slip.gross_pay == D("1705.00")
    data = owner_client.get(f"/api/v1/org/payroll-runs/{res.json()['id']}/payslips").json()["results"][0]
    assert data["regular_hours"] == "14.00"


@pytest.mark.django_db
def test_attendance_bulk_accepts_hours_worked(owner_client, org):
    import uuid

    emp = f.EmploymentFactory(organization=org, wage_type="hourly", hourly_wage=D("120"))
    res = owner_client.post(
        "/api/v1/org/attendance/bulk",
        {
            "records": [
                {
                    "client_uuid": str(uuid.uuid4()),
                    "employment_id": str(emp.id),
                    "date": "2026-07-20",
                    "status": "present",
                    "method": "supervisor",
                    "hours_worked": "9.5",
                }
            ]
        },
        format="json",
    )
    assert res.status_code == 200 and len(res.json()["saved"]) == 1, res.json()
    assert emp.attendance.get().hours_worked == D("9.50")


# ------------------------------------------------------------------ pay policy API


@pytest.mark.django_db
def test_pay_policy_get_defaults_and_patch_rules(owner_client, org, make_member):
    res = owner_client.get("/api/v1/org/pay-policy")
    assert res.status_code == 200
    assert res.json() == {
        "ot_multiplier": "1.50",
        "festival_allowance_rule": "one_month_basic",
        "festival_custom_amount": "0.00",
        "festival_month": None,
        "rounding": "two_decimals",
        "weekly_off_paid": True,
        "half_day_fraction": "0.50",
        "updated_at": None,
        "is_default": True,
    }
    bad = owner_client.patch("/api/v1/org/pay-policy", {"ot_multiplier": "1.4"}, format="json")
    assert bad.status_code == 400 and "ot_multiplier" in bad.json()["error"]["fields"]
    bad = owner_client.patch(
        "/api/v1/org/pay-policy", {"festival_allowance_rule": "custom_amount"}, format="json"
    )
    assert bad.status_code == 400 and "festival_custom_amount" in bad.json()["error"]["fields"]
    _, hr = make_member("hr")
    assert hr.get("/api/v1/org/pay-policy").status_code == 200
    assert hr.patch("/api/v1/org/pay-policy", {"ot_multiplier": "2"}, format="json").status_code == 403
    ok = owner_client.patch(
        "/api/v1/org/pay-policy", {"ot_multiplier": "2.00", "festival_month": 4}, format="json"
    )
    assert ok.status_code == 200, ok.json()
    assert ok.json()["ot_multiplier"] == "2.00" and ok.json()["is_default"] is False
    assert PayPolicy.objects.get(organization=org).festival_month == 4
    from apps.audit.models import AuditLog

    assert AuditLog.objects.filter(action="payroll.pay_policy.update", organization=org).exists()


@pytest.mark.django_db
def test_run_uses_pay_policy_ot_multiplier_and_festival_month(owner_client, org):
    PayPolicy.objects.create(organization=org, ot_multiplier=D("2"), festival_month=4)
    emp = f.EmploymentFactory(organization=org)
    for d in working_days():
        f.AttendanceFactory(employment=emp, date=d, overtime_minutes=240 if d == dt.date(2026, 7, 20) else 0)
    res = create_run(owner_client)  # include_festival_allowance omitted → policy month 4 = Shrawan
    assert res.status_code == 201
    assert res.json()["include_festival_allowance"] is True
    slip = Payslip.objects.get(employment=emp)
    assert slip.overtime_pay == D("630.65") and slip.festival_allowance == D("12170.00")


# ------------------------------------------------------------------ pay groups API


@pytest.mark.django_db
def test_pay_groups_split_runs_without_double_counting(owner_client, org, site):
    monthly = f.EmploymentFactory(organization=org)
    daily = f.EmploymentFactory(
        organization=org, wage_type="daily", daily_wage=D("800"), basic_salary=None, dearness_allowance=None
    )
    at_site = f.EmploymentFactory(organization=org, site=site)
    res = owner_client.post(
        "/api/v1/org/pay-groups", {"name": "Jyala", "wage_types": ["daily"], "pay_day": 7}, format="json"
    )
    assert res.status_code == 201, res.json()
    group = res.json()
    assert group["employment_count"] == 1 and group["wage_types"] == ["daily"]
    res = owner_client.post(
        "/api/v1/org/pay-groups", {"name": "Site A", "site_ids": [str(site.id)]}, format="json"
    )
    assert res.status_code == 201
    site_group = res.json()
    listing = owner_client.get("/api/v1/org/pay-groups").json()
    assert [g["employment_count"] for g in listing["results"]] == [1, 1]

    run_daily = create_run(owner_client, pay_group_id=group["id"])
    assert run_daily.status_code == 201, run_daily.json()
    assert run_daily.json()["pay_group"] == {"id": group["id"], "name": "Jyala"}
    assert set(
        Payslip.objects.filter(run_id=run_daily.json()["id"]).values_list("employment_id", flat=True)
    ) == {daily.id}
    run_rest = create_run(owner_client)
    assert run_rest.status_code == 201
    assert run_rest.json()["pay_group"] is None
    assert set(
        Payslip.objects.filter(run_id=run_rest.json()["id"]).values_list("employment_id", flat=True)
    ) == {monthly.id}
    dup = create_run(owner_client, pay_group_id=group["id"])
    assert dup.status_code == 400 and dup.json()["error"]["code"] == "duplicate"
    assert create_run(owner_client).json()["error"]["code"] == "duplicate"

    # Criteria change after a run exists: the employment is never paid twice in one month.
    owner_client.patch(f"/api/v1/org/pay-groups/{site_group['id']}", {"is_active": False}, format="json")
    owner_client.patch(f"/api/v1/org/pay-groups/{group['id']}", {"wage_types": ["monthly"]}, format="json")
    owner_client.post(f"/api/v1/org/payroll-runs/{run_daily.json()['id']}/recalculate")
    owner_client.post(f"/api/v1/org/payroll-runs/{run_rest.json()['id']}/recalculate")
    per_emp = {}
    for slip in Payslip.objects.filter(run__organization=org):
        per_emp[slip.employment_id] = per_emp.get(slip.employment_id, 0) + 1
    assert all(n == 1 for n in per_emp.values())
    assert at_site.id not in per_emp or per_emp[at_site.id] == 1
    assert PayrollRun.objects.filter(organization=org, bs_year=2083, bs_month=4).count() == 2


@pytest.mark.django_db
def test_pay_group_validation_and_delete_protection(owner_client, org, make_member):
    other_site = f.SiteFactory()
    res = owner_client.post(
        "/api/v1/org/pay-groups", {"name": "X", "site_ids": [str(other_site.id)]}, format="json"
    )
    assert res.status_code == 400 and "site_ids" in res.json()["error"]["fields"]
    res = owner_client.post("/api/v1/org/pay-groups", {"name": "X", "wage_types": ["weekly"]}, format="json")
    assert res.status_code == 400
    ok = owner_client.post(
        "/api/v1/org/pay-groups", {"name": "Hourly", "wage_types": ["hourly"]}, format="json"
    )
    assert ok.status_code == 201
    dup = owner_client.post("/api/v1/org/pay-groups", {"name": "hourly"}, format="json")
    assert dup.status_code == 400
    gid = ok.json()["id"]
    assert create_run(owner_client, pay_group_id=gid).status_code == 201
    res = owner_client.delete(f"/api/v1/org/pay-groups/{gid}")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"
    _, sup = make_member("supervisor")
    assert sup.get("/api/v1/org/pay-groups").status_code == 403
    # another org's group cannot be used
    foreign = PayGroup.objects.create(organization=f.OrganizationFactory(), name="Theirs")
    res = create_run(owner_client, pay_group_id=str(foreign.id), bs_month=5)
    assert res.status_code == 400
    empty = owner_client.post("/api/v1/org/pay-groups", {"name": "Tmp"}, format="json").json()
    assert owner_client.delete(f"/api/v1/org/pay-groups/{empty['id']}").status_code == 204
