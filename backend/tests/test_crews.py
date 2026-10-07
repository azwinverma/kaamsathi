"""Naike crews and referral rewards (docs/CONTRACT-ECOSYSTEM.md §2)."""

import datetime as dt
from decimal import Decimal as D

import pytest
from django.test import override_settings

from apps.core.bs import today_ad
from apps.crews.models import Crew, Referral
from apps.crews.services import update_eligibility
from apps.hiring.services import move_application
from apps.workers.models import Worker
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

TODAY = today_ad()


def days_ago(n):
    return TODAY - dt.timedelta(days=n)


def lead_with_user(name="Shyam crew"):
    lead = f.WorkerFactory()
    lead.user = f.UserFactory(phone=lead.phone)
    lead.save(update_fields=["user"])
    crew = Crew.objects.create(lead=lead, name=name)
    return lead, crew, auth_client(lead.user)


def join(org, owner, worker, start=None):
    job = f.JobFactory(organization=org)
    app = f.ApplicationFactory(job=job, worker=worker, stage="selected")
    _, emp = move_application(
        app,
        "joined",
        owner,
        employment_data={
            "start_date": start or TODAY,
            "wage_type": "monthly",
            "basic_salary": D("12170"),
            "dearness_allowance": D("7380"),
            "ssf_enrolled": False,
        },
    )
    return app, emp


# --------------------------------------------------------------------------- referral lifecycle
@override_settings(NAIKE_REFERRAL_FEE="500.00", NAIKE_REFERRAL_HOLD_DAYS=30)
def test_joined_crew_member_creates_pending_referral(org, owner):
    lead, crew, _ = lead_with_user()
    member = f.WorkerFactory(naike=lead)
    app, emp = join(org, owner, member)
    ref = Referral.objects.get(application=app)
    assert (ref.crew, ref.worker, ref.employment, ref.status, ref.amount) == (
        crew,
        member,
        emp,
        "pending",
        D("500.00"),
    )
    app.save()  # re-saving never duplicates
    assert Referral.objects.filter(application=app).count() == 1


def test_no_referral_without_active_crew(org, owner):
    lead = f.WorkerFactory()
    loner = f.WorkerFactory()
    join(org, owner, loner)
    inactive = f.WorkerFactory(naike=lead)
    Crew.objects.create(lead=lead, name="Dormant", is_active=False)
    join(org, owner, inactive)
    no_crew_naike = f.WorkerFactory(naike=f.WorkerFactory())
    join(org, owner, no_crew_naike)
    assert Referral.objects.count() == 0


@override_settings(NAIKE_REFERRAL_HOLD_DAYS=30)
def test_eligibility_task_transitions(org, owner):
    lead, crew, _ = lead_with_user()
    stays = f.WorkerFactory(naike=lead)
    leaves = f.WorkerFactory(naike=lead)
    fresh = f.WorkerFactory(naike=lead)
    _, e_stays = join(org, owner, stays, start=days_ago(31))
    _, e_leaves = join(org, owner, leaves, start=days_ago(31))
    join(org, owner, fresh, start=days_ago(5))
    e_leaves.status, e_leaves.end_date, e_leaves.end_reason = "ended", days_ago(20), "resigned"
    e_leaves.save()

    from apps.crews.tasks import update_referral_eligibility

    assert update_referral_eligibility() == {"eligible": 1, "void": 1}
    assert Referral.objects.get(worker=stays).status == "eligible"
    voided = Referral.objects.get(worker=leaves)
    assert voided.status == "void" and voided.void_reason
    assert Referral.objects.get(worker=fresh).status == "pending"
    assert update_eligibility() == {"eligible": 0, "void": 0}  # idempotent


@override_settings(NAIKE_REFERRAL_HOLD_DAYS=30)
def test_ops_mark_paid_and_void(staff_client, org, owner):
    lead, crew, client = lead_with_user()
    a, b = f.WorkerFactory(naike=lead), f.WorkerFactory(naike=lead)
    join(org, owner, a, start=days_ago(40))
    join(org, owner, b, start=days_ago(2))
    update_eligibility()
    ra, rb = Referral.objects.get(worker=a), Referral.objects.get(worker=b)

    res = staff_client.post(f"/api/v1/ops/referrals/{rb.id}/mark-paid", {"payout_ref": "X"}, format="json")
    assert res.json()["error"]["code"] == "invalid_state"  # still pending
    res = staff_client.post(
        f"/api/v1/ops/referrals/{ra.id}/mark-paid", {"payout_ref": "ESEWA-123"}, format="json"
    )
    assert (
        res.status_code == 200 and res.json()["status"] == "paid" and res.json()["payout_ref"] == "ESEWA-123"
    )
    res = staff_client.post(f"/api/v1/ops/referrals/{ra.id}/void", {"reason": "oops"}, format="json")
    assert res.json()["error"]["code"] == "invalid_state"
    res = staff_client.post(
        f"/api/v1/ops/referrals/{rb.id}/void", {"reason": "Duplicate placement"}, format="json"
    )
    assert res.json()["status"] == "void"

    assert staff_client.get("/api/v1/ops/referrals", {"status": "paid"}).json()["count"] == 1
    crews = staff_client.get("/api/v1/ops/crews").json()
    assert crews["count"] == 1 and crews["results"][0]["stats"]["earned_total"] == "500.00"
    detail = staff_client.get(f"/api/v1/ops/crews/{crew.id}").json()
    assert len(detail["members"]) == 2 and len(detail["referrals"]) == 2
    # the naike sees their own referrals; ops endpoints are staff-only
    assert client.get("/api/v1/me/crew/referrals").json()["count"] == 2
    assert client.get("/api/v1/ops/crews").status_code == 403


# --------------------------------------------------------------------------- naike self-service
def test_become_lead_and_manage_members(org):
    w = f.WorkerFactory()
    w.user = f.UserFactory(phone=w.phone)
    w.save(update_fields=["user"])
    client = auth_client(w.user)
    assert client.get("/api/v1/me/crew").status_code == 404
    res = client.post("/api/v1/me/crew", {"name": "Hetauda masons"}, format="json")
    assert res.status_code == 201 and res.json()["members"] == []
    assert (
        client.post("/api/v1/me/crew", {"name": "again"}, format="json").json()["error"]["code"]
        == "duplicate"
    )

    res = client.post(
        "/api/v1/me/crew/members",
        {"phone": "9812345678", "full_name": "Naya Kamdar", "trade": "mason", "years_experience": 2},
        format="json",
    )
    assert res.status_code == 201, res.json()
    new = Worker.objects.get(phone="9812345678")
    assert new.naike_id == w.id and new.verification_status == "unverified"
    assert new.skills.get().trade_id == "mason"
    assert res.json()["current_employer"] is None and "verification_level" in res.json()

    employed = f.WorkerFactory()
    f.EmploymentFactory(worker=employed, organization=org)
    res = client.post(
        "/api/v1/me/crew/members",
        {"phone": employed.phone, "full_name": "x", "trade": "helper"},
        format="json",
    )
    assert res.status_code == 201 and res.json()["current_employer"]["id"] == str(org.id)

    taken = f.WorkerFactory(naike=f.WorkerFactory())
    res = client.post(
        "/api/v1/me/crew/members", {"phone": taken.phone, "full_name": "x", "trade": "helper"}, format="json"
    )
    assert res.json()["error"]["code"] == "invalid_state"
    res = client.post(
        "/api/v1/me/crew/members", {"phone": "12345", "full_name": "x", "trade": "helper"}, format="json"
    )
    assert res.status_code == 400

    crew = client.get("/api/v1/me/crew").json()
    assert crew["stats"]["members"] == 2 and len(crew["members"]) == 2

    assert client.delete(f"/api/v1/me/crew/members/{new.id}").status_code == 204
    new.refresh_from_db()
    assert new.naike_id is None
    assert client.delete(f"/api/v1/me/crew/members/{taken.id}").status_code == 404
