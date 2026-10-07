"""Insights: k-anonymity (5) suppression, labour-market aggregates, org analytics shape, CSV."""

import datetime as dt
from decimal import Decimal as D

import pytest
from django.utils import timezone

from apps.insights import services
from apps.workers.models import WorkerSkill
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def workers_with_trade(n, trade="mason", **kw):
    out = []
    for _ in range(n):
        w = f.WorkerFactory(**kw)
        WorkerSkill.objects.create(worker=w, trade_id=trade, years_experience=2)
        out.append(w)
    return out


def test_k_anonymity_constant():
    assert services.K_ANONYMITY == 5
    assert services.suppress_count(0) == 0
    assert services.suppress_count(4) is None
    assert services.suppress_count(5) == 5


def test_supply_suppresses_small_cells():
    workers_with_trade(3, "mason")
    workers_with_trade(6, "electrician")
    rows = {r["trade"]["code"]: r for r in services.supply()}
    assert rows["mason"]["registered"] is None and rows["mason"]["suppressed"] is True
    assert rows["electrician"]["registered"] == 6 and rows["electrician"]["suppressed"] is False


def test_wage_bands_suppressed_below_five():
    org = f.OrganizationFactory()
    for i, w in enumerate(workers_with_trade(4, "cook")):
        f.EmploymentFactory(organization=org, worker=w, basic_salary=D("13000") + i * 1000)
    rows = services.wage_bands(trade="cook")
    assert (
        len(rows) == 1
        and rows[0]["suppressed"]
        and rows[0]["median_monthly"] is None
        and rows[0]["sample"] is None
    )
    w = workers_with_trade(1, "cook")[0]
    f.EmploymentFactory(organization=org, worker=w, basic_salary=D("20000"))
    row = services.wage_bands(trade="cook")[0]
    assert row["suppressed"] is False and row["sample"] == 5
    # basic + DA 7380: 20380, 21380, 22380, 23380, 27380 → median 22380
    assert row["median_monthly"] == "22380.00"
    assert row["p25"] == "21380.00" and row["p75"] == "23380.00"
    assert row["district"]["code"] == "kathmandu"


def test_origin_districts_pool_small():
    workers_with_trade(5, permanent_district=f.district("gorkha"))
    workers_with_trade(2, permanent_district=f.district("jhapa"))
    workers_with_trade(3, permanent_district=f.district("kaski"))
    rows = services.origin_districts()
    assert rows[0]["district"]["code"] == "gorkha" and rows[0]["workers"] == 5
    assert rows[-1]["district"] is None and rows[-1]["workers"] == 5  # jhapa + kaski pooled
    assert all(r["district"] is None or r["district"]["code"] != "jhapa" for r in rows)


def test_certification_uplift_suppression():
    from tests.test_finance import payslip

    org = f.OrganizationFactory()
    today = timezone.localdate()
    from apps.core.bs import BSMonth

    m = BSMonth.of(today).previous()
    for i in range(5):
        w = f.WorkerFactory()
        WorkerSkill.objects.create(worker=w, trade_id="cook", nstb_level="level2")
        payslip(f.EmploymentFactory(organization=org, worker=w), m.year, m.month, str(25000 + i))
    for i in range(5):
        w = f.WorkerFactory()
        WorkerSkill.objects.create(worker=w, trade_id="cook", nstb_level="none")
        payslip(f.EmploymentFactory(organization=org, worker=w), m.year, m.month, str(20000 + i))
    rows = {r["kind_or_level"]: r for r in services.certification_uplift()}
    assert rows["nstb_level2"]["suppressed"] is False
    assert rows["nstb_level2"]["median_net_with"] == "25002.00"
    assert rows["nstb_level2"]["median_net_without"] == "20002.00"
    assert rows["nstb_level2"]["uplift_pct"] == pytest.approx(25.0, abs=0.1)
    assert rows["nstb_level1"]["suppressed"] is True and rows["nstb_level1"]["median_net_with"] is None


def test_demand_counts_open_positions():
    org = f.OrganizationFactory()
    f.JobFactory(organization=org, trade=f.trade("cook"), openings_count=3, status="open")
    f.JobFactory(organization=org, trade=f.trade("cook"), openings_count=2, status="closed")
    rows = {r["trade"]["code"]: r for r in services.demand()}
    assert rows["cook"]["open_positions"] == 3 and rows["cook"]["open_jobs"] == 1


def test_labour_market_endpoint_and_filters(staff_client):
    workers_with_trade(6, "electrician")
    res = staff_client.get("/api/v1/ops/insights/labour-market?trade=electrician&district=kathmandu")
    assert res.status_code == 200
    body = res.json()
    assert set(body) >= {"wages", "demand", "supply", "shortages", "certification_uplift", "origin_districts"}
    assert body["k_anonymity"] == 5
    assert body["filters"] == {"district": "kathmandu", "trade": "electrician"}
    assert isinstance(body["shortages"], list)
    assert [r["trade"]["code"] for r in body["supply"]] == ["electrician"]


def test_export_csv(staff_client):
    workers_with_trade(6, "electrician")
    res = staff_client.get("/api/v1/ops/insights/export.csv?report=supply")
    assert res.status_code == 200
    assert res["Content-Type"].startswith("text/csv")
    text = res.content.decode("utf-8-sig")
    header = text.splitlines()[0]
    assert "trade" in header and "registered" in header
    assert "electrician" in text
    assert staff_client.get("/api/v1/ops/insights/export.csv?report=nope").status_code == 400


def test_insights_ops_only(owner_client):
    assert owner_client.get("/api/v1/ops/insights/labour-market").status_code == 403


# ----------------------------------------------------------------------------- org analytics
ORG_KEYS = {
    "headcount_trend",
    "attrition_rate",
    "avg_tenure_months",
    "time_to_fill_days_avg",
    "time_to_shortlist_hours_avg",
    "attendance_rate_trend",
    "overtime_hours_trend",
    "wage_bill_trend",
    "cost_per_hire",
    "absenteeism_by_site",
    "top_absence_weekdays",
}


def _attendance(emp, days, status="present", ot=0):
    today = timezone.localdate()
    for i in range(days):
        f.AttendanceFactory(
            employment=emp, date=today - dt.timedelta(days=i + 1), status=status, overtime_minutes=ot
        )


def test_org_analytics_shape(owner_client, org, site):
    today = timezone.localdate()
    emps = [
        f.EmploymentFactory(organization=org, site=site, start_date=today - dt.timedelta(days=200))
        for _ in range(6)
    ]
    for e in emps:
        _attendance(e, 3, ot=60)
        f.AttendanceFactory(employment=e, date=today - dt.timedelta(days=5), status="absent")
    res = owner_client.get("/api/v1/org/analytics?months=3")
    assert res.status_code == 200, res.json()
    body = res.json()
    assert ORG_KEYS <= set(body)
    assert len(body["headcount_trend"]) == 3
    assert {"bs_year", "bs_month", "active", "joined", "left"} <= set(body["headcount_trend"][0])
    assert body["headcount_trend"][-1]["active"] == 6
    assert {"month", "gross", "net", "employer_cost"} <= set(body["wage_bill_trend"][0])
    rated = [r for r in body["attendance_rate_trend"] if r["rate"] is not None]
    assert rated, body["attendance_rate_trend"]
    site_row = body["absenteeism_by_site"][0]
    assert site_row["suppressed"] is False and site_row["absence_rate"] == 25.0
    assert body["top_absence_weekdays"][0]["absences"] >= 1
    assert body["avg_tenure_months"] > 6


def test_org_analytics_suppresses_small_org(owner_client, org, site):
    for _ in range(3):
        e = f.EmploymentFactory(organization=org, site=site)
        _attendance(e, 2)
        f.AttendanceFactory(employment=e, date=timezone.localdate() - dt.timedelta(days=4), status="absent")
    body = owner_client.get("/api/v1/org/analytics").json()
    assert all(r["rate"] is None for r in body["attendance_rate_trend"])
    assert body["absenteeism_by_site"][0]["suppressed"] is True
    assert body["absenteeism_by_site"][0]["absence_rate"] is None
    assert body["top_absence_weekdays"] == []


def test_org_analytics_permissions(make_member, org):
    _u, sup = make_member("supervisor")
    assert sup.get("/api/v1/org/analytics").status_code == 403
    other = f.MembershipFactory(role="owner").user
    assert auth_client(other, org).get("/api/v1/org/analytics").status_code == 403
    _u, hr = make_member("hr")
    assert hr.get("/api/v1/org/analytics?months=99").status_code == 400
