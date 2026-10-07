"""Training: shortage engine, providers/courses CRUD, enrolment flows, completion → credential."""

import datetime as dt
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.core.bs import today_ad
from apps.credentials.models import Credential
from apps.geo.models import District
from apps.training import services
from apps.training.models import Course, Enrollment, TrainingProvider
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def provider(**kw):
    data = {
        "name": "KTTC",
        "kind": "ctevt_affiliated",
        "ctevt_affiliation_no": "AFF-1",
        "district": District.objects.get(code="kathmandu"),
        "phone": "014000000",
    }
    data.update(kw)
    return TrainingProvider.objects.create(**data)


def course(prov=None, **kw):
    data = {
        "provider": prov or provider(),
        "trade": f.trade("electrician"),
        "title": "Electrician L1",
        "level": "level1",
        "duration_days": 90,
        "fee": Decimal("18500"),
        "district": District.objects.get(code="kathmandu"),
        "starts_on": today_ad() + dt.timedelta(days=10),
        "seats": 20,
    }
    data.update(kw)
    return Course.objects.create(**data)


def worker_with_skill(trade_code, district="kathmandu", **kw):
    w = f.WorkerFactory(current_district=District.objects.get(code=district), **kw)
    f.WorkerSkillFactory(worker=w, trade=f.trade(trade_code))
    return w


def shortage_for(rows, code):
    return next((r for r in rows if r["trade"]["code"] == code), None)


# --- shortage engine --------------------------------------------------------------------------


def test_shortage_math():
    org = f.OrganizationFactory()  # kathmandu
    job = f.JobFactory(organization=org, trade=f.trade("electrician"), openings_count=5, status="open")
    f.ApplicationFactory(job=job, stage="joined")
    f.ApplicationFactory(job=job, stage="shortlisted")  # not joined → still demand
    f.JobFactory(organization=org, trade=f.trade("electrician"), openings_count=2, status="draft")  # ignored
    old = f.JobFactory(organization=org, trade=f.trade("electrician"), openings_count=3, status="closed")
    type(old).objects.filter(pk=old.pk).update(
        created_at=timezone.now() - dt.timedelta(days=200)
    )  # outside window
    filled = f.JobFactory(organization=org, trade=f.trade("plumber"), openings_count=1, status="filled")
    f.ApplicationFactory(job=filled, stage="joined")

    worker_with_skill("electrician")
    worker_with_skill("electrician", verification_status="pending")  # not verified
    worker_with_skill("electrician", is_available=False)  # not available
    worker_with_skill("cook")

    rows = services.shortages()
    elec = shortage_for(rows, "electrician")
    assert elec == {
        "trade": {
            "code": "electrician",
            "name_en": elec["trade"]["name_en"],
            "name_ne": elec["trade"]["name_ne"],
        },
        "demand": 4,
        "supply": 1,
        "shortage": 3,
        "open_jobs": 1,
        "fill_rate": 0.2,
    }
    plumber = shortage_for(rows, "plumber")
    assert plumber["demand"] == 0 and plumber["fill_rate"] == 1.0
    cook = shortage_for(rows, "cook")
    assert cook["shortage"] == 0 and cook["supply"] == 1
    assert rows[0]["trade"]["code"] == "electrician"  # sorted by shortage
    # The 200-day-old closed job counts when the window is long enough.
    assert shortage_for(services.shortages(days=365), "electrician")["demand"] == 7


def test_shortage_district_filter():
    ktm = f.OrganizationFactory()
    mwp_site = f.SiteFactory(organization=ktm, district=District.objects.get(code="makwanpur"))
    f.JobFactory(organization=ktm, trade=f.trade("welder"), openings_count=3, status="open")
    f.JobFactory(organization=ktm, site=mwp_site, trade=f.trade("welder"), openings_count=2, status="open")
    worker_with_skill("welder", district="makwanpur")
    assert shortage_for(services.shortages(district="kathmandu"), "welder")["demand"] == 3
    mwp = shortage_for(services.shortages(district="makwanpur"), "welder")
    assert (mwp["demand"], mwp["supply"], mwp["shortage"]) == (2, 1, 1)


def test_ops_shortages_endpoint(staff_client, owner_client):
    f.JobFactory(trade=f.trade("welder"), openings_count=2, status="open")
    body = staff_client.get("/api/v1/ops/training/shortages?district=kathmandu").json()
    assert body["district"] == "kathmandu" and body["days"] == 90
    assert shortage_for(body["results"], "welder")["shortage"] == 2
    assert owner_client.get("/api/v1/ops/training/shortages").status_code == 403


# --- ops CRUD ---------------------------------------------------------------------------------


def test_ops_provider_and_course_crud(staff_client):
    res = staff_client.post(
        "/api/v1/ops/training/providers",
        {"name": "Hetauda SDI", "kind": "ctevt_affiliated", "district": "makwanpur", "phone": "057520447"},
    )
    assert res.status_code == 400 and "ctevt_affiliation_no" in res.json()["error"]["fields"]
    res = staff_client.post(
        "/api/v1/ops/training/providers",
        {
            "name": "Hetauda SDI",
            "kind": "ctevt_affiliated",
            "ctevt_affiliation_no": "A-47",
            "district": "makwanpur",
            "phone": "057520447",
        },
    )
    assert res.status_code == 201, res.content
    pid = res.json()["id"]
    assert res.json()["district"]["code"] == "makwanpur"
    assert res.json()["kind_label"] == "CTEVT affiliated"

    res = staff_client.post(
        "/api/v1/ops/training/courses",
        {
            "provider_id": pid,
            "trade": "welder",
            "title": "Arc welding",
            "level": "level1",
            "duration_days": 75,
            "fee": "16000",
            "mode": "classroom",
            "district": "makwanpur",
            "starts_on": "2026-11-01",
            "seats": 18,
            "leads_to_nstb": True,
        },
    )
    assert res.status_code == 201, res.content
    c = res.json()
    assert c["fee"] == "16000.00" and c["starts_on_bs"] and c["provider"]["name"] == "Hetauda SDI"
    assert c["seats_taken"] == 0 and c["level_label"] == "Level 1"
    res = staff_client.patch(f"/api/v1/ops/training/courses/{c['id']}", {"status": "closed"})
    assert res.json()["status"] == "closed"
    assert staff_client.get(f"/api/v1/ops/training/courses?provider={pid}").json()["count"] == 1
    assert staff_client.delete(f"/api/v1/ops/training/courses/{c['id']}").status_code == 204


def test_cannot_delete_course_with_enrollments(staff_client):
    c = course()
    Enrollment.objects.create(course=c, worker=f.WorkerFactory())
    assert (
        staff_client.delete(f"/api/v1/ops/training/courses/{c.id}").json()["error"]["code"] == "invalid_state"
    )
    assert (
        staff_client.delete(f"/api/v1/ops/training/providers/{c.provider_id}").json()["error"]["code"]
        == "invalid_state"
    )


def test_ops_training_requires_staff(owner_client):
    assert owner_client.get("/api/v1/ops/training/providers").status_code == 403
    assert owner_client.get("/api/v1/ops/training/enrollments").status_code == 403


# --- worker -----------------------------------------------------------------------------------


def test_worker_courses_recommended_and_enroll():
    user = f.UserFactory()
    w = worker_with_skill("cook", user=user)
    client = auth_client(user)
    cook = course(trade=f.trade("cook"), title="Cook L1")
    course(title="Electrician L1")
    course(title="Closed", status="closed")
    body = client.get("/api/v1/me/courses").json()
    assert body["count"] == 2
    assert body["results"][0]["id"] == str(cook.id) and body["results"][0]["recommended"] is True
    assert body["results"][1]["recommended"] is False
    assert client.get("/api/v1/me/courses?trade=electrician").json()["count"] == 1

    res = client.post("/api/v1/me/enrollments", {"course_id": str(cook.id)})
    assert res.status_code == 201, res.content
    assert res.json()["status"] == "applied" and res.json()["course"]["title"] == "Cook L1"
    dup = client.post("/api/v1/me/enrollments", {"course_id": str(cook.id)})
    assert dup.status_code == 400 and dup.json()["error"]["code"] == "duplicate"
    closed = Course.objects.get(title="Closed")
    assert (
        client.post("/api/v1/me/enrollments", {"course_id": str(closed.id)}).json()["error"]["code"]
        == "invalid_state"
    )
    assert client.get("/api/v1/me/enrollments").json()["results"][0]["worker"]["id"] == str(w.id)


# --- employer ---------------------------------------------------------------------------------


def test_org_sponsors_only_own_active_workers(owner_client, org):
    c = course()
    mine = f.EmploymentFactory(organization=org)
    ended = f.EmploymentFactory(organization=org, status="ended", end_date=today_ad())
    stranger = f.WorkerFactory()
    res = owner_client.post(
        "/api/v1/org/enrollments",
        {"course_id": str(c.id), "worker_ids": [str(mine.worker_id), str(ended.worker_id), str(stranger.id)]},
    )
    assert res.status_code == 201, res.content
    body = res.json()
    assert [e["worker"]["id"] for e in body["created"]] == [str(mine.worker_id)]
    assert len(body["skipped"]) == 2
    assert body["fee_total"] == "18500.00"
    assert Enrollment.objects.get(worker=mine.worker).sponsored_by_org == org
    # Second time: skipped as duplicate
    again = owner_client.post(
        "/api/v1/org/enrollments", {"course_id": str(c.id), "worker_ids": [str(mine.worker_id)]}
    )
    assert again.status_code == 200 and again.json()["created"] == []
    # Nobody valid → 400
    bad = owner_client.post(
        "/api/v1/org/enrollments", {"course_id": str(c.id), "worker_ids": [str(stranger.id)]}
    )
    assert bad.status_code == 400
    listed = owner_client.get("/api/v1/org/enrollments").json()
    assert listed["count"] == 1


def test_org_courses_recommend_workforce_trades(owner_client, org):
    f.EmploymentFactory(organization=org, trade=f.trade("cook"))
    cook = course(trade=f.trade("cook"), title="Cook L1")
    course(trade=f.trade("plumber"), title="Plumber")
    rows = owner_client.get("/api/v1/org/courses").json()["results"]
    assert rows[0]["id"] == str(cook.id) and rows[0]["recommended"] is True
    assert rows[1]["recommended"] is False


def test_other_org_cannot_see_sponsored(owner_client, org):
    c = course()
    other_org = f.OrganizationFactory()
    Enrollment.objects.create(course=c, worker=f.WorkerFactory(), sponsored_by_org=other_org)
    assert owner_client.get("/api/v1/org/enrollments").json()["count"] == 0


# --- ops status / completion ------------------------------------------------------------------


def test_completion_creates_verified_credential(
    staff_client, monkeypatch, django_capture_on_commit_callbacks
):
    from apps.credentials import services as cred_services

    calls = []
    monkeypatch.setattr(cred_services, "trust_call", lambda name, *a, **k: calls.append(name))
    c = course(title="Electrician L1")
    e = Enrollment.objects.create(course=c, worker=f.WorkerFactory())
    url = f"/api/v1/ops/training/enrollments/{e.id}/status"
    assert staff_client.post(url, {"status": "enrolled"}).json()["status"] == "enrolled"
    with django_capture_on_commit_callbacks(execute=True):
        res = staff_client.post(url, {"status": "completed"})
    assert res.status_code == 200, res.content
    body = res.json()
    assert body["status"] == "completed" and body["completed_on"] == today_ad().isoformat()
    cred = Credential.objects.get(pk=body["credential_id"])
    assert (cred.kind, cred.status, cred.verification_method) == (
        "training_course",
        "verified",
        "issuer_partner",
    )
    assert cred.title == "Electrician L1" and cred.issuer == c.provider.name and cred.issued_on == today_ad()
    assert "recompute_trust" in calls
    # Completed is terminal.
    assert staff_client.post(url, {"status": "dropped"}).json()["error"]["code"] == "invalid_state"


def test_seats_limit(staff_client):
    c = course(seats=1)
    Enrollment.objects.create(course=c, worker=f.WorkerFactory(), status="enrolled")
    e = Enrollment.objects.create(course=c, worker=f.WorkerFactory())
    res = staff_client.post(f"/api/v1/ops/training/enrollments/{e.id}/status", {"status": "enrolled"})
    assert res.json()["error"]["code"] == "invalid_state"


def test_ops_enrollments_filter(staff_client):
    c1, c2 = course(title="A"), course(title="B")
    Enrollment.objects.create(course=c1, worker=f.WorkerFactory())
    Enrollment.objects.create(course=c2, worker=f.WorkerFactory())
    body = staff_client.get(f"/api/v1/ops/training/enrollments?course={c1.id}").json()
    assert body["count"] == 1 and "phone" in body["results"][0]["worker"]


def test_demo_seeds_are_idempotent():
    import io
    import random

    from apps.credentials import demo as cred_demo
    from apps.training import demo as training_demo

    for _ in range(2):
        training_demo.seed(io.StringIO(), random.Random(1))
        cred_demo.seed(io.StringIO(), random.Random(1))
    assert TrainingProvider.objects.count() == 4
    assert Course.objects.count() == 10
