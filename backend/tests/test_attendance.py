"""Hajiri bulk upsert, supervisor restriction, payroll lock, leave approval, worker QR check-in geofence."""

import datetime as dt
import uuid
from decimal import Decimal as D

import pytest

from apps.payroll.models import PayrollRun
from apps.workforce.models import Attendance
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

DAY = "2026-08-03"


def rec(emp, status="present", date=DAY, cu=None, **kw):
    return {
        "client_uuid": str(cu or uuid.uuid4()),
        "employment_id": str(emp.id),
        "date": date,
        "status": status,
        "method": "supervisor",
        **kw,
    }


def bulk(client, *records):
    res = client.post("/api/v1/org/attendance/bulk", {"records": list(records)}, format="json")
    assert res.status_code == 200, res.json()
    return res.json()


def test_bulk_saves_and_is_idempotent(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    cu = uuid.uuid4()
    body = bulk(owner_client, rec(emp, cu=cu, overtime_minutes=60))
    assert body == {"saved": [str(cu)], "errors": []}
    # replay the same client_uuid with an updated status → still one row, updated
    body = bulk(owner_client, rec(emp, "half_day", cu=cu))
    assert body["saved"] == [str(cu)]
    assert Attendance.objects.count() == 1
    a = Attendance.objects.get()
    assert a.status == "half_day" and a.client_uuid == cu


def test_bulk_upserts_on_employment_and_date(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    bulk(owner_client, rec(emp, "present"))
    bulk(owner_client, rec(emp, "absent"))  # different client_uuid, same (employment, date)
    assert Attendance.objects.count() == 1
    assert Attendance.objects.get().status == "absent"


def test_bulk_client_uuid_reused_for_other_day_is_duplicate(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    cu = uuid.uuid4()
    bulk(owner_client, rec(emp, cu=cu))
    body = bulk(owner_client, rec(emp, cu=cu, date="2026-08-04"))
    assert body["saved"] == [] and body["errors"][0]["code"] == "duplicate"


def test_bulk_partial_errors(owner_client, org):
    emp = f.EmploymentFactory(organization=org, start_date=dt.date(2026, 8, 1))
    good = rec(emp)
    bad_status = rec(emp, "sleeping", date="2026-08-05")
    before_join = rec(emp, date="2026-07-20")
    other_org = rec(f.EmploymentFactory())
    body = bulk(owner_client, good, bad_status, before_join, other_org)
    assert body["saved"] == [good["client_uuid"]]
    codes = {e["client_uuid"]: e["code"] for e in body["errors"]}
    assert codes == {
        bad_status["client_uuid"]: "validation_error",
        before_join["client_uuid"]: "invalid_state",
        other_org["client_uuid"]: "not_found",
    }


def test_bulk_requires_list(owner_client):
    res = owner_client.post("/api/v1/org/attendance/bulk", {"records": "x"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "validation_error"


def test_bulk_supervisor_restricted_to_own_sites(org, make_member):
    site_a, site_b = f.SiteFactory(organization=org), f.SiteFactory(organization=org)
    emp_a = f.EmploymentFactory(organization=org, site=site_a)
    emp_b = f.EmploymentFactory(organization=org, site=site_b)
    _, sup = make_member("supervisor", sites=[site_a])
    ra, rb = rec(emp_a), rec(emp_b)
    body = bulk(sup, ra, rb)
    assert body["saved"] == [ra["client_uuid"]]
    assert body["errors"] == [
        {
            "client_uuid": rb["client_uuid"],
            "code": "permission_denied",
            "message": body["errors"][0]["message"],
        }
    ]
    assert not Attendance.objects.filter(employment=emp_b).exists()


def lock_shrawan(org, status="approved"):
    return PayrollRun.objects.create(
        organization=org,
        bs_year=2083,
        bs_month=4,
        period_start=dt.date(2026, 7, 17),
        period_end=dt.date(2026, 8, 16),
        days_in_month=31,
        status=status,
    )


@pytest.mark.parametrize("status,locked", [("draft", False), ("approved", True), ("paid", True)])
def test_bulk_locked_after_payroll_approved(owner_client, org, status, locked):
    emp = f.EmploymentFactory(organization=org)
    lock_shrawan(org, status)
    r = rec(emp)
    body = bulk(owner_client, r, rec(emp, date="2026-08-20"))  # Aug 20 is next month: never locked
    if locked:
        assert body["errors"][0] == {
            "client_uuid": r["client_uuid"],
            "code": "invalid_state",
            "message": body["errors"][0]["message"],
        }
        assert len(body["saved"]) == 1
    else:
        assert len(body["saved"]) == 2


def test_approve_via_api_locks_attendance(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    run = owner_client.post("/api/v1/org/payroll-runs", {"bs_year": 2083, "bs_month": 4}, format="json")
    run = run.json()
    owner_client.post(f"/api/v1/org/payroll-runs/{run['id']}/approve")
    assert bulk(owner_client, rec(emp))["errors"][0]["code"] == "invalid_state"


def test_leave_approval_writes_leave_rows_and_respects_lock(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    res = owner_client.post(
        "/api/v1/org/leaves",
        {
            "employment_id": str(emp.id),
            "leave_type": "home",
            "from_date": "2026-08-03",
            "to_date": "2026-08-05",
        },
        format="json",
    )
    leave_id = res.json()["id"]
    assert res.json()["days"] == 3
    res = owner_client.post(f"/api/v1/org/leaves/{leave_id}/approve")
    assert res.status_code == 200 and res.json()["status"] == "approved"
    assert Attendance.objects.filter(employment=emp, status="leave").count() == 3
    again = owner_client.post(f"/api/v1/org/leaves/{leave_id}/approve")
    assert again.json()["error"]["code"] == "invalid_state"

    lock_shrawan(org)
    leave = f.LeaveFactory(employment=emp, from_date=dt.date(2026, 8, 10), to_date=dt.date(2026, 8, 10))
    locked = owner_client.post(f"/api/v1/org/leaves/{leave.id}/approve")
    assert locked.json()["error"]["code"] == "invalid_state"


def test_attendance_day_and_register(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    f.EmploymentFactory(organization=org)  # not marked
    bulk(owner_client, rec(emp, overtime_minutes=90))
    day = owner_client.get("/api/v1/org/attendance/day", {"date": DAY}).json()
    assert day["date_bs"] == "2083-04-18"
    assert day["summary"] == {"present": 1, "absent": 0, "half_day": 0, "leave": 0, "not_marked": 1}
    reg = owner_client.get("/api/v1/org/attendance/register", {"bs_year": 2083, "bs_month": 4}).json()
    assert reg["month_name_en"] == "Shrawan" and len(reg["days"]) == 31
    row = next(r for r in reg["rows"] if r["employment_id"] == str(emp.id))
    assert row["cells"][DAY] == "P"
    assert row["cells"]["2026-08-01"] == "WO"  # Saturday, no record
    assert row["totals"]["present"] == 1 and row["totals"]["overtime_hours"] == 1.5


# --- worker QR check-in -------------------------------------------------------------------------


@pytest.fixture
def worker_setup(org):
    site = f.SiteFactory(organization=org, lat=D("27.715000"), lng=D("85.312000"), geofence_radius_m=200)
    user = f.UserFactory()
    worker = f.WorkerFactory(user=user, phone=user.phone)
    emp = f.EmploymentFactory(organization=org, worker=worker, site=site, start_date=dt.date(2026, 1, 1))
    return site, auth_client(user), emp


def check(client, site, lat, lng, kind="check-in", **kw):
    return client.post(
        f"/api/v1/me/attendance/{kind}",
        {"site_qr_token": str(site.qr_token), "lat": lat, "lng": lng, **kw},
        format="json",
    )


def test_check_in_inside_geofence(worker_setup):
    site, client, emp = worker_setup
    cu = str(uuid.uuid4())
    res = check(client, site, 27.7151, 85.3121, client_uuid=cu)  # ~15 m away
    assert res.status_code == 200, res.json()
    assert res.json()["status"] == "present" and res.json()["method"] == "qr"
    a = Attendance.objects.get(employment=emp)
    assert a.check_in_at is not None and str(a.client_uuid) == cu
    # second check-in is idempotent
    assert check(client, site, 27.7151, 85.3121).status_code == 200
    assert Attendance.objects.filter(employment=emp).count() == 1
    res = check(client, site, 27.7151, 85.3121, kind="check-out")
    assert res.status_code == 200 and res.json()["check_out_at"]


def test_check_in_outside_geofence(worker_setup):
    site, client, emp = worker_setup
    res = check(client, site, 27.7200, 85.3120)  # ~555 m north
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "outside_geofence"
    assert not Attendance.objects.filter(employment=emp).exists()


def test_check_out_requires_check_in(worker_setup):
    site, client, _ = worker_setup
    res = check(client, site, 27.715, 85.312, kind="check-out")
    assert res.json()["error"]["code"] == "invalid_state"


def test_check_in_unknown_site_or_not_employed(worker_setup, org):
    site, client, _ = worker_setup
    res = client.post(
        "/api/v1/me/attendance/check-in",
        {"site_qr_token": str(uuid.uuid4()), "lat": 27.715, "lng": 85.312},
        format="json",
    )
    assert res.status_code == 404
    other_site = f.SiteFactory()
    assert check(client, other_site, 27.715, 85.312).status_code == 403


def test_geofence_helper():
    from apps.core.geo import haversine_m, within_geofence

    assert 550 < haversine_m(27.715, 85.312, 27.72, 85.312) < 560
    assert within_geofence(27.715, 85.312, 200, 27.716, 85.312)
    assert not within_geofence(27.715, 85.312, 100, 27.716, 85.312)
    assert within_geofence(None, None, 200, 1, 1)  # no coordinates configured
