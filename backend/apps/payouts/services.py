"""Payout batches: eligibility, status roll-up, reconciliation, auto mark-paid of the run."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.core.bs import today_ad
from apps.core.exceptions import APIError, InvalidState
from apps.core.money import D, money_str

from .models import PayoutBatch, PayoutItem
from .providers import get_provider

ACTIVE_BATCH = ~Q(batch__status="cancelled")


def _destination_ok(slip, method) -> bool:
    w = slip.worker
    if method == "bank":
        return bool(w.bank_account_no and w.bank_name)
    if method in ("esewa", "khalti"):
        return bool(w.wallet_id or w.phone)
    return False


def eligibility(run, provider_code: str) -> dict:
    """Which payslips of the run this provider can pay, and why the others are excluded."""
    provider = get_provider(provider_code)
    batched = set(
        PayoutItem.objects.filter(payslip__run=run).filter(ACTIVE_BATCH).values_list("payslip_id", flat=True)
    )
    eligible, excluded = (
        [],
        {"cash": 0, "other_method": 0, "already_batched": 0, "missing_details": 0, "paid": 0},
    )
    for slip in run.payslips.select_related("worker").order_by("worker__full_name"):
        if slip.payment_method == "cash":
            excluded["cash"] += 1
        elif slip.payment_method not in provider.methods:
            excluded["other_method"] += 1
        elif slip.payment_status == "paid":
            excluded["paid"] += 1
        elif slip.id in batched:
            excluded["already_batched"] += 1
        elif not _destination_ok(slip, slip.payment_method) or slip.net_pay <= 0:
            excluded["missing_details"] += 1
        else:
            eligible.append(slip)
    return {"eligible": eligible, "excluded": excluded}


def compute_totals(batch: PayoutBatch, excluded: dict | None = None) -> dict:
    items = list(batch.items.all())
    totals = {
        "items": len(items),
        "amount": money_str(sum((i.amount for i in items), start=Decimal("0"))),
        "paid_count": 0,
        "paid_amount": Decimal("0"),
        "failed_count": 0,
        "pending_count": 0,
        "sent_count": 0,
    }
    for i in items:
        totals[f"{i.status}_count"] += 1
        if i.status == "paid":
            totals["paid_amount"] += i.amount
    totals["paid_amount"] = money_str(totals["paid_amount"])
    totals["excluded"] = excluded if excluded is not None else (batch.totals or {}).get("excluded", {})
    return totals


@transaction.atomic
def create_batch(run, provider_code: str, user=None) -> PayoutBatch:
    if run.status != "approved":
        raise InvalidState(message=_("Payouts can be created only for approved payroll runs."))
    provider = get_provider(provider_code)
    provider.ensure_enabled()
    result = eligibility(run, provider_code)
    if not result["eligible"]:
        raise APIError(
            "validation_error",
            message=_("No payslips in this run can be paid with this provider."),
            fields={"provider": [_("No eligible payslips.")]},
        )
    batch = PayoutBatch.objects.create(run=run, provider=provider_code, created_by=user)
    for slip in result["eligible"]:
        w = slip.worker
        PayoutItem.objects.create(
            batch=batch,
            payslip=slip,
            amount=slip.net_pay,
            method=slip.payment_method,
            account_name=(w.bank_account_name or w.full_name)
            if slip.payment_method == "bank"
            else w.full_name,
            account_no=w.bank_account_no if slip.payment_method == "bank" else None,
            bank_name=w.bank_name if slip.payment_method == "bank" else None,
            wallet_id=(w.wallet_id or w.phone) if slip.payment_method in ("esewa", "khalti") else None,
        )
    batch.totals = compute_totals(batch, result["excluded"])
    batch.save(update_fields=["totals"])
    return batch


@transaction.atomic
def submit_batch(batch: PayoutBatch) -> PayoutBatch:
    if batch.status != "draft":
        raise InvalidState()
    provider = get_provider(batch.provider)
    provider.ensure_enabled()
    provider.submit(batch)
    batch.status = "submitted"
    batch.submitted_at = timezone.now()
    batch.totals = compute_totals(batch)
    batch.save(update_fields=["status", "submitted_at", "totals", "file"])
    return batch


@transaction.atomic
def cancel_batch(batch: PayoutBatch) -> PayoutBatch:
    if batch.status in ("completed", "cancelled") or batch.items.filter(status="paid").exists():
        raise InvalidState(message=_("A batch with paid items cannot be cancelled."))
    batch.status = "cancelled"
    batch.save(update_fields=["status"])
    return batch


def refresh_batch(batch: PayoutBatch) -> PayoutBatch:
    """Roll item statuses up into the batch status, then check whether the run is fully paid."""
    if batch.status in ("draft", "cancelled"):
        batch.totals = compute_totals(batch)
        batch.save(update_fields=["totals"])
        return batch
    totals = compute_totals(batch)
    open_items = totals["pending_count"] + totals["sent_count"]
    if totals["items"] and totals["paid_count"] == totals["items"]:
        status = "completed"
    elif not open_items and totals["failed_count"]:
        status = "partially_failed"
    else:
        status = "processing"
    batch.status = status
    batch.totals = totals
    if status == "completed" and not batch.completed_at:
        batch.completed_at = timezone.now()
    batch.save(update_fields=["status", "totals", "completed_at"])
    maybe_mark_run_paid(batch.run)
    return batch


def maybe_mark_run_paid(run) -> bool:
    """When every item in every (non-cancelled) batch of the run is paid, and every non-cash
    payslip is covered by a paid item, mark the payroll run paid (payroll service)."""
    from apps.payroll.services import mark_paid

    run.refresh_from_db(fields=["status"])
    if run.status != "approved":
        return False
    items = PayoutItem.objects.filter(batch__run=run).exclude(batch__status="cancelled")
    if not items.exists() or items.exclude(status="paid").exists():
        return False
    covered = set(items.values_list("payslip_id", flat=True))
    uncovered = run.payslips.exclude(payment_method="cash").exclude(id__in=covered).exists()
    if uncovered:
        return False
    mark_paid(run, today_ad())
    from apps.notifications.services import enqueue
    from apps.notifications.tasks import payslip_ready

    enqueue(payslip_ready, str(run.id))
    return True


VALID_ITEM_STATUS = {"pending", "sent", "paid", "failed"}


@transaction.atomic
def mark_item(item: PayoutItem, status: str, provider_ref=None, failure_reason=None) -> PayoutItem:
    batch = item.batch
    if batch.status in ("draft", "cancelled"):
        raise InvalidState(message=_("Submit the batch before marking payments."))
    if status not in VALID_ITEM_STATUS:
        raise APIError("validation_error", fields={"status": ["Invalid status."]})
    if item.status == "paid" and status != "paid":
        raise InvalidState(message=_("A paid item cannot be changed."))
    item.status = status
    if provider_ref:
        item.provider_ref = provider_ref
    item.failure_reason = failure_reason if status == "failed" else None
    item.save()
    if status == "paid" and item.provider_ref:
        slip = item.payslip
        slip.payment_ref = item.provider_ref[:80]
        slip.save(update_fields=["payment_ref"])
    refresh_batch(batch)
    return item


def apply_updates(batch_qs, updates) -> int:
    """Apply provider ItemUpdates (webhook) by item id or provider_ref. Returns count applied."""
    applied, touched = 0, set()
    for u in updates:
        item = None
        if u.item_id:
            item = PayoutItem.objects.filter(batch__in=batch_qs, pk=_uuid_or_none(u.item_id)).first()
        if item is None and u.provider_ref:
            item = PayoutItem.objects.filter(batch__in=batch_qs, provider_ref=u.provider_ref).first()
        if item is None or item.status == "paid" or item.batch.status in ("draft", "cancelled"):
            continue
        item.status = u.status
        if u.provider_ref:
            item.provider_ref = u.provider_ref
        item.failure_reason = u.failure_reason if u.status == "failed" else None
        item.save()
        touched.add(item.batch_id)
        applied += 1
    for batch in PayoutBatch.objects.filter(pk__in=touched):
        refresh_batch(batch)
    return applied


def _uuid_or_none(value):
    import uuid

    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


@transaction.atomic
def reconcile(batch: PayoutBatch, upload) -> dict:
    """Match the bank's result CSV to items: by reference (item id), else account + amount."""
    if batch.provider != "bank_file":
        raise InvalidState(message=_("Only bank-file batches are reconciled from a file."))
    if batch.status in ("draft", "cancelled", "completed"):
        raise InvalidState()
    provider = get_provider("bank_file")
    rows = provider.parse_result_file(upload)
    items = list(batch.items.all())
    by_id = {str(i.id): i for i in items}
    result = {"rows": len(rows), "paid": 0, "failed": 0, "unchanged": 0, "unmatched": []}
    for row in rows:
        item = by_id.get((row["reference"] or "").lower()) if row["reference"] else None
        if item is None and row["account"]:
            amount = D(row["amount"].replace(",", "")) if row["amount"] else None
            candidates = [
                i
                for i in items
                if i.account_no == row["account"]
                and (amount is None or i.amount == amount)
                and i.status != "paid"
            ]
            item = candidates[0] if candidates else None
        if item is None or row["status"] is None:
            result["unmatched"].append(row["row"])
            continue
        if item.status == "paid" or row["status"] == "sent":
            result["unchanged"] += 1
            continue
        item.status = row["status"]
        if row["provider_ref"]:
            item.provider_ref = row["provider_ref"]
        item.failure_reason = (row["reason"] or _("Rejected by bank")) if row["status"] == "failed" else None
        item.save()
        if item.status == "paid" and item.provider_ref:
            item.payslip.payment_ref = item.provider_ref[:80]
            item.payslip.save(update_fields=["payment_ref"])
        result[row["status"]] += 1
    refresh_batch(batch)
    return result
