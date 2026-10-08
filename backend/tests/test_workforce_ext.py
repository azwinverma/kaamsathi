"""Roster conflict warnings (O005), shift-change notifications (O007), attendance correction
requests (P008)."""

import datetime as dt

import pytest

from apps.audit.models import AuditLog
from apps.core.bs import js_weekday, today_ad
from apps.notifications.models import Notification
from apps.scheduling.models import RosterEntry
from apps.timesheets.models import AttendanceCorrection
from apps.workforce.models import Attendance
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def workday(offset=1):
    """A non-Saturday date ``offset`` days ahead (the factory org's weekly off is Saturday)."""
    from apps.workforce.models import Holiday

    d = today_ad() + dt.timedelta(days=offset)
    while js_weekday(d) == 6 or Holiday.objects.filter(date=d).exists():
        d += dt.timedelta(days=1)
    return d


@pytest.fixture
def setup(org, site):
    shift = f.ShiftFactory(organization=org)
    user = f.UserFactory()
    w = f.WorkerFactory(user=user, phone=user.phone)
    emp = f.EmploymentFactory(
        organization=org, worker=w, site=site, start_date=today_ad() - dt.timedelta(days=60)
    )
    return shift, emp, user


def put(client, emp, day, shift, is_off=False):
    return client.put(
        "/api/v1/org/roster",
        {
            "entries": [
                {
                    "employment_id": str(emp.id),
                    "date": day.isoformat(),
                    "shift_id": str(shift.id),
                    "is_off": is_off,
                }
            ]
        },
        format="json",
    )


# --------------------------------------------------------------------------- O005
def test_roster_warns_on_leave_and_holiday(owner_client, setup):
    shift, emp, _ = setup
    day = workday(2)
    f.LeaveFactory(employment=emp, from_date=day, to_date=day, status="approved")
    r = put(owner_client, emp, day, shift)
    assert r.status_code == 200, r.json()
    codes = {w["code"] for w in r.json()["warnings"]}
    assert codes == {"on_leave"}
    assert RosterEntry.objects.filter(employment=emp, date=day).exists()  # warned, not blocked

    hol = workday((day - today_ad()).days + 1)  # strictly after the leave day
    f.HolidayFactory(date=hol)
    r = put(owner_client, emp, hol, shift)
    assert [w["code"] for w in r.json()["warnings"]] == ["holiday"]

    grid = owner_client.get(
        "/api/v1/org/roster", {"week_start": (day - dt.timedelta(days=js_weekday(day))).isoformat()}
    )
    row = next(x for x in grid.json()["rows"] if x["employment_id"] == str(emp.id))
    assert row["warnings"].get(day.isoformat()) == ["on_leave"]
    assert "on_leave" in grid.json()["warning_labels"]


def test_roster_conflict_elsewhere_is_anonymous(owner_client, setup):
    shift, emp, _ = setup
    day = workday(1)
    other = f.EmploymentFactory(worker=emp.worker, start_date=today_ad() - dt.timedelta(days=10))
    RosterEntry.objects.create(employment=other, date=day, shift=None, is_off=False)
    r = put(owner_client, emp, day, shift)
    w = r.json()["warnings"]
    assert [x["code"] for x in w] == ["conflict_elsewhere"]
    assert other.organization.name not in str(r.json())

    yesterday = _past_workday()
    Attendance.objects.create(employment=other, date=yesterday, status="present")
    r = put(owner_client, emp, yesterday, shift)
    assert "conflict_elsewhere" in [x["code"] for x in r.json()["warnings"]]


def test_roster_no_warning_when_off(owner_client, setup):
    shift, emp, _ = setup
    day = workday(2)
    f.LeaveFactory(employment=emp, from_date=day, to_date=day, status="approved")
    r = put(owner_client, emp, day, shift, is_off=True)
    assert r.json()["warnings"] == []


# --------------------------------------------------------------------------- O007
def test_roster_change_notifies_worker_once_per_batch(owner_client, setup):
    shift, emp, user = setup
    d1 = workday(1)
    d2 = workday((d1 - today_ad()).days + 1)
    r = owner_client.put(
        "/api/v1/org/roster",
        {
            "entries": [
                {"employment_id": str(emp.id), "date": d.isoformat(), "shift_id": str(shift.id)}
                for d in (d1, d2)
            ]
        },
        format="json",
    )
    assert r.json()["notified_workers"] == 1
    n = Notification.objects.filter(user=user, kind="roster_changed")
    expected = sorted(d.isoformat() for d in (d1, d2) if d <= today_ad() + dt.timedelta(days=7))
    assert n.count() == 1 and sorted(n.get().data["dates"]) == expected
    # same values again → no change → no notification
    r = put(owner_client, emp, d1, shift)
    assert r.json()["notified_workers"] == 0
    # beyond 7 days → no notification
    far = workday(12)
    assert put(owner_client, emp, far, shift).json()["notified_workers"] == 0
    # clearing a cell is a change
    r = owner_client.put(
        "/api/v1/org/roster",
        {"entries": [{"employment_id": str(emp.id), "date": d1.isoformat()}]},
        format="json",
    )
    assert r.json()["cleared"] == 1 and r.json()["notified_workers"] == 1


# --------------------------------------------------------------------------- P008
def _past_workday():
    from apps.workforce.models import Holiday

    d = today_ad() - dt.timedelta(days=2)
    while js_weekday(d) == 6 or Holiday.objects.filter(date=d).exists():
        d -= dt.timedelta(days=1)
    return d


def test_correction_request_and_approval(setup, make_member, site):
    _, emp, user = setup
    day = _past_workday()
    Attendance.objects.create(employment=emp, date=day, status="absent")
    sup_user, sup = make_member("supervisor", sites=[site])
    wc = auth_client(user)
    r = wc.post(
        "/api/v1/me/attendance/corrections",
        {
            "employment_id": str(emp.id),
            "date": day.isoformat(),
            "requested_status": "present",
            "reason": "I was there",
        },
        format="json",
    )
    assert r.status_code == 201, r.json()
    cid = r.json()["id"]
    assert r.json()["current_status"] == "absent" and r.json()["status"] == "pending"
    # one pending per day
    r = wc.post(
        "/api/v1/me/attendance/corrections",
        {
            "employment_id": str(emp.id),
            "date": day.isoformat(),
            "requested_status": "half_day",
            "reason": "x",
        },
        format="json",
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "duplicate"
    assert Notification.objects.filter(user=sup_user, kind="attendance_correction").exists()
    assert sup.get("/api/v1/org/attendance-corrections", {"status": "pending"}).json()["count"] == 1
    r = sup.post(f"/api/v1/org/attendance-corrections/{cid}/approve", {"note": "Checked CCTV"}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert Attendance.objects.get(employment=emp, date=day).status == "present"
    assert Notification.objects.filter(user=user, kind="attendance_correction_decided").exists()
    assert AuditLog.objects.filter(action="attendance_correction.approved").exists()
    assert sup.post(f"/api/v1/org/attendance-corrections/{cid}/approve").status_code == 400
    assert wc.get("/api/v1/me/attendance/corrections").json()["results"][0]["status"] == "approved"


def test_correction_reject_and_scope(setup, make_member, owner_client):
    _, emp, user = setup
    day = _past_workday()
    c = AttendanceCorrection.objects.create(employment=emp, date=day, requested_status="present", reason="x")
    other_site = f.SiteFactory(organization=emp.organization)
    _, sup = make_member("supervisor", sites=[other_site])
    assert sup.get("/api/v1/org/attendance-corrections").json()["count"] == 0
    assert sup.post(f"/api/v1/org/attendance-corrections/{c.id}/reject", {"note": "no"}).status_code == 404
    assert (
        owner_client.post(f"/api/v1/org/attendance-corrections/{c.id}/reject", {}).status_code == 400
    )  # note needed
    r = owner_client.post(
        f"/api/v1/org/attendance-corrections/{c.id}/reject", {"note": "Not on roster"}, format="json"
    )
    assert r.json()["status"] == "rejected"
    other = f.MembershipFactory(role="owner")
    client = auth_client(other.user, other.organization)
    assert client.get(f"/api/v1/org/attendance-corrections/{c.id}").status_code == 404


def test_correction_validation(setup):
    _, emp, user = setup
    wc = auth_client(user)
    future = today_ad() + dt.timedelta(days=2)
    r = wc.post(
        "/api/v1/me/attendance/corrections",
        {
            "employment_id": str(emp.id),
            "date": future.isoformat(),
            "requested_status": "present",
            "reason": "x",
        },
        format="json",
    )
    assert r.status_code == 400
    stranger = f.EmploymentFactory()
    r = wc.post(
        "/api/v1/me/attendance/corrections",
        {
            "employment_id": str(stranger.id),
            "date": _past_workday().isoformat(),
            "requested_status": "present",
            "reason": "x",
        },
        format="json",
    )
    assert r.status_code == 400


def test_correction_respects_payroll_lock(setup, owner_client, monkeypatch):
    _, emp, user = setup
    day = _past_workday()
    c = AttendanceCorrection.objects.create(employment=emp, date=day, requested_status="present", reason="x")
    monkeypatch.setattr("apps.payroll.services.is_month_locked", lambda org, d: True)
    r = owner_client.post(f"/api/v1/org/attendance-corrections/{c.id}/approve", {}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"
    c.refresh_from_db()
    assert c.status == "pending"
    r = auth_client(user).post(
        "/api/v1/me/attendance/corrections",
        {
            "employment_id": str(emp.id),
            "date": (day - dt.timedelta(days=1)).isoformat(),
            "requested_status": "present",
            "reason": "x",
        },
        format="json",
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"
