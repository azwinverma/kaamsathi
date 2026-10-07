"""Payouts: eligibility, bank file, reconcile, webhooks, auto mark-paid (CONTRACT-ECOSYSTEM §6)."""

import datetime as dt
import hashlib
import hmac
import json
from decimal import Decimal as D

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from apps.payouts import services
from apps.payouts.models import PayoutBatch, PayoutItem
from apps.payroll.models import PayrollRun, Payslip
from tests import factories as f

pytestmark = pytest.mark.django_db


def make_run(org, status="approved"):
    return PayrollRun.objects.create(
        organization=org,
        bs_year=2083,
        bs_month=4,
        period_start=dt.date(2026, 7, 17),
        period_end=dt.date(2026, 8, 16),
        days_in_month=31,
        status=status,
    )


def slip_for(run, method, net="18000.00", **worker):
    defaults = {"payment_method": method}
    if method == "bank":
        defaults.update(
            bank_name="Nabil Bank", bank_account_no=f"0100{f.WorkerFactory._meta.model.objects.count():08d}"
        )
    if method in ("esewa", "khalti"):
        defaults["wallet_id"] = "9841000000"
    defaults.update(worker)
    w = f.WorkerFactory(**defaults)
    emp = f.EmploymentFactory(organization=run.organization, worker=w)
    return Payslip.objects.create(
        run=run,
        employment=emp,
        worker=w,
        wage_type="monthly",
        days_in_month=31,
        gross_pay=D(net),
        net_pay=D(net),
        payment_method=method,
    )


@pytest.fixture
def run(org):
    return make_run(org)


def test_eligibility_by_method(owner_client, run):
    b1 = slip_for(run, "bank", "20000.00")
    b2 = slip_for(run, "bank", "15000.00")
    slip_for(run, "bank", bank_account_no=None)  # missing account → excluded
    slip_for(run, "cash")
    slip_for(run, "cash")
    slip_for(run, "esewa")

    res = owner_client.get(f"/api/v1/org/payroll-runs/{run.id}/payouts")
    providers = {p["provider"]: p for p in res.json()["providers"]}
    assert providers["bank_file"]["enabled"] is True and providers["bank_file"]["eligible"] == 2
    assert providers["bank_file"]["amount"] == "35000.00"
    assert providers["bank_file"]["excluded"] == {
        "cash": 2,
        "other_method": 1,
        "already_batched": 0,
        "missing_details": 1,
        "paid": 0,
    }
    assert providers["esewa"]["enabled"] is False and providers["esewa"]["eligible"] == 1

    res = owner_client.post(
        f"/api/v1/org/payroll-runs/{run.id}/payouts", {"provider": "bank_file"}, format="json"
    )
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["status"] == "draft" and body["totals"]["items"] == 2
    assert body["totals"]["amount"] == "35000.00" and body["totals"]["excluded"]["cash"] == 2
    assert {i["payslip_id"] for i in body["items"]} == {str(b1.id), str(b2.id)}
    assert all(i["account_no_masked"].startswith("X") for i in body["items"])

    # A second bank batch has nothing left to pay.
    res = owner_client.post(
        f"/api/v1/org/payroll-runs/{run.id}/payouts", {"provider": "bank_file"}, format="json"
    )
    assert res.status_code == 400


def test_wallet_providers_not_configured(owner_client, run):
    slip_for(run, "esewa")
    res = owner_client.post(
        f"/api/v1/org/payroll-runs/{run.id}/payouts", {"provider": "esewa"}, format="json"
    )
    assert res.status_code == 400 and res.json()["error"]["code"] == "provider_not_configured"
    with override_settings(PAYOUT_PROVIDERS=["bank_file", "khalti"]):
        # Enabled but no credentials → still not configured.
        slip_for(run, "khalti")
        res = owner_client.post(
            f"/api/v1/org/payroll-runs/{run.id}/payouts", {"provider": "khalti"}, format="json"
        )
        assert res.json()["error"]["code"] == "provider_not_configured"


def test_only_approved_runs(owner_client, org):
    draft = make_run(org, status="draft")
    slip_for(draft, "bank")
    res = owner_client.post(
        f"/api/v1/org/payroll-runs/{draft.id}/payouts", {"provider": "bank_file"}, format="json"
    )
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"


def test_submit_file_and_reconcile_auto_marks_run_paid(owner_client, run):
    s1 = slip_for(run, "bank", "20000.00")
    s2 = slip_for(run, "bank", "15000.00")
    slip_for(run, "cash")
    batch = services.create_batch(run, "bank_file")
    items = {i.payslip_id: i for i in batch.items.all()}

    # Marking before submit is not allowed.
    item = items[s1.id]
    url = f"/api/v1/org/payouts/{batch.id}/items/{item.id}/mark"
    assert owner_client.post(url, {"status": "paid"}, format="json").status_code == 400

    res = owner_client.post(f"/api/v1/org/payouts/{batch.id}/submit")
    assert res.status_code == 200 and res.json()["status"] == "submitted"
    assert all(i["status"] == "sent" for i in res.json()["items"])

    csv_res = owner_client.get(f"/api/v1/org/payouts/{batch.id}/file.csv")
    lines = csv_res.content.decode().strip().splitlines()
    assert lines[0] == "name,account,bank,amount,narration,reference"
    assert "Salary Shrawan 2083" in lines[1]
    assert owner_client.get(f"/api/v1/org/payouts/{batch.id}/file.xlsx").status_code == 200

    # Bank result: s1 by reference → paid; s2 by account+amount → failed; one junk row.
    result_csv = (
        "Reference,Account Number,Amount,Status,Bank Ref,Remarks\n"
        f"{items[s1.id].id},,20000.00,SUCCESS,TXN-1,\n"
        f',{s2.worker.bank_account_no},"15,000.00",Rejected,,Account dormant\n'
        "nope,999,1.00,success,,\n"
    )
    upload = SimpleUploadedFile("result.csv", result_csv.encode(), content_type="text/csv")
    res = owner_client.post(f"/api/v1/org/payouts/{batch.id}/reconcile", {"file": upload}, format="multipart")
    assert res.status_code == 200, res.json()
    rec = res.json()["reconcile"]
    assert rec == {"rows": 3, "paid": 1, "failed": 1, "unchanged": 0, "unmatched": [4]}
    assert res.json()["status"] == "partially_failed"
    item2 = PayoutItem.objects.get(pk=items[s2.id].id)
    assert item2.failure_reason == "Account dormant"
    s1.refresh_from_db()
    assert s1.payment_ref == "TXN-1" and s1.payment_status == "pending"
    run.refresh_from_db()
    assert run.status == "approved"

    # Employer fixes the account and pays manually → batch completed → run auto-paid.
    res = owner_client.post(
        f"/api/v1/org/payouts/{batch.id}/items/{item2.id}/mark",
        {"status": "paid", "provider_ref": "MANUAL-2"},
        format="json",
    )
    assert res.status_code == 200 and res.json()["status"] == "completed"
    run.refresh_from_db()
    assert run.status == "paid" and run.paid_at is not None
    assert set(run.payslips.values_list("payment_status", flat=True)) == {"paid"}
    # Paid items are final.
    res = owner_client.post(
        f"/api/v1/org/payouts/{batch.id}/items/{item2.id}/mark", {"status": "failed"}, format="json"
    )
    assert res.status_code == 400


def test_run_not_marked_paid_while_wallet_workers_unbatched(run):
    s1 = slip_for(run, "bank")
    slip_for(run, "khalti")
    batch = services.create_batch(run, "bank_file")
    services.submit_batch(batch)
    services.mark_item(batch.items.get(payslip=s1), "paid")
    batch.refresh_from_db()
    assert batch.status == "completed"
    run.refresh_from_db()
    assert run.status == "approved"


def test_cancel_batch_frees_payslips(owner_client, run):
    slip_for(run, "bank")
    batch = services.create_batch(run, "bank_file")
    assert owner_client.post(f"/api/v1/org/payouts/{batch.id}/cancel").json()["status"] == "cancelled"
    assert services.eligibility(run, "bank_file")["eligible"]


def test_list_and_detail(owner_client, run, make_member):
    slip_for(run, "bank")
    batch = services.create_batch(run, "bank_file")
    lst = owner_client.get(f"/api/v1/org/payouts?run={run.id}").json()
    assert lst["count"] == 1 and "items" not in lst["results"][0]
    detail = owner_client.get(f"/api/v1/org/payouts/{batch.id}").json()
    assert len(detail["items"]) == 1 and detail["provider_label"] == "Bank file"
    _, sup = make_member("supervisor")
    assert sup.get("/api/v1/org/payouts").status_code == 403


# ---------------------------------------------------------------- webhooks

SECRET = "whsec-test"
WALLET_SETTINGS = dict(
    PAYOUT_PROVIDERS=["bank_file", "esewa"],
    PAYOUT_WEBHOOK_SECRETS={"esewa": SECRET},
    ESEWA_MERCHANT_CODE="EPAYTEST",
    ESEWA_SECRET_KEY="secret",
)


def sign(body: bytes, secret=SECRET) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@override_settings(**WALLET_SETTINGS)
def test_webhook_signature_accept_and_reject(api, run):
    slip = slip_for(run, "esewa")
    batch = services.create_batch(run, "esewa")
    services.submit_batch(batch)
    item = batch.items.get()
    body = json.dumps(
        {"items": [{"reference": str(item.id), "status": "COMPLETE", "provider_ref": "ES-1"}]}
    ).encode()
    url = "/api/v1/webhooks/payouts/esewa"

    bad = api.post(url, body, content_type="application/json", HTTP_X_SIGNATURE=sign(body, "wrong"))
    assert bad.status_code == 403 and bad.json()["error"]["code"] == "invalid_signature"
    missing = api.post(url, body, content_type="application/json")
    assert missing.status_code == 403
    item.refresh_from_db()
    assert item.status == "sent"

    ok = api.post(url, body, content_type="application/json", HTTP_X_SIGNATURE=f"sha256={sign(body)}")
    assert ok.status_code == 200 and ok.json() == {"received": 1, "applied": 1}
    item.refresh_from_db()
    assert item.status == "paid" and item.provider_ref == "ES-1"
    assert PayoutBatch.objects.get(pk=batch.id).status == "completed"
    run.refresh_from_db()
    slip.refresh_from_db()
    assert run.status == "paid" and slip.payment_status == "paid"


def test_webhook_unknown_or_unconfigured_provider(api):
    body = b"{}"
    assert (
        api.post("/api/v1/webhooks/payouts/paypal", body, content_type="application/json").status_code == 404
    )
    assert (
        api.post("/api/v1/webhooks/payouts/bank_file", body, content_type="application/json").status_code
        == 404
    )
    res = api.post(
        "/api/v1/webhooks/payouts/khalti", body, content_type="application/json", HTTP_X_SIGNATURE="x"
    )
    assert res.status_code == 400 and res.json()["error"]["code"] == "provider_not_configured"
