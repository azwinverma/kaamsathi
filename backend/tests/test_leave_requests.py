"""Workers request leave (बिदा) themselves: ``/me/leaves`` (list · create · cancel), reviewer
notifications on a new request, worker notifications on the decision, and the org list showing
who asked for it."""

import datetime as dt

import pytest

from apps.audit.models import AuditLog
from apps.core.bs import today_ad
from apps.notifications.models import Notification, NotificationDelivery
from apps.payroll.models import PayrollRun
from apps.workforce.models import Attendance, LeaveRequest
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/leaves"


@pytest.fixture
def setup(org, site):
    user = f.UserFactory()
    w = f.WorkerFactory(user=user, phone=user.phone)
    emp = f.EmploymentFactory(
        organization=org, worker=w, site=site, start_date=today_ad() - dt.timedelta(days=60)
    )
    return emp, user


def ahead(days):
    return (today_ad() + dt.timedelta(days=days)).isoformat()


def request_leave(client, emp, start=5, end=6, **extra):
    body = {
        "employment_id": str(emp.id),
        "leave_type": "sick",
        "from_date": ahead(start),
        "to_date": ahead(end),
        "reason": "Fever",
        **extra,
    }
    return client.post(URL, body, format="json")


def test_worker_requests_leave_and_reviewers_are_notified(setup, make_member, site, owner, owner_client):
    emp, user = setup
    sup_user, _ = make_member("supervisor", sites=[site])
    other_sup, _ = make_member("supervisor", sites=[f.SiteFactory(organization=emp.organization)])
    hr_user, _ = make_member("hr")
    r = request_leave(auth_client(user), emp, start=5, end=7)
    assert r.status_code == 201, r.json()
    body = r.json()
    assert body["status"] == "pending" and body["source"] == "worker" and body["days"] == 3
    assert body["from_date_bs"] and body["to_date_bs"] and body["leave_type_label"]
    assert body["organization"]["id"] == str(emp.organization_id)
    assert body["requested_by"]["id"] == str(user.id)
    for reviewer in (sup_user, owner, hr_user):
        n = Notification.objects.get(user=reviewer, kind="leave_request")
        assert n.title_ne and n.body_ne and n.link == "/app/leave"
    assert not Notification.objects.filter(user=other_sup, kind="leave_request").exists()
    assert AuditLog.objects.filter(action="leave.request").exists()
    # the org list now carries worker-requested items, flagged as such
    row = owner_client.get("/api/v1/org/leaves", {"status": "pending"}).json()["results"][0]
    assert row["source"] == "worker" and row["requested_by"]["full_name"] == user.full_name


def test_list_is_own_newest_first_and_filterable(setup):
    emp, user = setup
    f.LeaveFactory(employment=emp, status="approved")
    f.LeaveFactory()  # someone else's
    wc = auth_client(user)
    request_leave(wc, emp)
    data = wc.get(URL).json()
    assert data["count"] == 2
    assert data["results"][0]["source"] == "worker" and data["results"][0]["status"] == "pending"
    assert wc.get(URL, {"status": "approved"}).json()["count"] == 1
    assert auth_client(f.UserFactory()).get(URL).status_code == 404  # no worker profile


def test_validation(setup, org):
    emp, user = setup
    wc = auth_client(user)
    r = request_leave(wc, emp, start=6, end=5)
    assert r.status_code == 400 and "to_date" in r.json()["error"]["fields"]
    r = request_leave(wc, emp, leave_type="holiday")
    assert r.status_code == 400 and "leave_type" in r.json()["error"]["fields"]
    r = request_leave(wc, f.EmploymentFactory())
    assert r.status_code == 400 and "employment_id" in r.json()["error"]["fields"]
    r = request_leave(wc, emp, start=1, end=200)
    assert r.status_code == 400 and "to_date" in r.json()["error"]["fields"]
    # before the job started
    r = request_leave(wc, emp, start=-90, end=-89)
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"
    # an ended employment can't take new leave
    ended = f.EmploymentFactory(organization=org, worker=emp.worker, status="ended", end_date=today_ad())
    r = request_leave(wc, ended)
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"


def test_overlap_with_pending_or_approved_is_refused(setup):
    emp, user = setup
    wc = auth_client(user)
    assert request_leave(wc, emp, start=5, end=7).status_code == 201
    r = request_leave(wc, emp, start=7, end=9)
    assert r.status_code == 400 and r.json()["error"]["code"] == "duplicate"
    LeaveRequest.objects.filter(employment=emp).update(status="rejected")
    assert request_leave(wc, emp, start=7, end=9).status_code == 201
    LeaveRequest.objects.filter(employment=emp, status="pending").update(status="approved")
    assert request_leave(wc, emp, start=9, end=9).json()["error"]["code"] == "duplicate"
    assert request_leave(wc, emp, start=10, end=10).status_code == 201


def test_locked_payroll_period_is_refused(setup, org):
    emp, user = setup
    start = today_ad() + dt.timedelta(days=3)
    PayrollRun.objects.create(
        organization=org,
        bs_year=2090,
        bs_month=1,
        period_start=start,
        period_end=start + dt.timedelta(days=10),
        days_in_month=31,
        status="approved",
    )
    r = request_leave(auth_client(user), emp, start=1, end=4)
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"


def test_cancel_own_pending_only(setup):
    emp, user = setup
    wc = auth_client(user)
    lid = request_leave(wc, emp).json()["id"]
    stranger = f.UserFactory()
    f.WorkerFactory(user=stranger, phone=stranger.phone)
    assert auth_client(stranger).post(f"{URL}/{lid}/cancel").status_code == 404
    r = wc.post(f"{URL}/{lid}/cancel")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert r.json()["status_label"]
    assert wc.post(f"{URL}/{lid}/cancel").json()["error"]["code"] == "invalid_state"
    assert AuditLog.objects.filter(action="leave.cancel").exists()
    approved = f.LeaveFactory(employment=emp, status="approved")
    assert wc.post(f"{URL}/{approved.id}/cancel").json()["error"]["code"] == "invalid_state"


def test_supervisor_approves_writes_attendance_and_notifies_worker(setup, make_member, site):
    emp, user = setup
    _, sup = make_member("supervisor", sites=[site])
    lid = request_leave(auth_client(user), emp, start=2, end=3).json()["id"]
    r = sup.post(f"/api/v1/org/leaves/{lid}/approve")
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert Attendance.objects.filter(employment=emp, status="leave").count() == 2
    n = Notification.objects.get(user=user, kind="leave_decided")
    assert "approved" in n.title and n.title_ne and n.link == "/me/leaves"
    assert NotificationDelivery.objects.filter(notification=n, channel="sms").exists()


def test_reject_notifies_worker_and_cancelled_cannot_be_decided(setup, owner_client):
    emp, user = setup
    wc = auth_client(user)
    lid = request_leave(wc, emp).json()["id"]
    r = owner_client.post(f"/api/v1/org/leaves/{lid}/reject", {"note": "Busy week"}, format="json")
    assert r.json()["status"] == "rejected"
    n = Notification.objects.get(user=user, kind="leave_decided")
    assert "Busy week" in n.body and "Busy week" in n.body_ne
    lid = request_leave(wc, emp).json()["id"]
    wc.post(f"{URL}/{lid}/cancel")
    assert owner_client.post(f"/api/v1/org/leaves/{lid}/approve").json()["error"]["code"] == "invalid_state"


def test_employer_entered_leave_records_who_entered_it(setup, owner, owner_client):
    emp, user = setup
    r = owner_client.post(
        "/api/v1/org/leaves",
        {"employment_id": str(emp.id), "leave_type": "home", "from_date": ahead(3), "to_date": ahead(3)},
        format="json",
    )
    assert r.json()["source"] == "employer" and r.json()["requested_by"]["id"] == str(owner.id)
    owner_client.post(f"/api/v1/org/leaves/{r.json()['id']}/approve")
    # employer-entered: the worker still hears about it in the inbox, without an SMS
    n = Notification.objects.get(user=user, kind="leave_decided")
    assert not NotificationDelivery.objects.filter(notification=n, channel="sms").exists()
