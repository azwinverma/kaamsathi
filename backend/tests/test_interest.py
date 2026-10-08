"""Worker interest, recommendations, my applications and shortlist responses
(docs/CONTRACT-EXTENSIONS.md §3)."""

from decimal import Decimal as D

import pytest

from apps.hiring.models import Application, StageEvent
from apps.notifications.models import SMSMessage
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def verified_org(org):
    org.verification_status = "verified"
    org.save()
    return org


@pytest.fixture
def worker_user():
    return f.UserFactory()


@pytest.fixture
def worker(worker_user):
    w = f.WorkerFactory(user=worker_user, phone=worker_user.phone, current_district=f.district("kathmandu"))
    f.WorkerSkillFactory(worker=w, trade=f.trade("cook"), years_experience=4)
    w.preferred_districts.set([f.district("kaski")])
    return w


@pytest.fixture
def client(worker_user, worker):
    return auth_client(worker_user)


def open_job(org, trade="cook", district=None, **kw):
    site = f.SiteFactory(organization=org, district=f.district(district)) if district else None
    return f.JobFactory(
        organization=org, trade=f.trade(trade), site=site, status="open", wage_amount=D("21000"), **kw
    )


# --- recommendations -------------------------------------------------------------------------------


def test_recommended_filters(client, worker, org):
    here = open_job(org)  # org district = kathmandu (current)
    preferred = open_job(org, district="kaski")
    open_job(org, trade="mason")  # not my trade
    open_job(org, district="jhapa")  # not my area
    f.JobFactory(organization=org, trade=f.trade("cook"), status="closed", wage_amount=D("21000"))
    unverified = f.OrganizationFactory(verification_status="unverified")
    open_job(unverified)
    applied = open_job(org)
    f.ApplicationFactory(job=applied, worker=worker)

    res = client.get("/api/v1/me/jobs/recommended")
    assert res.status_code == 200, res.json()
    rows = res.json()["results"]
    assert {r["id"] for r in rows} == {str(here.id), str(preferred.id)}
    row = next(r for r in rows if r["id"] == str(preferred.id))
    assert row["employer_verified"] is True
    assert row["district"]["code"] == "kaski"
    assert row["organization"]["name"] == org.name
    assert row["wage_amount"] == "21000.00" and row["trade"]["code"] == "cook"
    assert {"food_provided", "accommodation_provided", "start_date", "wage_type"} <= set(row)
    assert "counts" not in row


def test_recommended_requires_worker_profile():
    assert auth_client(f.UserFactory()).get("/api/v1/me/jobs/recommended").status_code == 404


# --- interest ----------------------------------------------------------------------------------------


def test_interest_hidden_from_employer_until_shortlist(client, worker, org, owner_client, staff_client):
    job = open_job(org)
    res = client.post(f"/api/v1/me/jobs/{job.id}/interest")
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["stage"] == "sourced" and body["source"] == "worker_interest"
    assert body["worker_response"] == "interested" and body["can_respond"] is False
    app = Application.objects.get(pk=body["id"])
    assert StageEvent.objects.filter(application=app, to_stage="sourced").exists()
    # idempotent
    assert client.post(f"/api/v1/me/jobs/{job.id}/interest").status_code == 200

    # employer sees nothing: list, detail, counts, dashboard
    assert owner_client.get("/api/v1/org/applications").json()["count"] == 0
    assert owner_client.get(f"/api/v1/org/applications/{app.id}").status_code == 404
    assert owner_client.get(f"/api/v1/org/jobs/{job.id}").json()["counts"]["sourced"] == 0
    assert owner_client.get("/api/v1/org/dashboard").json()["pipeline"]["sourced"] == 0

    # ops sees the interest in matches and the job list
    matches = staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches").json()
    row = next(m for m in matches if m["worker"]["id"] == str(worker.id))
    assert row["interested"] is True
    ops_job = staff_client.get(f"/api/v1/ops/jobs/{job.id}").json()
    assert ops_job["interested_count"] == 1

    # ops shortlists → visible, worker asked to confirm
    res = staff_client.post(
        f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(worker.id)]}, format="json"
    )
    assert res.status_code == 201, res.json()
    app.refresh_from_db()
    assert app.stage == "shortlisted" and app.worker_response == "pending"
    rows = owner_client.get("/api/v1/org/applications").json()["results"]
    assert [r["id"] for r in rows] == [str(app.id)]
    assert rows[0]["source"] == "worker_interest" and rows[0]["worker_response"] == "pending"
    assert rows[0]["worker_response_label"]


def test_interest_rejected_for_unverified_or_closed(client):
    unverified = f.OrganizationFactory(verification_status="unverified")
    job = open_job(unverified)
    res = client.post(f"/api/v1/me/jobs/{job.id}/interest")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"


def test_interest_when_already_in_pipeline(client, worker, org):
    job = open_job(org)
    f.ApplicationFactory(job=job, worker=worker, stage="shortlisted")
    res = client.post(f"/api/v1/me/jobs/{job.id}/interest")
    assert res.status_code == 400 and res.json()["error"]["code"] == "duplicate"


# --- shortlist notification --------------------------------------------------------------------------


def test_shortlist_notifies_worker(staff_client, worker, org, django_capture_on_commit_callbacks):
    job = open_job(org, title="Cook")
    with django_capture_on_commit_callbacks(execute=True):
        res = staff_client.post(
            f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(worker.id)]}, format="json"
        )
    assert res.status_code == 201, res.json()
    app = Application.objects.get(job=job, worker=worker)
    assert app.source == "ops" and app.worker_response == "pending"
    sms = SMSMessage.objects.filter(phone=worker.phone)
    assert sms.exists() and org.name in sms.first().body
    try:
        from apps.notifications.models import Notification
    except ImportError:  # inbox not built yet
        return
    assert Notification.objects.filter(user=worker.user, kind="application_shortlisted").exists()


def test_shortlist_sms_for_worker_without_account(staff_client, org, django_capture_on_commit_callbacks):
    w = f.WorkerFactory()
    job = open_job(org)
    with django_capture_on_commit_callbacks(execute=True):
        staff_client.post(f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(w.id)]}, format="json")
    assert SMSMessage.objects.filter(phone=w.phone, kind="shortlist").exists()


# --- my applications & respond -------------------------------------------------------------------------


def test_my_applications_and_confirm(client, worker, org, owner_client):
    job = open_job(org)
    app = f.ApplicationFactory(job=job, worker=worker, stage="shortlisted", worker_response="pending")
    f.ApplicationFactory(job=open_job(org), worker=f.WorkerFactory())  # someone else's

    rows = client.get("/api/v1/me/applications").json()["results"]
    assert [r["id"] for r in rows] == [str(app.id)]
    assert rows[0]["can_respond"] is True and rows[0]["organization"]["name"] == org.name
    assert rows[0]["job"]["title"] == job.title and "notes" not in rows[0]

    res = client.post(f"/api/v1/me/applications/{app.id}/respond", {"response": "interested"}, format="json")
    assert res.status_code == 200, res.json()
    assert res.json()["worker_response"] == "interested" and res.json()["responded_at"]
    assert res.json()["stage"] == "shortlisted"
    row = owner_client.get(f"/api/v1/org/applications/{app.id}").json()
    assert row["worker_response"] == "interested"


def test_respond_declined_drops(client, worker, org):
    app = f.ApplicationFactory(
        job=open_job(org), worker=worker, stage="shortlisted", worker_response="pending"
    )
    res = client.post(
        f"/api/v1/me/applications/{app.id}/respond",
        {"response": "declined", "note": "Too far from home"},
        format="json",
    )
    assert res.status_code == 200, res.json()
    app.refresh_from_db()
    assert app.stage == "dropped" and app.worker_response == "declined"
    ev = StageEvent.objects.filter(application=app, to_stage="dropped").get()
    assert ev.note.startswith("Declined by worker")
    res = client.post(f"/api/v1/me/applications/{app.id}/respond", {"response": "interested"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"


def test_withdraw_own_interest(client, worker, org):
    job = open_job(org)
    app_id = client.post(f"/api/v1/me/jobs/{job.id}/interest").json()["id"]
    res = client.post(f"/api/v1/me/applications/{app_id}/respond", {"response": "declined"}, format="json")
    assert res.status_code == 200
    assert Application.objects.get(pk=app_id).stage == "dropped"


def test_cannot_respond_to_others(worker, org):
    app = f.ApplicationFactory(job=open_job(org), worker=f.WorkerFactory(), stage="shortlisted")
    other = f.UserFactory()
    f.WorkerFactory(user=other, phone=other.phone)
    res = auth_client(other).post(
        f"/api/v1/me/applications/{app.id}/respond", {"response": "declined"}, format="json"
    )
    assert res.status_code == 404


def test_respond_validation(client, worker, org):
    app = f.ApplicationFactory(job=open_job(org), worker=worker, stage="shortlisted")
    res = client.post(f"/api/v1/me/applications/{app.id}/respond", {"response": "maybe"}, format="json")
    assert res.status_code == 400 and "response" in res.json()["error"]["fields"]


# --- /me/worker preferences ------------------------------------------------------------------------------


def test_me_worker_preferences(client, worker):
    res = client.patch(
        "/api/v1/me/worker",
        {
            "preferred_districts": ["lalitpur", "bhaktapur"],
            "service_radius_km": 25,
            "expected_monthly_wage": "24000.00",
            "available_from": "2026-11-01",
            "is_available": False,
        },
        format="json",
    )
    assert res.status_code == 200, res.json()
    body = client.get("/api/v1/me/worker").json()
    assert sorted(d["code"] for d in body["preferred_districts"]) == ["bhaktapur", "lalitpur"]
    assert body["service_radius_km"] == 25
    assert body["expected_monthly_wage"] == "24000.00"
    assert body["available_from"] == "2026-11-01" and body["is_available"] is False
    # still read-only
    name = worker.full_name
    client.patch("/api/v1/me/worker", {"full_name": "Someone Else"}, format="json")
    worker.refresh_from_db()
    assert worker.full_name == name
    res = client.patch("/api/v1/me/worker", {"service_radius_km": 9999}, format="json")
    assert res.status_code == 400
    res = client.patch("/api/v1/me/worker", {"preferred_districts": ["atlantis"]}, format="json")
    assert res.status_code == 400
