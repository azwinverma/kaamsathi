"""Job offers (master spec EMP-07) and job alerts / saved searches (SEARCH-02)."""

import datetime as dt
from decimal import Decimal as D

import pytest
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.core.bs import today_ad
from apps.hiring import services
from apps.hiring.models import Application, JobAlert, JobOffer
from apps.notifications.models import Notification, SMSMessage
from apps.workforce.models import Employment
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
    return f.WorkerFactory(user=worker_user, phone=worker_user.phone)


@pytest.fixture
def client(worker_user, worker):
    return auth_client(worker_user)


@pytest.fixture
def app(org, worker):
    job = f.JobFactory(organization=org, trade=f.trade("cook"), status="open")
    return f.ApplicationFactory(job=job, worker=worker, stage="selected")


def offer_body(**kw):
    start = (today_ad() + dt.timedelta(days=7)).isoformat()
    return {
        "wage_type": "monthly",
        "basic_salary": "13000.00",
        "dearness_allowance": "7380.00",
        "start_date": start,
        "designation": "Line cook",
        "contract_type": "permanent",
        **kw,
    }


# --- offers ---------------------------------------------------------------------------------------------


def test_offer_requires_selected_and_min_wage(owner_client, app):
    app.stage = "interview"
    app.save()
    res = owner_client.post(f"/api/v1/org/applications/{app.id}/offer", offer_body(), format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"
    app.stage = "selected"
    app.save()
    res = owner_client.post(
        f"/api/v1/org/applications/{app.id}/offer", offer_body(basic_salary="10000.00"), format="json"
    )
    assert res.status_code == 400 and res.json()["error"]["code"] == "below_minimum_wage"
    res = owner_client.post(
        f"/api/v1/org/applications/{app.id}/offer",
        offer_body(contract_type="fixed_term"),
        format="json",
    )
    assert res.status_code == 400 and "ends_on" in res.json()["error"]["fields"]


def test_offer_lifecycle_accept_and_join_prefill(owner_client, client, app, worker, worker_user):
    res = owner_client.post(f"/api/v1/org/applications/{app.id}/offer", offer_body(), format="json")
    assert res.status_code == 201, res.json()
    offer = res.json()
    assert offer["status"] == "sent" and offer["basic_salary"] == "13000.00"
    assert AuditLog.objects.filter(action="offer.send", object_id=offer["id"]).exists()
    assert Notification.objects.filter(user=worker_user, kind="job_offer").exists()
    # second active offer is refused
    res = owner_client.post(f"/api/v1/org/applications/{app.id}/offer", offer_body(), format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"
    # employer sees the offer on the application
    row = owner_client.get(f"/api/v1/org/applications/{app.id}").json()
    assert row["offer"]["id"] == offer["id"]

    rows = client.get("/api/v1/me/job-offers").json()["results"]
    assert [r["id"] for r in rows] == [offer["id"]]
    assert rows[0]["organization"]["name"] == app.job.organization.name
    assert rows[0]["monthly_amount"] == "20380.00"

    res = client.post(f"/api/v1/me/job-offers/{offer['id']}/accept")
    assert res.status_code == 200 and res.json()["status"] == "accepted"
    app.refresh_from_db()
    assert app.worker_response == "interested"
    assert AuditLog.objects.filter(action="offer.accept", object_id=offer["id"]).exists()
    assert client.post(f"/api/v1/me/job-offers/{offer['id']}/decline").status_code == 400

    # join without employment payload → terms come from the accepted offer
    res = owner_client.post(f"/api/v1/org/applications/{app.id}/move", {"stage": "joined"}, format="json")
    assert res.status_code == 200, res.json()
    emp = Employment.objects.get(pk=res.json()["employment_id"])
    assert emp.basic_salary == D("13000.00") and emp.designation == "Line cook"


def test_join_without_offer_still_needs_terms(owner_client, app):
    res = owner_client.post(f"/api/v1/org/applications/{app.id}/move", {"stage": "joined"}, format="json")
    assert res.status_code == 400 and "employment" in res.json()["error"]["fields"]


def test_decline_withdraw_and_expiry(owner_client, client, app):
    oid = owner_client.post(f"/api/v1/org/applications/{app.id}/offer", offer_body(), format="json").json()[
        "id"
    ]
    res = client.post(f"/api/v1/me/job-offers/{oid}/decline", {"reason": "Too far"}, format="json")
    assert res.status_code == 200 and res.json()["decline_reason"] == "Too far"

    oid = owner_client.post(f"/api/v1/org/applications/{app.id}/offer", offer_body(), format="json").json()[
        "id"
    ]
    res = owner_client.post(f"/api/v1/org/offers/{oid}/withdraw")
    assert res.status_code == 200 and res.json()["status"] == "withdrawn"
    assert client.get(f"/api/v1/me/job-offers/{oid}").status_code == 404  # withdrawn hidden from worker

    oid = owner_client.post(f"/api/v1/org/applications/{app.id}/offer", offer_body(), format="json").json()[
        "id"
    ]
    JobOffer.objects.filter(pk=oid).update(expires_at=timezone.now() - dt.timedelta(minutes=1))
    assert client.get(f"/api/v1/me/job-offers/{oid}").json()["status"] == "expired"  # lazy expiry on read
    res = client.post(f"/api/v1/me/job-offers/{oid}/accept")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"
    assert owner_client.post(f"/api/v1/org/offers/{oid}/withdraw").status_code == 400


def test_offers_scoped(owner_client, app):
    oid = owner_client.post(f"/api/v1/org/applications/{app.id}/offer", offer_body(), format="json").json()[
        "id"
    ]
    other = f.UserFactory()
    f.WorkerFactory(user=other, phone=other.phone)
    assert auth_client(other).post(f"/api/v1/me/job-offers/{oid}/accept").status_code == 404
    m = f.MembershipFactory(role="owner")
    assert auth_client(m.user, m.organization).post(f"/api/v1/org/offers/{oid}/withdraw").status_code == 404
    assert owner_client.get("/api/v1/org/offers").json()["count"] == 1


# --- job alerts -----------------------------------------------------------------------------------------


def test_alert_crud(client, worker):
    res = client.post(
        "/api/v1/me/job-alerts",
        {"trade": "cook", "districts": ["kathmandu", "lalitpur"], "min_wage": "20000", "frequency": "daily"},
        format="json",
    )
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["trade"]["code"] == "cook" and len(body["districts"]) == 2
    res = client.patch(f"/api/v1/me/job-alerts/{body['id']}", {"is_active": False}, format="json")
    assert res.status_code == 200 and res.json()["is_active"] is False
    assert client.get("/api/v1/me/job-alerts").json()["count"] == 1
    other = f.UserFactory()
    f.WorkerFactory(user=other, phone=other.phone)
    assert auth_client(other).delete(f"/api/v1/me/job-alerts/{body['id']}").status_code == 404
    assert client.delete(f"/api/v1/me/job-alerts/{body['id']}").status_code == 204


def _alert(worker, **kw):
    districts = kw.pop("districts", [])
    a = JobAlert.objects.create(worker=worker, **kw)
    a.districts.set([f.district(d) for d in districts])
    return a


def test_publish_fires_instant_alerts(
    owner_client, org, worker, worker_user, django_capture_on_commit_callbacks
):
    _alert(worker, trade=f.trade("cook"), districts=["kathmandu"], min_wage=D("20000"))
    _alert(worker, trade=None)  # second matching alert → still one notification
    miss_user = f.UserFactory()
    miss = f.WorkerFactory(user=miss_user, phone=miss_user.phone)
    _alert(miss, trade=f.trade("mason"))
    poor_user = f.UserFactory()
    poor = f.WorkerFactory(user=poor_user, phone=poor_user.phone)
    _alert(poor, trade=f.trade("cook"), min_wage=D("50000"))
    job = f.JobFactory(organization=org, trade=f.trade("cook"), status="draft", wage_amount=D("21000"))
    with django_capture_on_commit_callbacks(execute=True):
        res = owner_client.post(f"/api/v1/org/jobs/{job.id}/publish")
    assert res.status_code == 200
    assert Notification.objects.filter(user=worker_user, kind="job_alert").count() == 1
    assert SMSMessage.objects.filter(phone=worker.phone, kind="job_alert").exists()
    assert not Notification.objects.filter(user__in=[miss_user, poor_user], kind="job_alert").exists()


def test_unverified_employer_publish_sends_nothing(org, worker, worker_user):
    _alert(worker)
    org.verification_status = "pending"
    org.save()
    job = f.JobFactory(organization=org, status="open")
    assert services.notify_instant_alerts(job.id) == 0
    assert not Notification.objects.filter(user=worker_user).exists()


def test_digests(org, worker, worker_user):
    daily = _alert(worker, frequency="daily", trade=f.trade("cook"))
    _alert(worker, frequency="weekly")
    now = timezone.now()
    j1 = f.JobFactory(organization=org, trade=f.trade("cook"), status="open")
    j2 = f.JobFactory(organization=org, trade=f.trade("cook"), status="open")
    old = f.JobFactory(organization=org, trade=f.trade("cook"), status="open")
    applied = f.JobFactory(organization=org, trade=f.trade("cook"), status="open")
    from apps.hiring.models import JobOpening

    JobOpening.objects.filter(pk__in=[j1.pk, j2.pk, applied.pk]).update(
        published_at=now - dt.timedelta(hours=3)
    )
    JobOpening.objects.filter(pk=old.pk).update(published_at=now - dt.timedelta(days=3))
    Application.objects.create(job=applied, worker=worker)

    assert services.send_alert_digests("daily") == 1
    n = Notification.objects.get(user=worker_user, kind="job_alert_digest")
    assert sorted(n.data["job_ids"]) == sorted([str(j1.id), str(j2.id)])
    daily.refresh_from_db()
    assert daily.last_sent_at is not None
    assert services.send_alert_digests("daily") == 0  # nothing new since last digest
    assert services.send_alert_digests("weekly") == 1
    with pytest.raises(ValueError):
        services.send_alert_digests("hourly")
