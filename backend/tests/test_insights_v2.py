"""Insights v2: district heatmap (k-anonymity), platform KPIs + phase-1 exit criteria, /me/career."""

import datetime as dt
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.billing.models import Charge
from apps.hiring.models import StageEvent
from apps.insights.intelligence import heatmap, kpis
from apps.workers.models import Rating
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def make_staff():
    user = f.UserFactory(is_staff=True)
    try:
        from apps.accounts.models import StaffProfile

        StaffProfile.objects.create(user=user, roles=["verifier"])
    except ImportError:
        pass
    return user


def cell(data, code):
    return next(c for c in data["cells"] if c["district"]["code"] == code)


def cooks(n, district_code):
    for _ in range(n):
        w = f.WorkerFactory(current_district=f.district(district_code))
        f.WorkerSkillFactory(worker=w, trade=f.trade("cook"))


# ----------------------------------------------------------------------------- heatmap
def test_heatmap_supply_and_shortage_suppression():
    cooks(3, "kaski")
    cooks(5, "kathmandu")
    org = f.OrganizationFactory()  # Kathmandu
    f.JobFactory(organization=org, trade=f.trade("cook"), openings_count=8)
    f.JobFactory(
        organization=org,
        site=f.SiteFactory(organization=org, district=f.district("kaski")),
        trade=f.trade("cook"),
        openings_count=10,
    )

    supply = heatmap("supply", "cook")
    assert supply["k_anonymity"] == 5 and supply["trade"]["code"] == "cook"
    assert len(supply["cells"]) == 77
    assert cell(supply, "kaski")["value"] is None
    assert cell(supply, "kaski")["suppressed"] is True
    assert cell(supply, "kathmandu")["value"] == 5 and cell(supply, "kathmandu")["suppressed"] is False
    assert cell(supply, "jhapa")["value"] == 0 and cell(supply, "jhapa")["suppressed"] is False
    assert cell(supply, "kathmandu")["district"]["province"]["code"] == 3

    shortage = heatmap("shortage", "cook")
    assert cell(shortage, "kaski")["value"] is None and cell(shortage, "kaski")["suppressed"]
    assert cell(shortage, "kathmandu")["value"] == 3

    demand = heatmap("demand", "cook")
    assert cell(demand, "kaski")["value"] == 10 and cell(demand, "kathmandu")["value"] == 8
    assert demand["max"] == 10


def test_heatmap_median_wage_suppression():
    org = f.OrganizationFactory()
    for _ in range(4):
        f.EmploymentFactory(organization=org, start_date=timezone.localdate())
    data = heatmap("median_wage")
    assert cell(data, "kathmandu")["value"] is None and cell(data, "kathmandu")["suppressed"] is True
    f.EmploymentFactory(organization=org, start_date=timezone.localdate())
    data = heatmap("median_wage")
    c = cell(data, "kathmandu")
    assert c["value"] == "19550.00" and c["sample"] == 5 and c["suppressed"] is False


def test_heatmap_endpoint_validation():
    client = auth_client(make_staff())
    assert client.get("/api/v1/ops/insights/heatmap?metric=bogus").status_code == 400
    r = client.get("/api/v1/ops/insights/heatmap?metric=demand")
    assert r.status_code == 200 and r.json()["metric"] == "demand"
    assert auth_client(f.UserFactory()).get("/api/v1/ops/insights/heatmap").status_code == 403


# ----------------------------------------------------------------------------- KPIs
def _joined(job, worker, at):
    app = f.ApplicationFactory(job=job, worker=worker, stage="joined")
    ev = StageEvent.objects.create(application=app, from_stage="selected", to_stage="joined")
    StageEvent.objects.filter(pk=ev.pk).update(created_at=at)
    return app


def test_kpi_math():
    now = timezone.now()
    org = f.OrganizationFactory()
    w1, w2, w_old, w_idle = (f.WorkerFactory() for _ in range(4))

    job1 = f.JobFactory(
        organization=org,
        openings_count=2,
        published_at=now - dt.timedelta(days=10),
        first_shortlist_at=now - dt.timedelta(days=10) + dt.timedelta(hours=12),
    )
    job2 = f.JobFactory(
        organization=org,
        openings_count=2,
        published_at=now - dt.timedelta(days=5),
        first_shortlist_at=now - dt.timedelta(days=5) + dt.timedelta(hours=36),
    )
    assert job2
    _joined(job1, w1, now - dt.timedelta(days=4))  # 6 days to fill
    _joined(job1, w2, now - dt.timedelta(days=2))  # 8 days to fill
    old_job = f.JobFactory(organization=org, status="filled", published_at=now - dt.timedelta(days=130))
    _joined(old_job, w_old, now - dt.timedelta(days=100))  # before the window → repeat employer

    Charge.objects.create(
        organization=org, kind="placement", amount=Decimal("5000"), description="a", status="paid"
    )
    Charge.objects.create(
        organization=org, kind="placement", amount=Decimal("3000"), description="b", status="waived"
    )
    old = Charge.objects.create(organization=org, kind="placement", amount=Decimal("2000"), description="c")
    Charge.objects.filter(pk=old.pk).update(created_at=now - dt.timedelta(days=60))

    from apps.workers.models import Worker

    Worker.objects.filter(pk__in=[w1.pk, w2.pk]).update(verified_at=now - dt.timedelta(days=1))
    emp = f.EmploymentFactory(
        organization=org, worker=w1, start_date=timezone.localdate() - dt.timedelta(days=3)
    )
    Rating.objects.create(employment=emp, rater="employer", score_a=4, score_b=5)
    Rating.objects.create(employment=emp, rater="worker", score_a=3, score_b=3)

    now = timezone.now()  # after fixtures (charges are timestamped at creation)
    k = kpis(30, now=now)
    assert k["placements"] == 2
    assert k["time_to_fill_days_median"] == 7.0
    assert k["time_to_shortlist_hours_median"] == 24.0
    assert k["fill_rate"] == 0.5  # 2 of 4 positions on jobs published in the window
    assert k["placement_revenue"] == "5000.00"
    assert k["repeat_employer_rate"] == 1.0
    assert k["worker_activation_rate"] == 0.75  # w1, w2, w_old joined; w_idle not
    assert k["verified_workers_added"] == 2
    assert k["dispute_rate"] == 0.0
    assert k["avg_employer_rating_of_workers"] == 4.5
    assert k["avg_worker_rating_of_employers"] == 3.0

    exit_ = {r["key"]: r for r in k["phase1_exit"]}
    assert set(exit_) == {
        "workers",
        "organizations",
        "paying_organizations",
        "placements",
        "median_fill_days",
    }
    assert exit_["workers"] == {
        "key": "workers",
        "target": 1000,
        "actual": 4,
        "comparator": "gte",
        "met": False,
    }
    assert exit_["paying_organizations"]["actual"] == 1
    assert exit_["placements"]["actual"] == 3
    assert exit_["median_fill_days"]["met"] is True and exit_["median_fill_days"]["comparator"] == "lt"
    assert k["phase1_exit_met"] is False

    k365 = kpis(365, now=now)
    assert k365["placements"] == 3 and k365["repeat_employer_rate"] == 0.0


def test_kpi_empty_and_endpoint():
    k = kpis(30)
    assert k["placements"] == 0 and k["fill_rate"] is None and k["time_to_fill_days_median"] is None
    assert next(r for r in k["phase1_exit"] if r["key"] == "median_fill_days")["met"] is False
    client = auth_client(make_staff())
    assert client.get("/api/v1/ops/kpis?days=7").status_code == 400
    r = client.get("/api/v1/ops/kpis?days=90")
    assert r.status_code == 200 and r.json()["days"] == 90


# ----------------------------------------------------------------------------- career
def test_career_recommendations_shape():
    from apps.training.models import Course, TrainingProvider

    user = f.UserFactory()
    worker = f.WorkerFactory(user=user, phone=user.phone, verification_status="unverified")
    f.WorkerSkillFactory(worker=worker, trade=f.trade("cook"), nstb_level="level1")
    org = f.OrganizationFactory()
    f.JobFactory(organization=org, trade=f.trade("electrician"), openings_count=5)
    f.JobFactory(organization=org, trade=f.trade("mason"), openings_count=4)
    provider = TrainingProvider.objects.create(
        name="Test Institute", kind="private", district=f.district("kathmandu"), phone="014000000"
    )
    course = Course.objects.create(
        provider=provider,
        trade=f.trade("electrician"),
        title="House wiring",
        duration_days=30,
        district=f.district("kathmandu"),
        starts_on=timezone.localdate() + dt.timedelta(days=10),
    )

    r = auth_client(user).get("/api/v1/me/career")
    assert r.status_code == 200, r.content
    data = r.json()
    assert data["trades"][0]["code"] == "cook" and data["trades"][0]["nstb_level"] == "level1"
    recs = data["recommendations"]
    required = {"kind", "title", "title_ne", "reason", "expected_uplift_pct", "link"}
    for rec in recs:
        assert required <= set(rec)
        assert rec["kind"] in {"credential", "course", "skill", "profile"}
    keys = {r["key"] for r in recs}
    assert "verify_identity" in keys and "add_credential" in keys
    assert "nstb_level2_cook" in keys
    course_rec = next(r for r in recs if r["kind"] == "course")
    assert course_rec["course_id"] == str(course.id)
    assert any(r["kind"] == "skill" and r["key"] == "skill_mason" for r in recs)


def test_career_requires_worker():
    assert auth_client(f.UserFactory()).get("/api/v1/me/career").status_code == 404
