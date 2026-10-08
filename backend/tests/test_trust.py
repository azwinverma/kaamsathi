"""Trust layer (docs/CONTRACT-ECOSYSTEM.md §1): reliability score, levels, profile views,
disputes, worker→employer rating."""

import datetime as dt
from decimal import Decimal as D

import pytest
from django.apps import apps as django_apps

from apps.core.bs import today_ad
from apps.hiring.services import match_score
from apps.trust.models import Dispute, ProfileView, WorkerTrust
from apps.trust.services import employer_reputation, log_profile_view, recompute_trust
from apps.workers.models import Rating, Worker
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

TODAY = today_ad()


def days_ago(n):
    return TODAY - dt.timedelta(days=n)


def worker_with_user(**kw):
    w = f.WorkerFactory(**kw)
    w.user = f.UserFactory(phone=w.phone)
    w.save(update_fields=["user"])
    return w


def rate(emp, a, b, rater="employer"):
    return Rating.objects.create(employment=emp, rater=rater, score_a=a, score_b=b)


def attendance(emp, statuses):
    for i, status in enumerate(statuses, start=1):
        f.AttendanceFactory(employment=emp, date=days_ago(i), status=status)


# --------------------------------------------------------------------------- score formula
def test_reliability_score_hand_computed():
    w = f.WorkerFactory(verification_status="verified")
    f.WorkerSkillFactory(worker=w, nstb_level="level2")
    org_a, org_b = f.OrganizationFactory(), f.OrganizationFactory()
    e1 = f.EmploymentFactory(
        worker=w,
        organization=org_a,
        start_date=days_ago(300),
        end_date=days_ago(180),
        status="ended",
        end_reason="resigned",
    )
    rate(e1, 5, 4)  # 4.5 / 5 = 0.9
    e2 = f.EmploymentFactory(worker=w, organization=org_b, start_date=days_ago(150))
    attendance(e2, ["present"] * 20 + ["half_day"] * 4 + ["absent"] * 6)  # (20 + 2) / 30

    trust = recompute_trust(w)
    b = trust.breakdown
    assert b["employer_feedback"] == 0.9
    assert b["attendance"] == 0.7333
    assert b["completion"] == 1.0
    assert b["skills"] == 0.4  # NSTB level declared
    assert b["repeat_hiring"] == 0.5  # one org rated ≥ 4
    assert b["stability"] == 0.375  # avg tenure (4 + 5) / 2 = 4.5 months / 12
    # 0.3·0.9 + 0.2·0.7333 + 0.15·1 + 0.15·0.4 + 0.1·0.5 + 0.1·0.375 = 0.71416 → 71
    assert trust.reliability_score == 71
    # level: 1 identity + 2 (ended employment rated by employer); no assessment → 2
    assert trust.verification_level == 2


def test_neutral_defaults():
    w = f.WorkerFactory(verification_status="unverified")
    f.EmploymentFactory(worker=w, start_date=days_ago(60))
    trust = recompute_trust(w)
    assert trust.breakdown["employer_feedback"] == 0.7
    assert trust.breakdown["attendance"] == 0.8  # fewer than 10 days recorded
    assert trust.breakdown["skills"] == 0.2
    assert trust.breakdown["repeat_hiring"] == 0.3
    # 0.21 + 0.16 + 0.15 + 0.03 + 0.03 + 0.1·(2/12) = 0.59667 → 60
    assert trust.reliability_score == 60
    assert trust.verification_level == 0


def test_no_employment_means_null_score():
    w = f.WorkerFactory(verification_status="verified")
    trust = recompute_trust(w)
    assert trust.reliability_score is None
    assert trust.verification_level == 1


def test_completion_and_rehire():
    w = f.WorkerFactory()
    org = f.OrganizationFactory()
    f.EmploymentFactory(
        worker=w,
        organization=org,
        start_date=days_ago(400),
        end_date=days_ago(340),
        status="ended",
        end_reason="terminated",
    )
    f.EmploymentFactory(
        worker=w,
        organization=org,
        start_date=days_ago(300),
        end_date=days_ago(240),
        status="ended",
        end_reason="contract_end",
    )
    trust = recompute_trust(w)
    assert trust.breakdown["completion"] == 0.5
    assert trust.breakdown["repeat_hiring"] == 1.0  # rehired by the same org


def test_employment_verified_by_30_worked_days():
    w = f.WorkerFactory(verification_status="verified")
    emp = f.EmploymentFactory(worker=w, start_date=days_ago(100))
    attendance(emp, ["present"] * 29 + ["absent"])
    assert recompute_trust(w).verification_level == 1
    f.AttendanceFactory(employment=emp, date=days_ago(40), status="half_day")
    assert recompute_trust(w).verification_level == 2


def test_levels_3_to_5_with_credentials():
    try:
        Credential = django_apps.get_model("credentials", "Credential")
        SkillAssessment = django_apps.get_model("credentials", "SkillAssessment")
    except LookupError:
        pytest.skip("credentials app not available")
    w = f.WorkerFactory(verification_status="verified")
    org_a, org_b = f.OrganizationFactory(), f.OrganizationFactory()
    e1 = f.EmploymentFactory(
        worker=w,
        organization=org_a,
        start_date=days_ago(800),
        end_date=days_ago(400),
        status="ended",
        end_reason="resigned",
    )
    e2 = f.EmploymentFactory(worker=w, organization=org_b, start_date=days_ago(300))
    rate(e1, 5, 5)
    rate(e2, 5, 5)
    assert recompute_trust(w).verification_level == 2
    SkillAssessment.objects.create(worker=w, trade=f.trade("cook"), assessed_on=TODAY, result="pass")
    trust = recompute_trust(w)
    assert trust.verification_level == 3 and trust.breakdown["skills"] == 0.7
    Credential.objects.create(worker=w, kind="nstb", title="Cook L2", issuer="NSTB", status="verified")
    trust = recompute_trust(w)
    # 0.3 + 0.16 + 0.15 + 0.15 + 0.1 + 0.1·(((400 + 300) / 2 / 30) / 12) = 0.95722 → 96
    assert trust.reliability_score == 96
    assert trust.verification_level == 5


def test_trust_recomputed_by_signal_on_attendance(django_capture_on_commit_callbacks):
    w = f.WorkerFactory()
    emp = f.EmploymentFactory(worker=w, start_date=days_ago(10))
    WorkerTrust.objects.filter(worker=w).delete()
    with django_capture_on_commit_callbacks(execute=True):
        f.AttendanceFactory(employment=emp, date=days_ago(1))
    assert WorkerTrust.objects.get(worker=w).reliability_score is not None


# --------------------------------------------------------------------------- matching + card
def test_match_score_reliability_bonus(org):
    job = f.JobFactory(organization=org, trade=f.trade("cook"), wage_amount=D("20000"))
    w = f.WorkerFactory(current_district=f.district("jhapa"))
    f.WorkerSkillFactory(worker=w, years_experience=0)
    assert match_score(job, w) == (60, ["Trade match", "Verified"])
    WorkerTrust.objects.update_or_create(
        worker=w, defaults={"reliability_score": 85, "verification_level": 2}
    )
    w = Worker.objects.get(pk=w.pk)
    score, reasons = match_score(job, w)
    assert score == 64 and reasons[-1] == "Reliable"
    WorkerTrust.objects.filter(worker=w).update(reliability_score=79)
    w = Worker.objects.get(pk=w.pk)
    assert match_score(job, w) == (63, ["Trade match", "Verified"])


def test_worker_card_has_trust_fields(staff_client):
    w = f.WorkerFactory(verification_status="verified")
    res = staff_client.get("/api/v1/ops/workers", {"q": w.full_name}).json()["results"][0]
    assert res["verification_level"] == 1 and res["reliability_score"] is None


# --------------------------------------------------------------------------- profile views
def test_application_detail_logs_view(owner_client, owner, org):
    w = f.WorkerFactory()
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), worker=w, stage="shortlisted")
    assert owner_client.get(f"/api/v1/org/applications/{app.id}").status_code == 200
    owner_client.get(f"/api/v1/org/applications/{app.id}")  # refresh: deduplicated
    views = ProfileView.objects.filter(worker=w)
    assert views.count() == 1
    v = views.get()
    assert (v.context, v.organization_id, v.viewer_id, v.object_id) == (
        "application",
        org.id,
        owner.id,
        str(app.id),
    )


def test_masked_profile_not_logged(owner_client, org):
    w = f.WorkerFactory()
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), worker=w, stage="sourced")
    res = owner_client.get(f"/api/v1/org/applications/{app.id}").json()
    assert res["profile_visible"] is False
    assert not ProfileView.objects.filter(worker=w).exists()


def test_ops_retrieve_logs_and_worker_sees_log(staff_client):
    w = worker_with_user()
    staff_client.get(f"/api/v1/ops/workers/{w.id}")
    log_profile_view(w, context="ops", viewer=w.user)  # self-view never logged
    client = auth_client(w.user)
    res = client.get("/api/v1/me/profile-views").json()
    assert res["count"] == 1
    row = res["results"][0]
    assert row["context"] == "ops" and row["organization"] is None and row["context_label"]


# --------------------------------------------------------------------------- /me/trust
def test_me_trust_payload():
    w = worker_with_user(verification_status="unverified")
    f.EmploymentFactory(worker=w, start_date=days_ago(60))
    res = auth_client(w.user).get("/api/v1/me/trust", HTTP_ACCEPT_LANGUAGE="ne").json()
    assert res["reliability_score"] == 60
    assert res["verification_level"] == 0
    assert res["verification_level_label"] == "फोन प्रमाणित"
    assert set(res["breakdown"]) == {
        "employer_feedback",
        "attendance",
        "completion",
        "skills",
        "repeat_hiring",
        "stability",
    }
    assert res["next_steps"] and all(isinstance(s, str) for s in res["next_steps"])


# --------------------------------------------------------------------------- worker → employer rating
def test_worker_rates_employer_rules(org):
    w = worker_with_user()
    client = auth_client(w.user)
    early = f.EmploymentFactory(worker=w, organization=org, start_date=days_ago(10))
    res = client.post(f"/api/v1/me/employments/{early.id}/rate", {"score_a": 5, "score_b": 4}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"

    other = f.OrganizationFactory()
    ok = f.EmploymentFactory(worker=w, organization=other, start_date=days_ago(45))
    res = client.post(f"/api/v1/me/employments/{ok.id}/rate", {"score_a": 5, "score_b": 4}, format="json")
    assert res.status_code == 201 and res.json()["rater"] == "worker"
    res = client.post(f"/api/v1/me/employments/{ok.id}/rate", {"score_a": 1, "score_b": 1}, format="json")
    assert res.json()["error"]["code"] == "duplicate"

    ended = f.EmploymentFactory(
        worker=w,
        organization=f.OrganizationFactory(),
        start_date=days_ago(12),
        end_date=days_ago(2),
        status="ended",
        end_reason="resigned",
    )
    res = client.post(f"/api/v1/me/employments/{ended.id}/rate", {"score_a": 2, "score_b": 3}, format="json")
    assert res.status_code == 201

    someone_else = f.EmploymentFactory(organization=org, start_date=days_ago(90))
    res = client.post(
        f"/api/v1/me/employments/{someone_else.id}/rate", {"score_a": 3, "score_b": 3}, format="json"
    )
    assert res.status_code == 404


def test_employer_reputation_needs_three_ratings(staff_client, org):
    for a, b in [(5, 4), (4, 4)]:
        rate(f.EmploymentFactory(organization=org), a, b, rater="worker")
    rate(f.EmploymentFactory(organization=org), 1, 1, rater="employer")  # employer ratings ignored
    assert employer_reputation(org) is None
    rate(f.EmploymentFactory(organization=org), 3, 2, rater="worker")
    assert employer_reputation(org) == {"pay_on_time_avg": 4.0, "conditions_avg": 3.3, "count": 3}
    res = staff_client.get(f"/api/v1/ops/organizations/{org.id}").json()
    assert res["employer_reputation"]["count"] == 3


# --------------------------------------------------------------------------- disputes
@pytest.fixture
def disputing(org):
    w = worker_with_user()
    emp = f.EmploymentFactory(worker=w, organization=org, start_date=days_ago(60))
    return w, emp, auth_client(w.user)


def test_worker_raises_dispute(disputing, org):
    w, emp, client = disputing
    res = client.post(
        "/api/v1/me/disputes",
        {
            "kind": "attendance",
            "description": "Marked absent but I worked.",
            "employment_id": str(emp.id),
            "attendance_date": str(days_ago(3)),
        },
        format="json",
    )
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["status"] == "open" and body["organization"]["id"] == str(org.id)
    assert body["attendance_date_bs"] and body["kind_label"]
    assert client.get("/api/v1/me/disputes").json()["count"] == 1

    # attendance/wage disputes need an employment; another worker's employment is rejected
    res = client.post("/api/v1/me/disputes", {"kind": "wage", "description": "x"}, format="json")
    assert res.status_code == 400
    stranger = f.EmploymentFactory(organization=org)
    res = client.post(
        "/api/v1/me/disputes",
        {"kind": "wage", "description": "x", "employment_id": str(stranger.id)},
        format="json",
    )
    assert res.status_code == 400 and "employment_id" in res.json()["error"]["fields"]
    # identity disputes need no employer
    res = client.post(
        "/api/v1/me/disputes", {"kind": "identity", "description": "Name spelt wrong"}, format="json"
    )
    assert res.status_code == 201 and res.json()["organization"] is None


def test_dispute_role_permissions(disputing, org, owner_client, make_member, staff_client):
    w, emp, client = disputing
    d = Dispute.objects.create(
        worker=w, organization=org, employment=emp, kind="wage", description="Short paid"
    )
    other_org_dispute = Dispute.objects.create(
        worker=w, organization=f.OrganizationFactory(), kind="other", description="elsewhere"
    )

    # employer manager sees only own org, can respond
    rows = owner_client.get("/api/v1/org/disputes", {"status": "open"}).json()["results"]
    assert [r["id"] for r in rows] == [str(d.id)]
    assert owner_client.get(f"/api/v1/org/disputes/{other_org_dispute.id}").status_code == 404
    _, hr = make_member("hr")
    res = hr.post(f"/api/v1/org/disputes/{d.id}/respond", {"note": "Checked: OT was paid."}, format="json")
    assert res.status_code == 200 and res.json()["status"] == "employer_responded"

    # supervisors cannot see disputes; workers cannot use employer/ops endpoints
    _, sup = make_member("supervisor")
    assert sup.get("/api/v1/org/disputes").status_code == 403
    assert client.get("/api/v1/ops/disputes").status_code == 403
    assert (
        owner_client.post(
            f"/api/v1/ops/disputes/{d.id}/resolve", {"status": "resolved", "note": "x"}
        ).status_code
        == 403
    )

    # ops resolves; no auto-edit; closed disputes are final
    res = staff_client.post(
        f"/api/v1/ops/disputes/{d.id}/resolve",
        {"status": "resolved", "note": "Employer corrected OT."},
        format="json",
    )
    assert res.status_code == 200
    assert res.json()["status"] == "resolved" and res.json()["resolved_by"] is not None
    res = staff_client.post(
        f"/api/v1/ops/disputes/{d.id}/resolve", {"status": "rejected", "note": "x"}, format="json"
    )
    assert res.json()["error"]["code"] == "invalid_state"
    res = owner_client.post(f"/api/v1/org/disputes/{d.id}/respond", {"note": "late"}, format="json")
    assert res.json()["error"]["code"] == "invalid_state"
    assert staff_client.get("/api/v1/ops/disputes", {"status": "resolved"}).json()["count"] == 1


def test_dispute_raised_emits_enterprise_webhook(disputing, org):
    from apps.integrations.models import WebhookDelivery, WebhookEndpoint

    WebhookEndpoint.objects.create(
        organization=org,
        url="https://example.com/hook",
        secret="s",
        events=["dispute.raised"],
        is_active=True,
    )
    _w, emp, client = disputing
    res = client.post(
        "/api/v1/me/disputes",
        {"kind": "wage", "description": "Short paid", "employment_id": str(emp.id)},
        format="json",
    )
    assert res.status_code == 201, res.json()
    delivery = WebhookDelivery.objects.get(event="dispute.raised")
    assert delivery.payload["dispute_id"] == res.json()["id"]
    assert "description" not in delivery.payload  # no free text / personal details in webhooks
