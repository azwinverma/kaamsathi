"""Ops matching score + shortlist (CONTRACT §3 Ops console)."""

from decimal import Decimal as D

import pytest

from apps.hiring.models import Application, StageEvent
from apps.hiring.services import match_score
from tests import factories as f

pytestmark = pytest.mark.django_db


def worker(trade="cook", years=0, nstb="none", district="kathmandu", verified=True, expected=None, **kw):
    w = f.WorkerFactory(
        current_district=f.district(district),
        verification_status="verified" if verified else "unverified",
        expected_monthly_wage=expected,
        **kw,
    )
    if trade:
        f.WorkerSkillFactory(worker=w, trade=f.trade(trade), years_experience=years, nstb_level=nstb)
    return w


@pytest.fixture
def job(org):
    return f.JobFactory(organization=org, trade=f.trade("cook"), wage_amount=D("20000"))


@pytest.mark.parametrize(
    "kw,score,reasons",
    [
        (
            dict(years=8, nstb="level2"),
            98,
            ["Trade match", "Same district", "Verified", "NSTB Level 2", "8 yrs experience"],
        ),
        (dict(years=12, nstb="level3"), 100, None),  # 50+20+10+15+10 = 105 → capped
        (dict(years=4, nstb="level1", district="lalitpur"), 69, None),  # 50+10+5+4
        (dict(years=15, district="lalitpur", verified=False), 60, None),  # experience capped at 10
        (dict(trade="mason", years=10, nstb="level3"), 30, ["Same district", "Verified"]),  # no trade pts
        (dict(trade=None, district="jhapa", verified=False), 0, []),
        (dict(years=2, expected=D("25000")), 72, None),  # 50+20+10+2−10
        (dict(trade=None, verified=False, district="jhapa", expected=D("25000")), 0, None),  # floor 0
    ],
)
def test_match_score_formula(job, kw, score, reasons):
    s, r = match_score(job, worker(**kw))
    assert s == score
    if reasons is not None:
        assert r == reasons


def test_match_uses_site_district_and_daily_offer(org):
    site = f.SiteFactory(organization=org, district=f.district("kaski"))
    job = f.JobFactory(organization=org, site=site, wage_type="daily", wage_amount=D("800"))  # 24000/month
    assert match_score(job, worker(district="kaski", expected=D("24000")))[0] == 80
    assert match_score(job, worker(district="kaski", expected=D("24001")))[0] == 70
    assert match_score(job, worker(district="kathmandu"))[0] == 60


def test_matches_endpoint_filters_and_orders(staff_client, job, org):
    best = worker(years=8, nstb="level2")
    mid = worker(district="lalitpur")
    in_pipeline = worker(years=10)
    f.ApplicationFactory(job=job, worker=in_pipeline)
    worker(years=10, is_available=False)
    employed_here = worker(years=10)
    f.EmploymentFactory(organization=org, worker=employed_here)

    res = staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches", {"limit": 5})
    assert res.status_code == 200
    rows = res.json()
    ids = [r["worker"]["id"] for r in rows]
    assert ids[:2] == [str(best.id), str(mid.id)]
    assert str(in_pipeline.id) not in ids and str(employed_here.id) not in ids
    assert rows[0]["score"] == 98 and "Trade match" in rows[0]["reasons"]
    assert set(rows[0]["worker"]) >= {
        "id",
        "full_name",
        "phone_masked",
        "verification_status",
        "district",
        "skills",
        "total_experience_years",
        "rating_avg",
        "placements_count",
    }
    assert len(staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches", {"limit": 1}).json()) == 1


def test_shortlist_creates_applications(staff_client, job):
    w1, w2 = worker(), worker()
    res = staff_client.post(
        f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(w1.id), str(w2.id)]}, format="json"
    )
    assert res.status_code == 201, res.json()
    assert res.json()["created"] == 2
    assert set(Application.objects.filter(job=job).values_list("stage", flat=True)) == {"shortlisted"}
    assert StageEvent.objects.filter(application__job=job, to_stage="shortlisted").count() == 2
    job.refresh_from_db()
    first = job.first_shortlist_at
    assert first is not None

    # again: idempotent, first_shortlist_at unchanged
    res = staff_client.post(
        f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(w1.id)]}, format="json"
    )
    assert res.status_code == 200 and res.json()["created"] == 0
    job.refresh_from_db()
    assert job.first_shortlist_at == first


def test_shortlist_validation(staff_client, job):
    import uuid

    res = staff_client.post(f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": []}, format="json")
    assert res.json()["error"]["code"] == "validation_error"
    res = staff_client.post(
        f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(uuid.uuid4())]}, format="json"
    )
    assert res.json()["error"]["code"] == "validation_error"


def test_shortlisted_profile_visible_to_employer(staff_client, owner_client, job):
    w = worker()
    staff_client.post(f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(w.id)]}, format="json")
    app = Application.objects.get(job=job, worker=w)
    data = owner_client.get(f"/api/v1/org/applications/{app.id}").json()
    assert data["profile_visible"] is True and data["worker"]["phone"] == w.phone


def test_ops_jobs_list_includes_org(staff_client, job, org):
    rows = staff_client.get("/api/v1/ops/jobs", {"status": "open"}).json()["results"]
    assert rows[0]["organization"] == {"id": str(org.id), "name": org.name}
    assert "hours_open" in rows[0]
