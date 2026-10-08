"""Plans, VAT invoices (BS fiscal-year numbering), payments, credit notes, partner payers."""

import datetime as dt
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from apps.audit.models import AuditLog
from apps.billing import services
from apps.billing.models import Charge, Invoice, Plan
from apps.core.bs import BSMonth, bs_to_ad, days_in_bs_month
from apps.core.exceptions import APIError
from apps.partners.models import Partner

from .conftest import auth_client
from .factories import EmploymentFactory, OrganizationFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def partner(db):
    return Partner.objects.create(name="Sunrise Training Institute", kind="training")


def _charge(org, amount="1000.00", kind="placement", **kw):
    return Charge.objects.create(
        organization=org, kind=kind, amount=Decimal(amount), description=f"{kind} test", **kw
    )


def _issued(org, amount="1000.00", on=None):
    _charge(org, amount, bs_year=2083, bs_month=5)
    (inv,) = [i for i in services.generate_invoices(2083, 5) if i.organization_id == org.id]
    return services.issue_invoice(inv, on=on)


# ------------------------------------------------------------------------------- plans
def test_seeded_pilot_plan_keeps_phase1_pricing(org):
    pilot = Plan.objects.get(code="pilot")
    assert (pilot.per_active_worker, pilot.min_monthly, pilot.placement_fee) == (150, 3000, 5000)
    assert services.plan_for(org).code == "pilot"
    assert services.subscription_amount(10) == Decimal("3000.00")
    assert services.subscription_amount(30) == Decimal("4500.00")


def test_plan_pricing_base_included_workers_and_minimum():
    plan = Plan(
        code="growth",
        name="G",
        monthly_base=Decimal("7500"),
        per_active_worker=Decimal("100"),
        min_monthly=Decimal("8000"),
        included_workers=50,
    )
    assert services.subscription_amount(10, plan) == Decimal("8000.00")  # minimum wins
    assert services.subscription_amount(50, plan) == Decimal("8000.00")
    assert services.subscription_amount(80, plan) == Decimal("10500.00")  # 7500 + 30 × 100


def test_subscription_charge_uses_org_plan(org):
    for _ in range(60):
        EmploymentFactory(organization=org)
    services.set_plan(org, Plan.objects.get(code="growth"))
    month = BSMonth.of(dt.date.today())
    charge, created = services.create_subscription_charge(org, month.year, month.month)
    assert created and charge.amount == Decimal("8500.00")  # 7500 + (60 − 50) × 100
    assert "Growth plan" in charge.description


def test_paused_subscription_creates_no_charge(org):
    services.set_plan(org, Plan.objects.get(code="starter"), status="paused")
    charge, created = services.create_subscription_charge(org, 2083, 5)
    assert charge is None and not created


def test_ops_plans_crud_and_subscription_change_audited(staff_client, org):
    res = staff_client.get("/api/v1/ops/billing/plans")
    assert res.status_code == 200 and {p["code"] for p in res.json()} >= {"pilot", "starter", "enterprise"}
    res = staff_client.patch(
        "/api/v1/ops/billing/plans/starter", {"per_active_worker": "110.00"}, format="json"
    )
    assert res.status_code == 200 and res.json()["per_active_worker"] == "110.00"
    assert res.json()["name"] == "Starter"  # untouched fields keep their value
    res = staff_client.patch(
        f"/api/v1/ops/billing/subscriptions/{org.id}", {"plan": "business"}, format="json"
    )
    assert res.status_code == 200 and res.json()["plan"]["code"] == "business"
    assert AuditLog.objects.filter(action="billing.plan.update").exists()
    assert AuditLog.objects.filter(action="billing.subscription.update", organization=org).exists()
    bad = staff_client.patch(f"/api/v1/ops/billing/subscriptions/{org.id}", {"plan": "nope"}, format="json")
    assert bad.status_code == 400


def test_org_subscription_endpoint(owner_client):
    res = owner_client.get("/api/v1/org/billing/subscription")
    assert res.status_code == 200
    body = res.json()
    assert body["plan"]["code"] == "pilot" and body["is_default"] is True
    assert body["monthly_estimate"] == "3000.00"


# ---------------------------------------------------------------------------- invoices
def test_generate_groups_unpaid_charges_per_payer_and_is_idempotent(org, partner):
    other = OrganizationFactory()
    placement = _charge(org, "5000.00", bs_year=None)
    Charge.objects.filter(pk=placement.pk).update(
        created_at=dt.datetime(2026, 9, 1, tzinfo=dt.UTC)
    )  # in Bhadra
    _charge(org, "3000.00", kind="subscription", bs_year=2083, bs_month=5)
    _charge(org, "9999.00", kind="subscription", bs_year=2083, bs_month=6)  # later month: not yet
    _charge(org, "5000.00", status="waived")
    _charge(other, "4500.00", kind="subscription", bs_year=2083, bs_month=4)
    services.create_partner_charge(
        partner, "training_commission", "2000", "Commission Bhadra", bs_year=2083, bs_month=5
    )

    invoices = services.generate_invoices(2083, 5)
    assert len(invoices) == 3
    mine = Invoice.objects.get(organization=org)
    assert mine.status == "draft" and mine.number is None
    assert mine.subtotal == Decimal("8000.00") and mine.lines.count() == 2
    assert Invoice.objects.get(partner=partner).total == Decimal("2260.00")

    assert services.generate_invoices(2083, 5) == []  # nothing new
    _charge(org, "1000.00", kind="verification_fee", bs_year=2083, bs_month=5)
    (again,) = services.generate_invoices(2083, 5)
    assert again.pk == mine.pk and again.subtotal == Decimal("9000.00")


def test_vat_math(org):
    _charge(org, "3333.33", bs_year=2083, bs_month=5)
    (inv,) = services.generate_invoices(2083, 5)
    assert inv.vat_rate == Decimal("13.00")
    assert inv.vat_amount == Decimal("433.33")  # 3333.33 × 13% = 433.3329 → 433.33
    assert inv.total == Decimal("3766.66")


def test_vat_rate_setting(org, settings):
    settings.VAT_RATE = "0"
    _charge(org, "1000.00", bs_year=2083, bs_month=5)
    (inv,) = services.generate_invoices(2083, 5)
    assert inv.vat_amount == Decimal("0.00") and inv.total == Decimal("1000.00")


def test_numbering_is_sequential_per_bs_fiscal_year_and_rolls_over_in_shrawan(org):
    last_of_asar = bs_to_ad(2083, 3, days_in_bs_month(2083, 3))
    first_of_shrawan = bs_to_ad(2083, 4, 1)
    assert first_of_shrawan == last_of_asar + dt.timedelta(days=1)

    numbers = []
    for period, on in enumerate((last_of_asar, last_of_asar, first_of_shrawan, first_of_shrawan), start=1):
        _charge(org, "100.00", bs_year=2083, bs_month=period)
        (inv,) = services.generate_invoices(2083, period)
        numbers.append(services.issue_invoice(inv, on=on).number)
    assert numbers == [
        "KS-2082/83-000001",
        "KS-2082/83-000002",
        "KS-2083/84-000001",
        "KS-2083/84-000002",
    ]
    assert Invoice.objects.get(number="KS-2083/84-000001").fiscal_year == "2083/84"


def test_issue_sets_due_date_and_stores_pdf(org):
    inv = _issued(org)
    assert inv.status == "issued" and inv.due_date == inv.issue_date + dt.timedelta(days=15)
    assert inv.pdf.name and inv.pdf.read(4) == b"%PDF"
    with pytest.raises(APIError):
        services.issue_invoice(inv)  # not a draft any more


def test_payments_mark_invoice_and_charges_paid(org):
    inv = _issued(org, "1000.00")  # total 1130.00
    services.record_payment(inv, amount="500.00", method="bank", paid_on=dt.date.today(), reference="TX1")
    inv.refresh_from_db()
    assert inv.status == "issued" and services.balance_due(inv) == Decimal("630.00")
    with pytest.raises(APIError):
        services.record_payment(inv, amount="700.00", method="cash", paid_on=dt.date.today())  # > balance
    services.record_payment(inv, amount="630.00", method="esewa", paid_on=dt.date.today())
    inv.refresh_from_db()
    assert inv.status == "paid" and inv.paid_at is not None
    assert not Charge.objects.filter(invoice_lines__invoice=inv).exclude(status="paid").exists()


def test_credit_note_reduces_balance_and_can_settle(org):
    inv = _issued(org, "1000.00")  # 1130.00
    note = services.create_credit_note(inv, amount="130.00", reason="Discount")
    assert note.number.startswith("KS-CN-") and note.vat_amount == Decimal("14.96")  # 130 × 13/113
    assert services.balance_due(inv) == Decimal("1000.00")
    with pytest.raises(APIError):
        services.create_credit_note(inv, amount="1000.01", reason="too much")
    services.record_payment(inv, amount="1000.00", method="bank", paid_on=dt.date.today())
    inv.refresh_from_db()
    assert inv.status == "paid"


def test_void_releases_charges_and_blocks_after_payment(org):
    inv = _issued(org)
    services.void_invoice(inv, "Wrong buyer")
    assert services.billable_charges(2083, 5).count() == 1  # back in the pool
    (fresh,) = services.generate_invoices(2083, 5)
    assert fresh.pk != inv.pk
    fresh = services.issue_invoice(fresh)
    services.record_payment(fresh, amount="100.00", method="bank", paid_on=dt.date.today())
    with pytest.raises(APIError):
        services.void_invoice(fresh)


def test_ops_invoice_flow_over_api_is_audited(staff_client, org):
    _charge(org, "2000.00", bs_year=2083, bs_month=5)
    res = staff_client.post(
        "/api/v1/ops/billing/invoices/generate", {"bs_year": 2083, "bs_month": 5}, format="json"
    )
    assert res.status_code == 201 and res.json()["count"] == 1
    inv_id = res.json()["invoices"][0]["id"]
    assert staff_client.get("/api/v1/ops/billing/invoices?status=draft").json()["count"] == 1
    res = staff_client.post(f"/api/v1/ops/billing/invoices/{inv_id}/issue")
    assert res.status_code == 200 and res.json()["number"].startswith("KS-")
    res = staff_client.post(
        f"/api/v1/ops/billing/invoices/{inv_id}/credit-notes",
        {"amount": "260.00", "reason": "Goodwill"},
        format="json",
    )
    assert res.status_code == 201 and res.json()["invoice"]["balance_due"] == "2000.00"
    res = staff_client.post(
        f"/api/v1/ops/billing/invoices/{inv_id}/payments",
        {"amount": "2000.00", "method": "khalti", "reference": "K-1", "paid_on": dt.date.today().isoformat()},
        format="json",
    )
    assert res.status_code == 201 and res.json()["invoice"]["status"] == "paid"
    res = staff_client.post(f"/api/v1/ops/billing/invoices/{inv_id}/void", {"reason": "x"}, format="json")
    assert res.status_code == 400  # paid invoices cannot be voided
    actions = set(AuditLog.objects.filter(object_id=inv_id).values_list("action", flat=True))
    assert {"billing.invoice.generate", "billing.invoice.issue"} <= actions
    assert AuditLog.objects.filter(action="billing.payment.record").exists()
    assert AuditLog.objects.filter(action="billing.credit_note.create").exists()
    pdf = staff_client.get(f"/api/v1/ops/billing/invoices/{inv_id}/pdf")
    assert pdf.status_code == 200 and pdf["Content-Type"] == "application/pdf"


def test_org_sees_only_its_issued_invoices(owner_client, org, make_member):
    draft_org_charge = _charge(org, "500.00", bs_year=2083, bs_month=5)
    (draft,) = services.generate_invoices(2083, 5)
    assert owner_client.get("/api/v1/org/billing/invoices").json()["count"] == 0  # drafts hidden
    assert owner_client.get(f"/api/v1/org/billing/invoices/{draft.id}").status_code == 404
    services.issue_invoice(draft)
    other = _issued(OrganizationFactory())
    res = owner_client.get("/api/v1/org/billing/invoices")
    assert [r["id"] for r in res.json()["results"]] == [str(draft.id)]
    detail = owner_client.get(f"/api/v1/org/billing/invoices/{draft.id}").json()
    assert detail["lines"][0]["charge_id"] == str(draft_org_charge.id)
    assert owner_client.get(f"/api/v1/org/billing/invoices/{other.id}").status_code == 404
    pdf = owner_client.get(f"/api/v1/org/billing/invoices/{draft.id}/pdf")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    _, hr_client = make_member("hr")
    assert hr_client.get("/api/v1/org/billing/invoices").status_code == 403  # owner/admin only


# --------------------------------------------------------------- payers: never workers
def test_partner_charges_and_invoices(partner, staff_client):
    res = staff_client.post(
        "/api/v1/ops/billing/charges",
        {
            "partner_id": str(partner.id),
            "kind": "partner_referral_fee",
            "amount": "1500",
            "description": "Loan referrals",
        },
        format="json",
    )
    assert res.status_code == 201 and res.json()["payer_type"] == "partner"
    org = OrganizationFactory()
    res = staff_client.post(
        "/api/v1/ops/billing/charges",
        {"organization_id": str(org.id), "kind": "training_commission", "amount": "1500", "description": "x"},
        format="json",
    )
    assert res.status_code == 400  # partner-only kinds cannot be billed to an employer
    res = staff_client.post(
        "/api/v1/ops/billing/charges",
        {"kind": "verification_fee", "amount": "100", "description": "x"},
        format="json",
    )
    assert res.status_code == 400  # a payer is mandatory
    month = BSMonth.of(dt.date.today())
    (inv,) = services.generate_invoices(month.year, month.month)
    assert inv.partner_id == partner.id and inv.organization_id is None


def test_workers_are_never_billed():
    # No billing model can point at a worker (or a worker's user as payer).
    from django.apps import apps

    for model in apps.get_app_config("billing").get_models():
        for field in model._meta.get_fields():
            target = getattr(field, "related_model", None)
            assert target is None or target._meta.label != "workers.Worker", f"{model.__name__}.{field.name}"
    # The database refuses a charge without an employer or partner payer.
    with pytest.raises(IntegrityError), transaction.atomic():
        Charge.objects.create(kind="placement", amount=Decimal("1"), description="orphan")


def test_worker_user_cannot_reach_billing(db):
    worker_user = UserFactory()
    client = auth_client(worker_user)
    assert client.get("/api/v1/org/billing/invoices").status_code == 403
    assert client.get("/api/v1/ops/billing/invoices").status_code == 403


def test_ird_adapter_is_disabled_by_default(org):
    from apps.billing import ird

    inv = _issued(org)
    payload = ird.bill_payload(inv)
    assert payload["invoice_number"] == inv.number and payload["vat"] == float(inv.vat_amount)
    with pytest.raises(ird.NotConfigured):
        ird.post_invoice(inv)


def test_generate_invoices_command(org, capsys):
    from django.core.management import call_command

    _charge(org, "100.00", bs_year=2083, bs_month=5)
    call_command("generate_invoices", "--bs-year", "2083", "--bs-month", "5", "--issue")
    assert Invoice.objects.get(organization=org).status == "issued"
