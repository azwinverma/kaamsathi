"""Training provider verification (T002), sessions & attendance (T006), placement outcomes (T010)."""

import datetime as dt
from decimal import Decimal

import pytest

from apps.audit.models import AuditLog
from apps.core.bs import today_ad
from apps.training.models import Enrollment, SessionAttendance, TrainingSession
from apps.training.services import course_outcomes
from tests import factories as f
from tests.conftest import auth_client
from tests.test_training import course, provider

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------- T002
def test_provider_verification(staff_client):
    p = provider()
    assert (
        staff_client.get(f"/api/v1/ops/training/providers/{p.id}").json()["verification_status"]
        == "unverified"
    )
    r = staff_client.post(
        f"/api/v1/ops/training/providers/{p.id}/verify", {"status": "verified", "note": "Docs ok"}
    )
    assert r.status_code == 200 and r.json()["verification_status"] == "verified"
    assert r.json()["verified_by"] and r.json()["verification_status_label"]
    assert AuditLog.objects.filter(action="ops.training_provider.verify").exists()
    ids = [
        x["id"]
        for x in staff_client.get(
            "/api/v1/ops/training/providers", {"verification_status": "verified"}
        ).json()["results"]
    ]
    assert ids == [str(p.id)]
    # read-only through PATCH
    staff_client.patch(
        f"/api/v1/ops/training/providers/{p.id}", {"verification_status": "rejected"}, format="json"
    )
    p.refresh_from_db()
    assert p.verification_status == "verified"
    # rejection needs a note
    assert (
        staff_client.post(f"/api/v1/ops/training/providers/{p.id}/verify", {"status": "rejected"}).status_code
        == 400
    )


def test_ctevt_provider_needs_affiliation_no_to_verify(staff_client):
    p = provider()
    type(p).objects.filter(pk=p.pk).update(ctevt_affiliation_no=None)
    r = staff_client.post(f"/api/v1/ops/training/providers/{p.id}/verify", {"status": "verified"})
    assert r.status_code == 400 and "ctevt_affiliation_no" in r.json()["error"]["fields"]


def test_provider_verify_role():
    from apps.accounts.models import StaffProfile

    p = provider()
    user = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=user, roles=["finance_ops"])
    assert (
        auth_client(user)
        .post(f"/api/v1/ops/training/providers/{p.id}/verify", {"status": "verified"})
        .status_code
        == 403
    )


# --------------------------------------------------------------------------- T006
def test_sessions_attendance_and_completion_gate(staff_client):
    c = course(min_attendance_pct=75, starts_on=today_ad() - dt.timedelta(days=10))
    ws = [f.WorkerFactory() for _ in range(2)]
    ens = [Enrollment.objects.create(course=c, worker=w, status="enrolled") for w in ws]
    sessions = []
    for i in range(4):
        r = staff_client.post(
            f"/api/v1/ops/training/courses/{c.id}/sessions",
            {
                "date": (today_ad() - dt.timedelta(days=8 - i)).isoformat(),
                "start_time": "10:00",
                "end_time": "13:00",
            },
            format="json",
        )
        assert r.status_code == 201, r.json()
        sessions.append(r.json()["id"])
    bad = staff_client.post(
        f"/api/v1/ops/training/courses/{c.id}/sessions",
        {"date": today_ad().isoformat(), "start_time": "13:00", "end_time": "10:00"},
        format="json",
    )
    assert bad.status_code == 400
    # worker 0 attends 3/4, worker 1 attends 2/4
    for i, sid in enumerate(sessions):
        r = staff_client.put(
            f"/api/v1/ops/training/sessions/{sid}/attendance",
            {
                "records": [
                    {"enrollment_id": str(ens[0].id), "present": i < 3},
                    {"enrollment_id": str(ens[1].id), "present": i < 2},
                ]
            },
            format="json",
        )
        assert r.status_code == 200, r.json()
    assert len(r.json()["rows"]) == 2
    assert SessionAttendance.objects.count() == 8
    lst = staff_client.get(f"/api/v1/ops/training/courses/{c.id}/sessions").json()
    assert lst[0]["present_count"] == 2
    enr = staff_client.get("/api/v1/ops/training/enrollments", {"course": str(c.id)}).json()["results"]
    att = {e["id"]: e["attendance"] for e in enr}
    assert att[str(ens[0].id)] == {"sessions": 4, "present": 3, "pct": 75}

    ok = staff_client.post(f"/api/v1/ops/training/enrollments/{ens[0].id}/status", {"status": "completed"})
    assert ok.status_code == 200, ok.json()
    low = staff_client.post(f"/api/v1/ops/training/enrollments/{ens[1].id}/status", {"status": "completed"})
    assert low.status_code == 400 and low.json()["error"]["code"] == "invalid_state"

    # unknown enrolment → 400; delete a session
    stranger = Enrollment.objects.create(course=course(), worker=f.WorkerFactory(), status="enrolled")
    r = staff_client.put(
        f"/api/v1/ops/training/sessions/{sessions[0]}/attendance",
        {"records": [{"enrollment_id": str(stranger.id), "present": True}]},
        format="json",
    )
    assert r.status_code == 400
    assert staff_client.delete(f"/api/v1/ops/training/sessions/{sessions[3]}").status_code == 204
    assert TrainingSession.objects.filter(course=c).count() == 3


def test_course_min_attendance_validation(staff_client):
    c = course()
    r = staff_client.patch(f"/api/v1/ops/training/courses/{c.id}", {"min_attendance_pct": 120}, format="json")
    assert r.status_code == 400


# --------------------------------------------------------------------------- T010
def _complete(c, w, completed_on):
    return Enrollment.objects.create(course=c, worker=w, status="completed", completed_on=completed_on)


def test_outcomes_math_and_k_anonymity(staff_client):
    today = today_ad()
    c = course(starts_on=today - dt.timedelta(days=300))
    done = today - dt.timedelta(days=200)
    org = f.OrganizationFactory()
    for i in range(6):
        w = f.WorkerFactory()
        # prior job before the course: 15,000/month equivalent (daily 577 × 26 ≈ 15,002)
        f.EmploymentFactory(
            organization=org,
            worker=w,
            start_date=today - dt.timedelta(days=700),
            end_date=today - dt.timedelta(days=320),
            status="ended",
            end_reason="resigned",
            wage_type="daily",
            basic_salary=None,
            dearness_allowance=None,
            daily_wage=Decimal("800"),
        )
        _complete(c, w, done)
        if i < 5:  # 5 placed within 90 days, 4 still employed at 90 days
            f.EmploymentFactory(
                organization=f.OrganizationFactory(),
                worker=w,
                start_date=done + dt.timedelta(days=20),
                end_date=(done + dt.timedelta(days=50)) if i == 0 else None,
                status="ended" if i == 0 else "active",
                end_reason="resigned" if i == 0 else None,
                basic_salary=Decimal("15000"),
                dearness_allowance=Decimal("7000"),
            )
    for _ in range(2):
        Enrollment.objects.create(course=c, worker=f.WorkerFactory(), status="dropped")
    row = course_outcomes(c)
    assert row["enrolled"] == 8 and row["completed"] == 6 and row["placed_90d"] == 5
    assert row["retention_judged"] == 5 and row["retained_90d"] is None  # 4 < k → suppressed
    assert row["completion_rate"] == 75.0 and row["placement_rate"] == 83.3
    assert row["retention_rate"] == 80.0
    assert row["median_wage_before"] == "20800.00" and row["median_wage_after"] == "22000.00"

    small = course(starts_on=today - dt.timedelta(days=100))
    for _ in range(3):
        _complete(small, f.WorkerFactory(), today - dt.timedelta(days=10))
    assert course_outcomes(small)["suppressed"] is True
    assert course_outcomes(small)["completed"] is None

    r = staff_client.get("/api/v1/ops/training/outcomes", {"course": str(c.id)})
    assert r.status_code == 200 and r.json()["k_anonymity"] == 5
    assert r.json()["courses"][0]["course"]["id"] == str(c.id)
    assert r.json()["courses"][0]["placed_90d"] == 5
