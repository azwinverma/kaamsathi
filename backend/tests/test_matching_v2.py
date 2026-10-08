"""Matching v2 (docs/CONTRACT-EXTENSIONS.md §3): preferred district, outcome bonus, declined-before
penalty, ``explain`` and the 0–100 clamp."""

import datetime as dt
from decimal import Decimal as D

import pytest

from apps.core.bs import today_ad
from apps.hiring.services import match_explain, match_score, outcome_bonus
from tests import factories as f

pytestmark = pytest.mark.django_db


def worker(trade="cook", years=0, nstb="none", district="kathmandu", verified=True, **kw):
    w = f.WorkerFactory(
        current_district=f.district(district),
        verification_status="verified" if verified else "unverified",
        **kw,
    )
    if trade:
        f.WorkerSkillFactory(worker=w, trade=f.trade(trade), years_experience=years, nstb_level=nstb)
    return w


@pytest.fixture
def job(org):
    return f.JobFactory(organization=org, trade=f.trade("cook"), wage_amount=D("20000"))


def employment(w, days, ended=True):
    today = today_ad()
    start = today - dt.timedelta(days=days + (10 if ended else 0))
    return f.EmploymentFactory(
        worker=w,
        start_date=start,
        end_date=start + dt.timedelta(days=days) if ended else None,
        status="ended" if ended else "active",
        end_reason="resigned" if ended else None,
    )


def test_explain_sums_to_score(job):
    w = worker(years=4, nstb="level1")
    score, reasons, explain = match_explain(job, w)
    assert explain == {"trade": 50, "district": 20, "verified": 10, "nstb": 5, "experience": 4}
    assert score == sum(explain.values()) == 89
    assert match_score(job, w) == (score, reasons)


def test_preferred_district_bonus(job):
    w = worker(district="jhapa")
    w.preferred_districts.set([f.district("kathmandu")])
    score, reasons, explain = match_explain(job, w)
    assert explain["preferred_district"] == 5 and "Prefers this area" in reasons
    assert "district" not in explain
    assert score == 50 + 10 + 5


@pytest.mark.parametrize(
    "tenures,bonus",
    [
        ([], 0),
        ([30], 0),
        ([120], 5),
        ([120, 30], 3),  # 2.5 → 3 (half up)
        ([200, 100, 10], 3),  # 3.33 → 3
        ([10, 20, 30, 400], 1),  # 1.25 → 1
    ],
)
def test_outcome_bonus(tenures, bonus):
    w = worker()
    for days in tenures:
        employment(w, days)
    assert outcome_bonus(w) == bonus


def test_active_short_employment_is_not_judged():
    w = worker()
    employment(w, 20, ended=False)  # still there, too early to tell
    assert outcome_bonus(w) == 0
    employment(w, 100, ended=False)
    assert outcome_bonus(w) == 5


def test_outcome_bonus_in_score(job):
    w = worker(district="jhapa", verified=False)
    employment(w, 200)
    score, reasons, explain = match_explain(job, w)
    assert explain["outcomes"] == 5 and "Stays in jobs" in reasons
    assert score == 55


def test_declined_employer_before(job, org):
    w = worker()
    other_job = f.JobFactory(organization=org, trade=f.trade("cook"))
    f.ApplicationFactory(job=other_job, worker=w, stage="dropped", worker_response="declined")
    score, reasons, explain = match_explain(job, w)
    assert explain["declined_before"] == -10 and "Declined this employer before" in reasons
    assert score == 50 + 20 + 10 - 10
    # same answer through the precomputed set used by the matches endpoint
    assert match_explain(job, w, declined_ids={w.pk})[0] == score
    assert match_explain(job, w, declined_ids=set())[0] == score + 10


def test_clamp_top_and_bottom(job, org):
    best = worker(years=12, nstb="level3")
    best.preferred_districts.set([f.district("kathmandu")])
    employment(best, 400)
    score, _, explain = match_explain(job, best)
    assert sum(explain.values()) > 100 and score == 100

    worst = worker(trade=None, district="jhapa", verified=False, expected_monthly_wage=D("50000"))
    f.ApplicationFactory(
        job=f.JobFactory(organization=org), worker=worst, stage="dropped", worker_response="declined"
    )
    score, _, explain = match_explain(job, worst)
    assert sum(explain.values()) == -20 and score == 0


def test_matches_endpoint_has_explain(staff_client, job):
    w = worker(years=3)
    w.preferred_districts.set([f.district("kathmandu")])
    rows = staff_client.get(f"/api/v1/ops/jobs/{job.id}/matches").json()
    row = next(r for r in rows if r["worker"]["id"] == str(w.id))
    assert row["explain"]["preferred_district"] == 5
    assert row["score"] == sum(row["explain"].values()) == 88
    assert row["interested"] is False
