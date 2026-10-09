"""Billing domain logic: plan pricing, charges, invoice generation, numbering, VAT, payments.

Workers never pay: every function here bills an ``Organization`` or a ``partners.Partner``.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.core.bs import MONTHS_EN, BSMonth, fiscal_year, today_ad
from apps.core.exceptions import APIError, InvalidState
from apps.core.money import D, q2
from apps.workforce.models import Employment

from .labels import PARTNER_KINDS
from .models import (
    Charge,
    CreditNote,
    Invoice,
    InvoiceLine,
    InvoiceSequence,
    PaymentRecord,
    Plan,
    Subscription,
)

DEFAULT_PLAN = "pilot"
INVOICE_SERIES = "KS"
CREDIT_NOTE_SERIES = "KS-CN"


# --------------------------------------------------------------------------- plans
def vat_rate() -> Decimal:
    return D(getattr(settings, "VAT_RATE", "13"))


def due_days() -> int:
    return int(getattr(settings, "INVOICE_DUE_DAYS", 15))


def _fallback_pilot() -> Plan:
    """Unsaved pilot plan from settings (used only if the seeded row was deleted)."""
    return Plan(
        code=DEFAULT_PLAN,
        name="Pilot",
        monthly_base=Decimal("0"),
        per_active_worker=D(settings.SUBSCRIPTION_PER_WORKER),
        min_monthly=D(settings.SUBSCRIPTION_MINIMUM),
        placement_fee=D(settings.PLACEMENT_FEE),
        included_workers=0,
    )


def default_plan() -> Plan:
    return Plan.objects.filter(code=DEFAULT_PLAN).first() or _fallback_pilot()


def subscription_for(org) -> Subscription | None:
    return Subscription.objects.select_related("plan").filter(organization=org).first()


def plan_for(org) -> Plan:
    sub = subscription_for(org)
    return sub.plan if sub is not None else default_plan()


def set_plan(org, plan: Plan, *, started_on: dt.date | None = None, status: str = "active") -> Subscription:
    sub, created = Subscription.objects.get_or_create(
        organization=org,
        defaults={"plan": plan, "started_on": started_on or today_ad(), "status": status},
    )
    if not created:
        changed = sub.plan_id != plan.pk
        sub.plan = plan
        sub.status = status
        if changed:
            sub.started_on = started_on or today_ad()
        sub.save()
    return sub


def subscription_amount(workers: int, plan: Plan | None = None) -> Decimal:
    plan = plan or default_plan()
    extra = max(0, workers - plan.included_workers)
    raw = D(plan.monthly_base) + extra * D(plan.per_active_worker)
    return q2(max(raw, D(plan.min_monthly)))


def placement_fee_for(org) -> Decimal:
    """Placement fee on the org's plan (hiring may call this instead of ``settings.PLACEMENT_FEE``)."""
    return q2(plan_for(org).placement_fee)


def active_worker_count(org) -> int:
    return Employment.objects.filter(organization=org, status="active").count()


def workers_active_in(org, month) -> int:
    """Employments that overlapped the BS month at any point (billing for a past month)."""
    return (
        Employment.objects.filter(organization=org, start_date__lte=month.end)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=month.start))
        .count()
    )


def monthly_estimate(org) -> Decimal:
    return subscription_amount(active_worker_count(org), plan_for(org))


def unpaid_total(org) -> Decimal:
    return q2(Charge.objects.filter(organization=org, status="unpaid").aggregate(t=Sum("amount"))["t"] or 0)


# --------------------------------------------------------------------------- charges
def create_subscription_charge(org, bs_year: int, bs_month: int):
    existing = Charge.objects.filter(
        organization=org, kind="subscription", bs_year=bs_year, bs_month=bs_month
    ).first()
    if existing:
        return existing, False
    sub = subscription_for(org)
    if sub is not None and sub.status != "active":
        return None, False
    plan = sub.plan if sub is not None else default_plan()
    workers = workers_active_in(org, BSMonth(bs_year, bs_month))
    charge = Charge.objects.create(
        organization=org,
        kind="subscription",
        amount=subscription_amount(workers, plan),
        description=f"Subscription {MONTHS_EN[bs_month]} {bs_year} ({workers} active workers)"
        + ("" if plan.code == DEFAULT_PLAN else f" — {plan.name} plan"),
        bs_year=bs_year,
        bs_month=bs_month,
    )
    return charge, True


def create_org_charge(org, kind: str, amount, description: str, **extra) -> Charge:
    """Employer-paid charge (e.g. ``verification_fee``)."""
    if kind in PARTNER_KINDS:
        raise APIError("validation_error", "This kind of charge is billed to partners only.")
    return Charge.objects.create(
        organization=org, kind=kind, amount=q2(amount), description=description, **extra
    )


def create_partner_charge(partner, kind: str, amount, description: str, **extra) -> Charge:
    """Partner / training-provider revenue (commissions, referral fees). Never billed to a worker."""
    if partner is None:
        raise APIError("validation_error", "A partner payer is required.")
    return Charge.objects.create(
        payer_partner=partner, kind=kind, amount=q2(amount), description=description, **extra
    )


# --------------------------------------------------------------------------- numbering
def next_number(series: str, fy: str) -> str:
    """Gap-free sequential number for ``series`` within BS fiscal year ``fy`` (row-locked)."""
    with transaction.atomic():
        seq, _ = InvoiceSequence.objects.select_for_update().get_or_create(series=series, fiscal_year=fy)
        seq.last += 1
        seq.save(update_fields=["last"])
        return f"{series}-{fy}-{seq.last:06d}"


# --------------------------------------------------------------------------- invoices
def _invoiced_charge_ids():
    return (
        InvoiceLine.objects.filter(charge__isnull=False).exclude(invoice__status="void").values("charge_id")
    )


def billable_charges(bs_year: int, bs_month: int):
    """Unpaid charges up to and including the BS month that are not on a live invoice."""
    end = BSMonth(bs_year, bs_month).end
    period = (
        Q(bs_year__lt=bs_year)
        | Q(bs_year=bs_year, bs_month__lte=bs_month)
        | Q(bs_year__isnull=True, created_at__date__lte=end)
    )
    return (
        Charge.objects.filter(status="unpaid", payer_user__isnull=True)  # Bolau fees: receipts, no invoice
        .filter(period)
        .exclude(id__in=_invoiced_charge_ids())
        .select_related("organization", "payer_partner")
        .order_by("created_at")
    )


def recompute_totals(invoice: Invoice) -> Invoice:
    subtotal = q2(invoice.lines.aggregate(t=Sum("amount"))["t"] or 0)
    invoice.subtotal = subtotal
    invoice.vat_amount = q2(subtotal * D(invoice.vat_rate) / Decimal(100))
    invoice.total = q2(invoice.subtotal + invoice.vat_amount)
    invoice.save(update_fields=["subtotal", "vat_amount", "total"])
    return invoice


def _buyer_fields(payer) -> dict:
    from apps.orgs.models import Organization

    if isinstance(payer, Organization):
        address = ", ".join(x for x in [payer.address, getattr(payer.district, "name_en", "")] if x)
        return {"buyer_name": payer.name, "buyer_address": address[:255], "pan_of_buyer": payer.pan_no or ""}
    return {"buyer_name": payer.name, "buyer_address": "", "pan_of_buyer": ""}


def _add_line(invoice: Invoice, charge: Charge):
    InvoiceLine.objects.create(
        invoice=invoice,
        charge=charge,
        kind=charge.kind,
        description=charge.description[:255],
        quantity=Decimal(1),
        unit_price=charge.amount,
        amount=charge.amount,
    )


@transaction.atomic
def generate_invoices(bs_year: int, bs_month: int) -> list[Invoice]:
    """Draft one invoice per payer (org or partner) for the BS month from its billable charges.

    Idempotent: rerunning appends newly found charges to that payer's existing *draft* for the
    period; charges of a payer whose period invoice is already issued wait for the next period.
    Waived charges never reach an invoice; zero-amount charges are skipped.
    """
    BSMonth(bs_year, bs_month)  # validates
    groups: dict[tuple[str, object], list[Charge]] = {}
    for charge in billable_charges(bs_year, bs_month):
        if charge.amount <= 0:
            continue
        key = ("org", charge.organization) if charge.organization_id else ("partner", charge.payer_partner)
        groups.setdefault(key, []).append(charge)

    today = today_ad()
    touched = []
    for (kind, payer), charges in groups.items():
        lookup = {"organization": payer} if kind == "org" else {"partner": payer}
        period = {"period_bs_year": bs_year, "period_bs_month": bs_month}
        existing = Invoice.objects.filter(**lookup, **period).exclude(status="void").first()
        if existing is not None and existing.status != "draft":
            continue
        invoice = existing or Invoice.objects.create(
            **lookup,
            **period,
            **_buyer_fields(payer),
            issue_date=today,
            due_date=today + dt.timedelta(days=due_days()),
            vat_rate=vat_rate(),
        )
        for charge in charges:
            _add_line(invoice, charge)
        recompute_totals(invoice)
        touched.append(invoice)
    return touched


def paid_amount(invoice: Invoice) -> Decimal:
    return q2(invoice.payments.aggregate(t=Sum("amount"))["t"] or 0)


def credited_amount(invoice: Invoice) -> Decimal:
    return q2(invoice.credit_notes.aggregate(t=Sum("amount"))["t"] or 0)


def balance_due(invoice: Invoice) -> Decimal:
    return q2(D(invoice.total) - paid_amount(invoice) - credited_amount(invoice))


@transaction.atomic
def issue_invoice(invoice: Invoice, user=None, *, on: dt.date | None = None) -> Invoice:
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != "draft":
        raise InvalidState(message="Only draft invoices can be issued.")
    if not invoice.lines.exists() or invoice.total <= 0:
        raise InvalidState(message="An invoice needs at least one line with an amount.")
    issue_date = on or today_ad()
    fy = fiscal_year(issue_date)
    invoice.number = next_number(INVOICE_SERIES, fy)
    invoice.fiscal_year = fy
    invoice.issue_date = issue_date
    invoice.due_date = issue_date + dt.timedelta(days=due_days())
    invoice.status = "issued"
    invoice.issued_at = timezone.now()
    invoice.issued_by = user if (user is not None and user.is_authenticated) else None
    invoice.save()
    _store_pdf(invoice)
    return invoice


def _store_pdf(invoice: Invoice):
    """Keep the as-issued copy (tax invoices must be reproducible exactly as issued)."""
    from .pdf import invoice_pdf

    try:
        invoice.pdf.save(
            f"{invoice.number.replace('/', '-')}.pdf", ContentFile(invoice_pdf(invoice)), save=True
        )
    except Exception:  # noqa: BLE001 - PDF is re-rendered on demand if storing fails
        import logging

        logging.getLogger("kaamsathi.billing").exception("Could not store invoice PDF %s", invoice.number)


@transaction.atomic
def void_invoice(invoice: Invoice, reason: str = "") -> Invoice:
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status not in ("draft", "issued"):
        raise InvalidState(message="Only draft or issued invoices can be voided.")
    if invoice.payments.exists():
        raise InvalidState(message="This invoice has payments; issue a credit note instead.")
    invoice.status = "void"
    invoice.voided_at = timezone.now()
    invoice.void_reason = (reason or "")[:255]
    invoice.save(update_fields=["status", "voided_at", "void_reason"])
    return invoice  # its charges become billable again (live-invoice check excludes void)


def _settle_if_cleared(invoice: Invoice):
    if invoice.status == "issued" and balance_due(invoice) <= 0:
        invoice.status = "paid"
        invoice.paid_at = timezone.now()
        invoice.save(update_fields=["status", "paid_at"])
        charge_ids = invoice.lines.filter(charge__isnull=False).values("charge_id")
        Charge.objects.filter(id__in=charge_ids, status="unpaid").update(status="paid")


@transaction.atomic
def record_payment(
    invoice: Invoice, *, amount, method: str, paid_on: dt.date, reference: str = "", user=None
):
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != "issued":
        raise InvalidState(message="Payments can only be recorded against an issued invoice.")
    amount = q2(amount)
    if amount <= 0:
        raise APIError("validation_error", fields={"amount": ["Must be greater than zero."]})
    if amount > balance_due(invoice):
        raise APIError("validation_error", fields={"amount": ["More than the balance due."]})
    payment = PaymentRecord.objects.create(
        invoice=invoice,
        amount=amount,
        method=method,
        reference=reference or "",
        paid_on=paid_on,
        recorded_by=user if (user is not None and user.is_authenticated) else None,
    )
    _settle_if_cleared(invoice)
    return payment


@transaction.atomic
def create_credit_note(invoice: Invoice, *, amount, reason: str, user=None) -> CreditNote:
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status not in ("issued", "paid"):
        raise InvalidState(message="Credit notes can only be raised against an issued invoice.")
    amount = q2(amount)
    room = q2(D(invoice.total) - credited_amount(invoice))
    if amount <= 0 or amount > room:
        raise APIError("validation_error", fields={"amount": [f"Must be between 0.01 and {room}."]})
    today = today_ad()
    rate = D(invoice.vat_rate)
    note = CreditNote.objects.create(
        invoice=invoice,
        number=next_number(CREDIT_NOTE_SERIES, fiscal_year(today)),
        amount=amount,
        vat_amount=q2(amount * rate / (Decimal(100) + rate)),
        reason=reason[:255],
        issue_date=today,
        created_by=user if (user is not None and user.is_authenticated) else None,
    )
    _settle_if_cleared(invoice)
    return note


def previous_bs_month() -> tuple[int, int]:
    prev = BSMonth.of(today_ad()).previous()
    return prev.year, prev.month
