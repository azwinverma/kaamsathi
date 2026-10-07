"""Minimum-wage validation, application stage machine, join → Employment + placement Charge."""

import datetime as dt
from decimal import Decimal as D

import pytest

from apps.billing.models import Charge
from apps.hiring.models import Application, StageEvent
from apps.workforce.models import Employment
from tests import factories as f

pytestmark = pytest.mark.django_db

JOIN_MONTHLY = {
    "start_date": "2026-08-01",
    "wage_type": "monthly",
    "basic_salary": "12170.00",
    "dearness_allowance": "7380.00",
    "ssf_enrolled": True,
}


def job_payload(**kw):
    return {
        "title": "Cook",
        "trade": "cook",
        "openings_count": 1,
        "wage_type": "monthly",
        "wage_amount": "19550.00",
        **kw,
    }


# --- minimum wage: jobs ------------------------------------------------------------


@pytest.mark.parametrize(
    "wage_type,amount,ok",
    [
        ("monthly", "19550.00", True),
        ("monthly", "19549.99", False),
        ("daily", "754.00", True),
        ("daily", "753.99", False),
    ],
)
def test_job_minimum_wage(owner_client, wage_type, amount, ok):
    res = owner_client.post(
        "/api/v1/org/jobs", job_payload(wage_type=wage_type, wage_amount=amount), format="json"
    )
    if ok:
        assert res.status_code == 201, res.json()
        body = res.json()
        assert body["status"] == "draft"
        assert body["trade"]["code"] == "cook"
        assert set(body["counts"]) == {
            "sourced",
            "shortlisted",
            "interview",
            "selected",
            "joined",
            "rejected",
            "dropped",
        }
    else:
        assert res.status_code == 400
        err = res.json()["error"]
        assert err["code"] == "below_minimum_wage"
        assert "wage_amount" in err["fields"]


def test_job_patch_below_minimum(owner_client, org):
    job = f.JobFactory(organization=org, status="draft")
    res = owner_client.patch(f"/api/v1/org/jobs/{job.id}", {"wage_amount": "15000"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "below_minimum_wage"


def test_job_publish_close_and_delete_rules(owner_client, org):
    job = f.JobFactory(organization=org, status="draft")
    res = owner_client.post(f"/api/v1/org/jobs/{job.id}/publish")
    assert res.status_code == 200 and res.json()["status"] == "open" and res.json()["published_at"]
    res = owner_client.post(f"/api/v1/org/jobs/{job.id}/publish")
    assert res.json()["error"]["code"] == "invalid_state"
    res = owner_client.delete(f"/api/v1/org/jobs/{job.id}")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"
    assert owner_client.post(f"/api/v1/org/jobs/{job.id}/close").json()["status"] == "closed"
    draft = f.JobFactory(organization=org, status="draft")
    assert owner_client.delete(f"/api/v1/org/jobs/{draft.id}").status_code == 204


# --- minimum wage: employments -------------------------------------------------------


def emp_payload(**kw):
    return {
        "worker": {"phone": "9841000001", "full_name": "Hari Bahadur"},
        "designation": "Helper",
        "start_date": "2026-08-01",
        "ssf_enrolled": False,
        **kw,
    }


@pytest.mark.parametrize(
    "wage,ok",
    [
        ({"wage_type": "monthly", "basic_salary": "12170", "dearness_allowance": "7380"}, True),
        ({"wage_type": "monthly", "basic_salary": "15000", "dearness_allowance": "4549.99"}, False),
        ({"wage_type": "daily", "daily_wage": "754"}, True),
        ({"wage_type": "daily", "daily_wage": "700"}, False),
    ],
)
def test_employment_minimum_wage(owner_client, wage, ok):
    res = owner_client.post("/api/v1/org/employments", emp_payload(**wage), format="json")
    if ok:
        assert res.status_code == 201, res.json()
        assert res.json()["worker"]["phone_masked"] == "98XXXXX001"
        assert res.json()["start_date_bs"] == "2083-04-16"
    else:
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "below_minimum_wage"


def test_employment_monthly_requires_basic_and_da(owner_client):
    res = owner_client.post(
        "/api/v1/org/employments", emp_payload(wage_type="monthly", basic_salary="20000"), format="json"
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "validation_error"
    assert "dearness_allowance" in res.json()["error"]["fields"]


def test_employment_patch_below_minimum(owner_client, org):
    emp = f.EmploymentFactory(organization=org)
    res = owner_client.patch(f"/api/v1/org/employments/{emp.id}", {"basic_salary": "10000"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "below_minimum_wage"
    res = owner_client.patch(
        f"/api/v1/org/employments/{emp.id}", {"wage_type": "daily", "daily_wage": "500"}, format="json"
    )
    assert res.json()["error"]["code"] == "below_minimum_wage"


def test_one_active_employment_per_org(owner_client, org):
    worker = f.WorkerFactory()
    f.EmploymentFactory(organization=org, worker=worker)
    res = owner_client.post(
        "/api/v1/org/employments",
        {
            "worker_id": str(worker.id),
            "designation": "x",
            "start_date": "2026-08-01",
            "wage_type": "daily",
            "daily_wage": "800",
        },
        format="json",
    )
    assert res.status_code == 400 and res.json()["error"]["code"] == "duplicate"


# --- application stage machine ----------------------------------------------------------


def move(client, app, stage, **kw):
    return client.post(f"/api/v1/org/applications/{app.id}/move", {"stage": stage, **kw}, format="json")


ALLOWED = [
    ("sourced", "shortlisted"),
    ("sourced", "rejected"),
    ("shortlisted", "interview"),
    ("shortlisted", "selected"),
    ("shortlisted", "rejected"),
    ("shortlisted", "dropped"),
    ("interview", "selected"),
    ("interview", "rejected"),
    ("interview", "dropped"),
    ("selected", "dropped"),
]
FORBIDDEN = [
    ("sourced", "interview"),
    ("sourced", "selected"),
    ("sourced", "joined"),
    ("sourced", "dropped"),
    ("shortlisted", "joined"),
    ("interview", "joined"),
    ("interview", "shortlisted"),
    ("selected", "rejected"),
    ("selected", "interview"),
    ("joined", "dropped"),
    ("rejected", "shortlisted"),
    ("dropped", "shortlisted"),
    ("rejected", "sourced"),
]


@pytest.mark.parametrize("src,dst", ALLOWED)
def test_allowed_transitions(owner_client, org, src, dst):
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage=src)
    res = move(owner_client, app, dst, note="ok")
    assert res.status_code == 200, res.json()
    assert res.json()["application"]["stage"] == dst
    assert res.json()["employment_id"] is None
    assert StageEvent.objects.filter(application=app, from_stage=src, to_stage=dst).exists()


@pytest.mark.parametrize("src,dst", FORBIDDEN)
def test_forbidden_transitions(owner_client, org, src, dst):
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage=src)
    extra = {"employment": JOIN_MONTHLY} if dst == "joined" else {}
    res = move(owner_client, app, dst, **extra)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_state"
    app.refresh_from_db()
    assert app.stage == src


def test_join_requires_employment(owner_client, org):
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="selected")
    res = move(owner_client, app, "joined")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "validation_error"
    assert "employment" in res.json()["error"]["fields"]


def test_join_below_minimum_wage(owner_client, org):
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="selected")
    res = move(owner_client, app, "joined", employment={**JOIN_MONTHLY, "basic_salary": "1000"})
    assert res.status_code == 400 and res.json()["error"]["code"] == "below_minimum_wage"
    assert not Employment.objects.filter(application=app).exists()


def test_join_creates_employment_charge_and_fills_job(owner_client, org, site):
    job = f.JobFactory(organization=org, openings_count=2, site=site, title="Line cook")
    a1 = f.ApplicationFactory(job=job, stage="selected")
    a2 = f.ApplicationFactory(job=job, stage="selected")

    res = move(owner_client, a1, "joined", employment=JOIN_MONTHLY)
    assert res.status_code == 200, res.json()
    emp = Employment.objects.get(pk=res.json()["employment_id"])
    assert emp.application == a1 and emp.worker == a1.worker and emp.organization == org
    assert emp.site == site and emp.trade_id == "cook" and emp.designation == "Line cook"
    assert emp.ssf_enrolled and emp.basic_salary == D("12170.00")
    assert emp.replacement_eligible_until == dt.date(2026, 8, 31)
    charge = Charge.objects.get(application=a1)
    assert charge.kind == "placement" and charge.amount == D("5000.00") and charge.status == "unpaid"
    job.refresh_from_db()
    assert job.status == "open"

    move(owner_client, a2, "joined", employment={**JOIN_MONTHLY, "wage_type": "daily", "daily_wage": "800"})
    job.refresh_from_db()
    assert job.status == "filled"


def test_replacement_within_window_is_waived(owner_client, org):
    job = f.JobFactory(organization=org, openings_count=1)
    first = f.ApplicationFactory(job=job, stage="selected")
    emp_id = move(owner_client, first, "joined", employment=JOIN_MONTHLY).json()["employment_id"]
    res = owner_client.post(
        f"/api/v1/org/employments/{emp_id}/end",
        {"end_date": "2026-08-20", "end_reason": "absconded"},
        format="json",
    )
    assert res.status_code == 200, res.json()

    job2 = f.JobFactory(organization=org)
    second = f.ApplicationFactory(job=job2, stage="selected")
    move(owner_client, second, "joined", employment={**JOIN_MONTHLY, "start_date": "2026-08-25"})
    charge = Charge.objects.get(application=second)
    assert charge.status == "waived"
    assert str(charge.replaces_employment_id) == emp_id

    # the ended employment can only be replaced once
    job3 = f.JobFactory(organization=org)
    third = f.ApplicationFactory(job=job3, stage="selected")
    move(owner_client, third, "joined", employment={**JOIN_MONTHLY, "start_date": "2026-08-26"})
    assert Charge.objects.get(application=third).status == "unpaid"


def test_replacement_after_window_is_charged(owner_client, org):
    job = f.JobFactory(organization=org)
    first = f.ApplicationFactory(job=job, stage="selected")
    emp_id = move(owner_client, first, "joined", employment=JOIN_MONTHLY).json()["employment_id"]
    owner_client.post(
        f"/api/v1/org/employments/{emp_id}/end",
        {"end_date": "2026-09-15", "end_reason": "resigned"},
        format="json",
    )  # > start+30
    second = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="selected")
    move(owner_client, second, "joined", employment={**JOIN_MONTHLY, "start_date": "2026-09-20"})
    assert Charge.objects.get(application=second).status == "unpaid"


def test_direct_onboarding_has_no_replacement_window(owner_client):
    res = owner_client.post(
        "/api/v1/org/employments", emp_payload(wage_type="daily", daily_wage="800"), format="json"
    )
    assert res.json()["replacement_eligible_until"] is None
    assert Charge.objects.count() == 0


def test_application_list_filters_and_scoping(owner_client, org):
    job = f.JobFactory(organization=org)
    f.ApplicationFactory(job=job, stage="sourced")
    f.ApplicationFactory(job=job, stage="interview")
    f.ApplicationFactory(job=f.JobFactory())  # other org
    res = owner_client.get("/api/v1/org/applications")
    assert res.json()["count"] == 2
    res = owner_client.get("/api/v1/org/applications", {"stage": "interview"})
    assert res.json()["count"] == 1 and res.json()["results"][0]["stage_label"]
    other = Application.objects.exclude(job__organization=org).get()
    assert owner_client.get(f"/api/v1/org/applications/{other.id}").status_code == 404


# --- consent-gated WorkerProfile ------------------------------------------------------------


def detail(client, app):
    return client.get(f"/api/v1/org/applications/{app.id}").json()


def test_sourced_without_consent_shows_card_only(owner_client, org):
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="sourced")
    data = detail(owner_client, app)
    assert data["profile_visible"] is False
    assert "phone" not in data["worker"] and "history" not in data["worker"]
    assert data["worker"]["phone_masked"].startswith("98XXXXX")


def test_sourced_with_profile_share_consent_shows_profile(owner_client, org):
    from apps.workers.models import Consent

    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="sourced")
    Consent.objects.create(worker=app.worker, organization=org, scope="profile_share", granted=True)
    data = detail(owner_client, app)
    assert data["profile_visible"] is True
    assert data["worker"]["phone"] == app.worker.phone
    assert "history" in data["worker"]


def test_consent_latest_row_wins(owner_client, org):
    from apps.workers.models import Consent

    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="sourced")
    Consent.objects.create(worker=app.worker, organization=org, scope="profile_share", granted=True)
    Consent.objects.create(worker=app.worker, organization=org, scope="profile_share", granted=False)
    assert detail(owner_client, app)["profile_visible"] is False


def test_consent_for_other_org_does_not_apply(owner_client, org):
    from apps.workers.models import Consent

    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="sourced")
    Consent.objects.create(
        worker=app.worker, organization=f.OrganizationFactory(), scope="profile_share", granted=True
    )
    assert detail(owner_client, app)["profile_visible"] is False


def test_shortlisted_shows_profile_and_events(owner_client, org):
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="sourced")
    move(owner_client, app, "shortlisted", note="good fit")
    data = detail(owner_client, app)
    assert data["profile_visible"] is True
    assert data["worker"]["phone"] == app.worker.phone
    assert [e["to_stage"] for e in data["events"]] == ["shortlisted"]


def test_rejected_straight_from_sourced_stays_hidden(owner_client, org):
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="sourced")
    move(owner_client, app, "rejected", rejection_reason="no")
    assert detail(owner_client, app)["profile_visible"] is False


def test_rejected_after_shortlist_shows_profile(owner_client, org):
    app = f.ApplicationFactory(job=f.JobFactory(organization=org), stage="sourced")
    move(owner_client, app, "shortlisted")
    move(owner_client, app, "rejected")
    assert detail(owner_client, app)["profile_visible"] is True
