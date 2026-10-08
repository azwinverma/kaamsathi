"""GET /org/employments/{id}/history — newest-first work record (CONTRACT-EXTENSIONS §8)."""

import datetime as dt
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.compliance import services as compliance
from apps.trust.models import Dispute
from apps.workers.models import Rating
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def url(emp):
    return f"/api/v1/org/employments/{emp.id}/history"


@pytest.fixture
def emp(org, site):
    return f.EmploymentFactory(organization=org, site=site, start_date=dt.date(2025, 1, 1))


def types(res):
    return [e["type"] for e in res.json()["results"]]


def test_history_collects_every_kind_newest_first(owner_client, owner, org, site, emp):
    # Wage change through the audited PATCH: before → after captured.
    r = owner_client.patch(url(emp).replace("/history", ""), {"basic_salary": "15000.00"}, format="json")
    assert r.status_code == 200, r.json()
    other = f.SiteFactory(organization=org, name="Second kitchen")
    r = owner_client.patch(
        url(emp).replace("/history", ""),
        {"site_id": str(other.id), "designation": "Head cook"},
        format="json",
    )
    assert r.status_code == 200, r.json()

    contract, _ = compliance.generate_contract(emp, user=owner)
    compliance.accept_contract(contract, "paper")
    r = owner_client.post(
        "/api/v1/org/advances",
        {
            "employment_id": str(emp.id),
            "amount": "5000",
            "given_on": timezone.localdate().isoformat(),
            "recover_per_month": "1000",
        },
        format="json",
    )
    assert r.status_code == 201, r.json()
    d = Dispute.objects.create(
        worker=emp.worker, organization=org, employment=emp, kind="wage", description="x"
    )
    d.status, d.resolved_at, d.resolution_note = "resolved", timezone.now(), "Paid"
    d.save()
    r = owner_client.post(
        f"{url(emp).replace('/history', '')}/rate", {"score_a": 4, "score_b": 5, "comment": "Good"}
    )
    assert r.status_code == 201, r.json()
    Rating.objects.create(employment=emp, rater="worker", score_a=1, score_b=1, comment="worker's view")

    res = owner_client.get(url(emp))
    assert res.status_code == 200, res.json()
    body = res.json()
    got = types(res)
    assert got[-1] == "employment_started"
    assert set(got) == {
        "employment_started",
        "wage_changed",
        "site_changed",
        "designation_changed",
        "contract_issued",
        "contract_accepted",
        "advance_given",
        "dispute_opened",
        "dispute_resolved",
        "rating_given",
    }
    stamps = [e["at"] for e in body["results"] if "T" in e["at"]]
    assert stamps == sorted(stamps, reverse=True)

    by = {e["type"]: e for e in body["results"]}
    wage = by["wage_changed"]
    assert wage["detail"]["changes"]["basic_salary"] == {"from": "12170.00", "to": "15000.00"}
    assert wage["detail"]["monthly_gross"] == {"from": "19550.00", "to": "22380.00"}
    assert wage["actor"] == {"id": str(owner.id), "full_name": owner.full_name}
    assert wage["at_bs"] and wage["title"]
    assert by["site_changed"]["detail"]["to"] == {"id": str(other.id), "name": "Second kitchen"}
    assert by["site_changed"]["detail"]["from"]["id"] == str(site.id)
    assert by["designation_changed"]["detail"] == {"from": "Cook", "to": "Head cook"}
    started = by["employment_started"]["detail"]  # as on day one, not today's site
    assert started == {"site": {"id": str(site.id), "name": site.name}, "designation": "Cook"}
    assert by["contract_issued"]["detail"]["version"] == 1
    assert by["contract_issued"]["actor"]["id"] == str(owner.id)
    assert by["contract_accepted"]["detail"]["channel"] == "paper"
    assert by["advance_given"]["detail"]["amount"] == "5000.00"
    assert by["advance_given"]["actor"]["id"] == str(owner.id)
    assert by["dispute_resolved"]["actor"] is None  # KaamSathi staff are never named
    rating = by["rating_given"]["detail"]
    assert (rating["score_a"], rating["score_b"], rating["comment"]) == (4, 5, "Good")
    assert rating["comment_status"] == "visible"
    # Only the employer's own rating — never the worker's rating of the employer.
    assert [e for e in body["results"] if e["type"] == "rating_given"] == [by["rating_given"]]
    assert "worker's view" not in str(body)


def test_history_ended_and_pagination(owner_client, emp):
    for amount in ("13000", "14000", "15000"):
        owner_client.patch(url(emp).replace("/history", ""), {"basic_salary": amount}, format="json")
    r = owner_client.post(
        url(emp).replace("/history", "/end"),
        {"end_date": timezone.localdate().isoformat(), "end_reason": "resigned"},
        format="json",
    )
    assert r.status_code == 200, r.json()
    res = owner_client.get(url(emp), {"page_size": 2})
    body = res.json()
    assert body["count"] == 5 and len(body["results"]) == 2
    assert body["results"][0]["type"] == "employment_ended"  # end date sorts as end of that day
    assert body["results"][0]["detail"]["end_reason"] == "resigned"
    assert body["results"][1]["type"] == "wage_changed"
    assert body["results"][1]["detail"]["changes"]["basic_salary"] == {"from": "14000.00", "to": "15000.00"}
    page2 = owner_client.get(url(emp), {"page_size": 2, "page": 2}).json()["results"]
    assert page2[0]["detail"]["changes"]["basic_salary"] == {"from": "13000.00", "to": "14000.00"}


def test_history_cross_org_is_404(emp):
    stranger = f.MembershipFactory(role="owner")
    client = auth_client(stranger.user, stranger.organization)
    assert client.get(url(emp)).status_code == 404


def test_history_supervisor_scope(org, site, emp, make_member):
    _, own = make_member("supervisor", sites=[site])
    assert own.get(url(emp)).status_code == 200
    _, elsewhere = make_member("supervisor", sites=[f.SiteFactory(organization=org)])
    assert elsewhere.get(url(emp)).status_code == 404
    _, hr = make_member("hr")
    assert hr.get(url(emp)).status_code == 200


def test_history_ignores_other_orgs_audit_rows(owner_client, org, emp):
    """An audit row with the same object id but another org never leaks in."""
    from apps.audit.models import AuditLog

    other = f.OrganizationFactory()
    AuditLog.objects.create(
        organization=other,
        action="employment.update",
        object_type="employment",
        object_id=str(emp.id),
        changes={"basic_salary": {"from": "1.00", "to": "2.00"}},
    )
    assert "wage_changed" not in types(owner_client.get(url(emp)))
    assert emp.basic_salary == Decimal("12170.00")


def test_history_titles_localised(owner_client, emp):
    res = owner_client.get(url(emp), HTTP_ACCEPT_LANGUAGE="ne")
    assert res.json()["results"][-1]["title"] == "काम सुरु गर्नुभयो"
