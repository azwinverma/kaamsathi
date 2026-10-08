"""Timesheets (CONTRACT-EXTENSIONS §4): generation, approval flow, over-cap and the payroll OT hook.

Payroll month: Shrawan 2083 = 2026-07-17 (Fri) .. 2026-08-16 (Sun), 31 days; Saturdays are weekly off.
Timesheet week used below: Sun 2026-07-19 .. Sat 2026-07-25.
"""

import datetime as dt
from decimal import Decimal as D

import pytest
from django.utils import timezone

from apps.payroll import services as payroll
from apps.payroll.models import Payslip
from apps.timesheets import services
from apps.timesheets.models import Timesheet, TimesheetPolicy
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

WEEK = dt.date(2026, 7, 19)
URL = "/api/v1/org/timesheets"


def aware(day, hh, mm=0):
    return timezone.make_aware(dt.datetime.combine(day, dt.time(hh, mm)))


def seed_week(emp):
    f.AttendanceFactory(employment=emp, date=WEEK, status="present", overtime_minutes=60)
    f.AttendanceFactory(employment=emp, date=WEEK + dt.timedelta(days=1), status="half_day")
    f.AttendanceFactory(
        employment=emp,
        date=WEEK + dt.timedelta(days=2),
        status="present",
        check_in_at=aware(WEEK + dt.timedelta(days=2), 9),
        check_out_at=aware(WEEK + dt.timedelta(days=2), 13),
    )
    f.AttendanceFactory(employment=emp, date=WEEK + dt.timedelta(days=3), status="absent")
    f.AttendanceFactory(employment=emp, date=WEEK + dt.timedelta(days=4), status="leave")
    # day 5 (Fri): nothing recorded; day 6 (Sat): weekly off


def test_generation_math(org):
    emp = f.EmploymentFactory(organization=org)
    seed_week(emp)
    assert services.generate(org, WEEK) == {"created": 1, "refreshed": 0, "skipped": 0}
    ts = Timesheet.objects.get(employment=emp, week_start=WEEK)
    statuses = [d["status"] for d in ts.days]
    assert statuses == ["present", "half_day", "present", "absent", "leave", "not_marked", "weekly_off"]
    assert [d["regular_minutes"] for d in ts.days] == [480, 240, 240, 0, 0, 0, 0]
    assert [d["overtime_minutes"] for d in ts.days] == [60, 0, 0, 0, 0, 0, 0]
    assert ts.days[0]["worked_minutes"] == 540
    assert ts.regular_minutes == 960
    assert ts.overtime_minutes_claimed == 60
    assert ts.status == "draft"


def test_generation_respects_policy_and_employment_window(org):
    TimesheetPolicy.objects.create(organization=org, daily_regular_minutes=420)
    emp = f.EmploymentFactory(organization=org, start_date=WEEK + dt.timedelta(days=1))
    f.AttendanceFactory(employment=emp, date=WEEK + dt.timedelta(days=1), status="present")
    services.generate(org, WEEK)
    ts = Timesheet.objects.get(employment=emp)
    assert ts.days[0]["status"] == "not_employed"
    assert ts.regular_minutes == 420


def test_week_must_start_on_sunday(owner_client):
    res = owner_client.post(f"{URL}/generate", {"week_start": "2026-07-20"}, format="json")
    assert res.status_code == 400
    assert "week_start" in res.json()["error"]["fields"]


def test_generate_refreshes_drafts_but_never_approved(owner_client, org, owner):
    emp = f.EmploymentFactory(organization=org)
    seed_week(emp)
    owner_client.post(f"{URL}/generate", {"week_start": WEEK.isoformat()}, format="json")
    ts = Timesheet.objects.get(employment=emp)
    services.approve(ts, owner)
    # more OT recorded after approval must not change the approved sheet
    a = emp.attendance.get(date=WEEK)
    a.overtime_minutes = 600
    a.save()
    res = owner_client.post(f"{URL}/generate", {"week_start": WEEK.isoformat()}, format="json")
    assert res.json() == {"week_start": "2026-07-19", "created": 0, "refreshed": 0, "skipped": 1}
    ts.refresh_from_db()
    assert ts.overtime_minutes_claimed == 60 and ts.status == "approved"


def test_supervisor_generates_and_submits_only_own_sites(org, make_member):
    site_a, site_b = f.SiteFactory(organization=org), f.SiteFactory(organization=org)
    emp_a = f.EmploymentFactory(organization=org, site=site_a)
    emp_b = f.EmploymentFactory(organization=org, site=site_b)
    _, sup = make_member("supervisor", sites=[site_a])
    res = sup.post(f"{URL}/generate", {"week_start": WEEK.isoformat()}, format="json")
    assert res.status_code == 200 and res.json()["created"] == 1
    assert Timesheet.objects.filter(employment=emp_a).exists()
    assert not Timesheet.objects.filter(employment=emp_b).exists()

    services.generate(org, WEEK)  # manager-side generation covers site B too
    ts_a = Timesheet.objects.get(employment=emp_a)
    ts_b = Timesheet.objects.get(employment=emp_b)
    listing = sup.get(URL, {"week_start": WEEK.isoformat()}).json()
    assert [r["id"] for r in listing["results"]] == [str(ts_a.id)]

    assert sup.post(f"{URL}/{ts_b.id}/submit").status_code == 404
    res = sup.post(f"{URL}/{ts_a.id}/submit")
    assert res.status_code == 200 and res.json()["status"] == "submitted"
    assert res.json()["submitted_by"] is not None
    # supervisors cannot approve or reject
    assert sup.post(f"{URL}/{ts_a.id}/approve", {}, format="json").status_code == 403
    assert sup.post(f"{URL}/{ts_a.id}/reject", {"note": "x"}, format="json").status_code == 403
    assert sup.post(f"{URL}/bulk-approve", {"ids": [str(ts_a.id)]}, format="json").status_code == 403
    assert (
        sup.patch("/api/v1/org/timesheet-policy", {"ot_requires_approval": True}, format="json").status_code
        == 403
    )


def test_approve_reject_and_bulk(org, make_member):
    _, hr = make_member("hr")
    e1, e2, e3 = (f.EmploymentFactory(organization=org) for _ in range(3))
    for e in (e1, e2, e3):
        f.AttendanceFactory(employment=e, date=WEEK, status="present", overtime_minutes=180)
    services.generate(org, WEEK)
    t1, t2, t3 = (Timesheet.objects.get(employment=e) for e in (e1, e2, e3))

    res = hr.post(f"{URL}/{t1.id}/approve", {"overtime_minutes_approved": 200}, format="json")
    assert res.status_code == 400  # above claimed
    res = hr.post(f"{URL}/{t1.id}/approve", {"overtime_minutes_approved": 120}, format="json")
    assert res.status_code == 200
    assert res.json()["status"] == "approved" and res.json()["overtime_minutes_approved"] == 120

    assert hr.post(f"{URL}/{t2.id}/reject", {}, format="json").status_code == 400  # note required
    res = hr.post(f"{URL}/{t2.id}/reject", {"note": "OT not pre-approved"}, format="json")
    assert res.json()["status"] == "rejected" and res.json()["note"] == "OT not pre-approved"

    res = hr.post(f"{URL}/bulk-approve", {"ids": [str(t1.id), str(t2.id), str(t3.id)]}, format="json")
    body = res.json()
    assert body["approved"] == [str(t3.id)]
    assert {s["id"]: s["code"] for s in body["skipped"]} == {
        str(t1.id): "invalid_state",
        str(t2.id): "invalid_state",
    }
    t3.refresh_from_db()
    assert t3.overtime_minutes_approved == 180  # default = claimed

    # a rejected sheet goes back to draft on regenerate
    services.generate(org, WEEK)
    t2.refresh_from_db()
    assert t2.status == "draft" and t2.note == "OT not pre-approved"


def test_over_cap_flag(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    for i in range(6):  # 6 × 250 = 1500 min > 1440 cap
        f.AttendanceFactory(
            employment=emp, date=WEEK + dt.timedelta(days=i), status="present", overtime_minutes=250
        )
    owner_client.post(f"{URL}/generate", {"week_start": WEEK.isoformat()}, format="json")
    row = owner_client.get(URL, {"week_start": WEEK.isoformat()}).json()["results"][0]
    assert row["overtime_minutes_claimed"] == 1500
    assert row["over_cap"] is True and "24" in row["warning"]
    owner_client.patch("/api/v1/org/timesheet-policy", {"weekly_ot_cap_minutes": 1500}, format="json")
    row = owner_client.get(URL, {"week_start": WEEK.isoformat()}).json()["results"][0]
    assert row["over_cap"] is False and row["warning"] is None


def test_policy_get_and_patch(owner_client, org):
    assert owner_client.get("/api/v1/org/timesheet-policy").json() == {
        "ot_requires_approval": False,
        "weekly_ot_cap_minutes": 1440,
        "daily_regular_minutes": 480,
    }
    res = owner_client.patch("/api/v1/org/timesheet-policy", {"ot_requires_approval": True}, format="json")
    assert res.status_code == 200 and res.json()["ot_requires_approval"] is True
    assert (
        owner_client.patch(
            "/api/v1/org/timesheet-policy", {"daily_regular_minutes": 5}, format="json"
        ).status_code
        == 400
    )


def test_worker_sees_own_timesheets(org):
    user = f.UserFactory()
    worker = f.WorkerFactory(user=user)
    emp = f.EmploymentFactory(organization=org, worker=worker)
    f.EmploymentFactory(organization=org)  # someone else
    f.AttendanceFactory(employment=emp, date=WEEK, status="present")
    services.generate(org, WEEK)
    body = auth_client(user).get("/api/v1/me/timesheets").json()
    assert body["count"] == 1
    assert body["results"][0]["organization"]["id"] == str(org.id)
    assert body["results"][0]["regular_minutes"] == 480


# --------------------------------------------------------------------------- payroll hook
def _payroll_emp(org):
    emp = f.EmploymentFactory(organization=org)  # basic 12170 + DA 7380 = 19550
    f.AttendanceFactory(employment=emp, date=dt.date(2026, 7, 20), status="present", overtime_minutes=300)
    return emp


def _slip(org, emp):
    payroll.create_run(org, 2083, 4)
    return Payslip.objects.get(employment=emp)


def test_payroll_default_uses_attendance_ot(org):
    emp = _payroll_emp(org)
    # Approved timesheets are ignored while the policy does not require approval.
    Timesheet.objects.create(
        employment=emp,
        week_start=WEEK,
        status="approved",
        overtime_minutes_claimed=300,
        overtime_minutes_approved=60,
    )
    slip = _slip(org, emp)
    # 300 min = 5 h × (19550 / (31 × 8)) × 1.5 = 146625 / 248 = 591.2298…
    assert slip.overtime_hours == D("5.00")
    assert slip.overtime_pay == D("591.23")


def test_payroll_requires_approval_without_timesheets_pays_no_ot(org):
    TimesheetPolicy.objects.create(organization=org, ot_requires_approval=True)
    emp = _payroll_emp(org)
    Timesheet.objects.create(
        employment=emp, week_start=WEEK, status="submitted", overtime_minutes_claimed=300
    )
    slip = _slip(org, emp)
    assert slip.overtime_hours == D("0.00") and slip.overtime_pay == D("0.00")


def test_payroll_uses_approved_ot_prorated(org):
    TimesheetPolicy.objects.create(organization=org, ot_requires_approval=True)
    emp = _payroll_emp(org)
    # fully inside the month: 120 min
    Timesheet.objects.create(
        employment=emp,
        week_start=WEEK,
        status="approved",
        overtime_minutes_claimed=300,
        overtime_minutes_approved=120,
    )
    # week 2026-07-12..18 straddles the start: 2 of 7 days (17th, 18th) are in Shrawan → 140 × 2/7 = 40 min
    Timesheet.objects.create(
        employment=emp,
        week_start=dt.date(2026, 7, 12),
        status="approved",
        overtime_minutes_claimed=140,
        overtime_minutes_approved=140,
    )
    # week 2026-08-16..22: 1 of 7 days in Shrawan → 70 × 1/7 = 10 min
    Timesheet.objects.create(
        employment=emp,
        week_start=dt.date(2026, 8, 16),
        status="approved",
        overtime_minutes_claimed=70,
        overtime_minutes_approved=70,
    )
    assert services.approved_ot_minutes(emp, dt.date(2026, 7, 17), dt.date(2026, 8, 16)) == 170
    slip = _slip(org, emp)
    # 170 min = 2.8333 h; pay = 170/60 × 1.5 × 19550/248 = 83087.5 / 248 = 335.0302…
    assert slip.overtime_hours == D("2.83")
    assert slip.overtime_pay == D("335.03")
