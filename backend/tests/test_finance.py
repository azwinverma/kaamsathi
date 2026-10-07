"""Financial profile (paid payslips only), offers, eligibility, referrals, ops finance."""

from decimal import Decimal as D

import pytest

from apps.core.bs import BSMonth
from apps.finance.models import FinancialProfile, Offer, Referral
from apps.finance.services import build_profile, eligibility, income_stability
from apps.finance.tasks import refresh_all_profiles
from apps.partners.models import ConsentGrant, Partner
from apps.payroll.models import PayrollRun, Payslip
from apps.workers.models import Consent
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def payslip(emp, bs_year, bs_month, net, *, paid=True, gross=None, ssf=D("0")):
    m = BSMonth(bs_year, bs_month)
    run, _ = PayrollRun.objects.get_or_create(
        organization=emp.organization,
        bs_year=bs_year,
        bs_month=bs_month,
        defaults=dict(
            period_start=m.start,
            period_end=m.end,
            days_in_month=m.days,
            status="paid" if paid else "approved",
        ),
    )
    return Payslip.objects.create(
        run=run,
        employment=emp,
        worker=emp.worker,
        wage_type="monthly",
        days_in_month=m.days,
        gross_pay=gross if gross is not None else D(net),
        net_pay=D(net),
        ssf_employee=ssf,
        payment_status="paid" if paid else "pending",
    )


@pytest.fixture
def worker_user():
    user = f.UserFactory()
    worker = f.WorkerFactory(user=user, phone=user.phone)
    return user, worker


@pytest.fixture
def partner():
    return Partner.objects.create(name="Demo Bank Ltd. (sandbox)", kind="bank", regulator="nrb")


@pytest.fixture
def employed(worker_user):
    _u, worker = worker_user
    return f.EmploymentFactory(worker=worker)


# ----------------------------------------------------------------------------- profile math
def test_income_stability_math():
    assert income_stability([]) is None
    assert income_stability([D("20000")]) == D("1.000")
    # σ(18000, 20000, 22000) = 1632.993; mean 20000 → CV 0.08165 → 0.918
    assert income_stability([D("18000"), D("20000"), D("22000")]) == D("0.918")
    # CV > 1 floors at 0
    assert income_stability([D("100"), D("100"), D("10000")]) == D("0")


def test_profile_uses_paid_payslips_only(employed):
    payslip(employed, 2083, 1, "18000", ssf=D("1000"))
    payslip(employed, 2083, 2, "20000", ssf=D("1000"))
    payslip(employed, 2083, 3, "22000")
    payslip(employed, 2083, 4, "90000", paid=False)  # pending: not verified earnings
    p = build_profile(employed.worker)
    assert p.verified_months == 3
    assert p.avg_monthly_net == D("20000.00")
    assert p.min_monthly_net == D("18000.00") and p.max_monthly_net == D("22000.00")
    assert p.income_stability == D("0.918")
    assert p.employers_count == 1
    assert p.ssf_months == 2
    assert p.last_payslip_month == "2083-03"
    assert [m["bs_month"] for m in p.monthly] == [1, 2, 3]
    assert all(m["paid"] for m in p.monthly)
    assert p.months_on_platform > 0


def test_profile_sums_two_employers_same_month(employed):
    payslip(employed, 2083, 1, "10000")
    other = f.EmploymentFactory(worker=employed.worker)
    payslip(other, 2083, 1, "5000")
    p = build_profile(employed.worker)
    assert p.verified_months == 1 and p.avg_monthly_net == D("15000.00") and p.employers_count == 2
    assert "," in p.monthly[0]["employer"]


def test_empty_profile(worker_user):
    _u, worker = worker_user
    p = build_profile(worker)
    assert p.verified_months == 0 and p.income_stability is None and p.monthly == []


def test_me_financial_profile(worker_user, employed):
    user, _w = worker_user
    payslip(employed, 2083, 1, "19000.50")
    res = auth_client(user).get("/api/v1/me/financial-profile")
    assert res.status_code == 200
    body = res.json()
    assert body["verified_months"] == 1 and body["avg_monthly_net"] == "19000.50"
    assert body["income_stability"] == 1.0
    assert "credit" not in str(body).lower()


def test_refresh_task(employed):
    payslip(employed, 2083, 1, "12000")
    assert refresh_all_profiles() == 1
    assert FinancialProfile.objects.get(worker=employed.worker).verified_months == 1


# ----------------------------------------------------------------------------- eligibility
def test_eligibility_reasons(partner, employed):
    payslip(employed, 2083, 1, "15000")
    payslip(employed, 2083, 2, "15000")
    p = build_profile(employed.worker)
    offer = Offer(partner=partner, kind="loan", title="L", min_verified_months=3, min_avg_net=D("20000"))
    result = eligibility(offer, p)
    assert result["eligible"] is False and len(result["reasons"]) == 2
    ok = Offer(partner=partner, kind="ewa", title="E", min_verified_months=2, min_avg_net=D("15000"))
    assert eligibility(ok, p) == {"eligible": True, "reasons": []}
    partner.is_active = False
    assert eligibility(ok, p)["eligible"] is False


def test_me_offers_shows_eligibility_and_partner(worker_user, partner, employed):
    user, _w = worker_user
    payslip(employed, 2083, 1, "20000")
    Offer.objects.create(partner=partner, kind="ewa", title="EWA", min_verified_months=1)
    Offer.objects.create(partner=partner, kind="loan", title="Loan", min_verified_months=6)
    Offer.objects.create(partner=partner, kind="loan", title="Hidden", is_active=False)
    res = auth_client(user).get("/api/v1/me/offers")
    assert res.status_code == 200
    by_title = {o["title"]: o for o in res.json()}
    assert set(by_title) == {"EWA", "Loan"}
    assert by_title["EWA"]["eligible"] is True and by_title["Loan"]["eligible"] is False
    assert by_title["EWA"]["offered_by_label"] == f"Offered by {partner.name}, regulated by Nepal Rastra Bank"


# ----------------------------------------------------------------------------- apply / referrals
def test_apply_creates_grant_consent_and_referral(worker_user, partner, employed):
    user, worker = worker_user
    payslip(employed, 2083, 1, "20000")
    offer = Offer.objects.create(partner=partner, kind="tool_finance", title="Tools", max_amount=D("50000"))
    me = auth_client(user)
    res = me.post(
        f"/api/v1/me/offers/{offer.id}/apply",
        {"amount_requested": "30000", "purpose_note": "drill"},
        format="json",
    )
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["status"] == "submitted" and body["partner"]["name"] == partner.name
    grant = ConsentGrant.objects.get(worker=worker, partner=partner)
    assert grant.purpose == "loan_assessment" and set(grant.scopes) == {"earnings.read", "profile.read"}
    assert Consent.objects.filter(worker=worker, scope="history_share", granted=True).exists()
    assert Referral.objects.get().grant == grant
    # duplicate open request
    res = me.post(f"/api/v1/me/offers/{offer.id}/apply", {}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "duplicate"
    assert me.get("/api/v1/me/referrals").json()["count"] == 1


def test_apply_rejects_ineligible_and_over_max(worker_user, partner):
    user, _w = worker_user
    me = auth_client(user)
    strict = Offer.objects.create(partner=partner, kind="loan", title="Strict", min_verified_months=3)
    res = me.post(f"/api/v1/me/offers/{strict.id}/apply", {}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"
    capped = Offer.objects.create(partner=partner, kind="ewa", title="Capped", max_amount=D("1000"))
    res = me.post(f"/api/v1/me/offers/{capped.id}/apply", {"amount_requested": "5000"}, format="json")
    assert res.status_code == 400
    assert not Referral.objects.exists() and not ConsentGrant.objects.exists()


def test_apply_grant_days_capped(worker_user, partner, settings):
    settings.PARTNER_GRANT_MAX_DAYS = 30
    user, _w = worker_user
    offer = Offer.objects.create(partner=partner, kind="insurance", title="Accident")
    res = auth_client(user).post(f"/api/v1/me/offers/{offer.id}/apply", {"days": 60}, format="json")
    assert res.status_code == 400


# ----------------------------------------------------------------------------- ops
def test_ops_offers_crud(staff_client, partner):
    res = staff_client.post(
        "/api/v1/ops/finance/offers",
        {"partner_id": str(partner.id), "kind": "insurance", "title": "Accident", "min_verified_months": 1},
        format="json",
    )
    assert res.status_code == 201, res.json()
    oid = res.json()["id"]
    res = staff_client.patch(f"/api/v1/ops/finance/offers/{oid}", {"is_active": False}, format="json")
    assert res.status_code == 200 and res.json()["is_active"] is False
    assert staff_client.get("/api/v1/ops/finance/offers?is_active=false").json()["count"] == 1


def test_ops_summary_and_referrals(staff_client, partner, worker_user):
    _u, worker = worker_user
    offer = Offer.objects.create(partner=partner, kind="loan", title="L")
    from apps.partners.services import create_grant

    g = create_grant(worker, partner, purpose="loan_assessment", scopes=["profile.read"], days=5)
    for status, amount in (
        ("approved", None),
        ("disbursed", D("10000")),
        ("rejected", None),
        ("submitted", None),
    ):
        Referral.objects.create(
            worker=worker, offer=offer, partner=partner, grant=g, status=status, amount_approved=amount
        )
    s = staff_client.get("/api/v1/ops/finance/summary").json()
    assert s["total"] == 4
    assert s["approval_rate"] == pytest.approx(0.667, abs=0.001)
    assert s["disbursed_total"] == "10000.00"
    assert s["by_partner"][0]["total"] == 4
    res = staff_client.get(f"/api/v1/ops/finance/referrals?status=rejected&partner={partner.id}")
    assert res.json()["count"] == 1 and res.json()["results"][0]["worker"]["full_name"] == worker.full_name


def test_ops_finance_requires_staff(worker_user):
    user, _w = worker_user
    assert auth_client(user).get("/api/v1/ops/finance/summary").status_code == 403
