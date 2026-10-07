"""Financial profile builder, offer eligibility and referrals.

Only payslips with ``payment_status=paid`` count as verified earnings. We never lend, hold funds
or charge the worker: a referral is a consented hand-off to a licensed partner.
"""

from __future__ import annotations

import datetime as dt
import statistics
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.core.exceptions import APIError, Duplicate, InvalidState
from apps.core.money import format_npr, money_str, q2

from .models import FinancialProfile, Offer, Referral

# Offer kind → consent purpose.
OFFER_PURPOSE = {
    "loan": "loan_assessment",
    "tool_finance": "loan_assessment",
    "vehicle_finance": "loan_assessment",
    "savings": "verification",
    "ewa": "ewa",
    "insurance": "insurance",
}
REFERRAL_SCOPES = ["earnings.read", "profile.read"]
DEFAULT_GRANT_DAYS = 30


def _months_between(start: dt.date, end: dt.date) -> int:
    if not start or end < start:
        return 0
    return (end.year - start.year) * 12 + (end.month - start.month) - (1 if end.day < start.day else 0)


def income_stability(values: list[Decimal]) -> Decimal | None:
    """1 − coefficient of variation (population σ / mean), floored at 0. None without data."""
    if not values:
        return None
    floats = [float(v) for v in values]
    mean = statistics.fmean(floats)
    if mean <= 0:
        return Decimal("0.000")
    cv = statistics.pstdev(floats) / mean
    return Decimal(str(round(max(0.0, 1.0 - cv), 3)))


def compute_profile_data(worker) -> dict:
    from apps.payroll.models import Payslip

    today = timezone.localdate()
    slips = (
        Payslip.objects.filter(worker=worker, payment_status="paid")
        .select_related("run__organization")
        .order_by("run__bs_year", "run__bs_month")
    )
    months: dict[tuple[int, int], dict] = {}
    employers = set()
    ssf_months = set()
    for s in slips:
        key = (s.run.bs_year, s.run.bs_month)
        m = months.setdefault(
            key,
            {
                "bs_year": key[0],
                "bs_month": key[1],
                "gross": Decimal("0"),
                "net": Decimal("0"),
                "employers": [],
            },
        )
        m["gross"] += s.gross_pay
        m["net"] += s.net_pay
        if s.run.organization.name not in m["employers"]:
            m["employers"].append(s.run.organization.name)
        employers.add(s.run.organization_id)
        if s.ssf_employee and s.ssf_employee > 0:
            ssf_months.add(key)
    monthly = [
        {
            "bs_year": m["bs_year"],
            "bs_month": m["bs_month"],
            "gross": money_str(m["gross"]),
            "net": money_str(m["net"]),
            "employer": ", ".join(m["employers"]),
            "paid": True,
        }
        for _key, m in sorted(months.items())
    ]
    nets = [q2(m["net"]) for m in months.values()]
    employments = list(worker.employments.all())
    first_start = min((e.start_date for e in employments), default=None)
    active = [e for e in employments if e.status == "active"]
    last = max(months) if months else None
    return {
        "months_on_platform": _months_between(first_start, today) if first_start else 0,
        "verified_months": len(months),
        "avg_monthly_net": q2(sum(nets) / len(nets)) if nets else Decimal("0.00"),
        "min_monthly_net": min(nets) if nets else Decimal("0.00"),
        "max_monthly_net": max(nets) if nets else Decimal("0.00"),
        "income_stability": income_stability(nets),
        "employers_count": len(employers),
        "current_employment_months": max((_months_between(e.start_date, today) for e in active), default=0),
        "ssf_months": len(ssf_months),
        "last_payslip_month": f"{last[0]}-{last[1]:02d}" if last else "",
        "monthly": monthly,
    }


def build_profile(worker) -> FinancialProfile:
    data = compute_profile_data(worker)
    profile, _created = FinancialProfile.objects.update_or_create(worker=worker, defaults=data)
    return profile


def refresh_all() -> int:
    from apps.workers.models import Worker

    n = 0
    ids = set(Worker.objects.filter(payslips__payment_status="paid").values_list("id", flat=True))
    ids |= set(FinancialProfile.objects.values_list("worker_id", flat=True))
    for worker in Worker.objects.filter(id__in=ids):
        build_profile(worker)
        n += 1
    return n


# --------------------------------------------------------------------------- eligibility
def eligibility(offer: Offer, profile: FinancialProfile | None) -> dict:
    reasons = []
    verified = profile.verified_months if profile else 0
    avg = profile.avg_monthly_net if profile else Decimal("0")
    if not offer.is_active or not offer.partner.is_active:
        reasons.append(_("This offer is not available right now."))
    if verified < offer.min_verified_months:
        reasons.append(
            _("Needs %(need)s months of verified (paid) payslips — you have %(have)s.")
            % {"need": offer.min_verified_months, "have": verified}
        )
    if offer.min_avg_net is not None and avg < offer.min_avg_net:
        reasons.append(
            _("Needs average monthly net pay of at least %(amount)s.")
            % {"amount": format_npr(offer.min_avg_net)}
        )
    return {"eligible": not reasons, "reasons": reasons}


# --------------------------------------------------------------------------- referrals
@transaction.atomic
def apply_to_offer(worker, offer: Offer, *, amount_requested=None, purpose_note="", days=None) -> Referral:
    from apps.partners.services import create_grant, notify_partner_referral

    profile = build_profile(worker)
    check = eligibility(offer, profile)
    if not check["eligible"]:
        raise InvalidState(message=check["reasons"][0], fields={"offer": check["reasons"]})
    if offer.max_amount is not None and amount_requested is not None and amount_requested > offer.max_amount:
        raise APIError(
            "validation_error",
            fields={
                "amount_requested": [_("Maximum is %(amount)s.") % {"amount": format_npr(offer.max_amount)}]
            },
        )
    if Referral.objects.filter(worker=worker, offer=offer, status__in=Referral.OPEN).exists():
        raise Duplicate(message=_("You already have an open request for this offer."))
    grant = create_grant(
        worker,
        offer.partner,
        purpose=OFFER_PURPOSE.get(offer.kind, "verification"),
        scopes=REFERRAL_SCOPES,
        days=days or DEFAULT_GRANT_DAYS,
        channel="app",
    )
    referral = Referral.objects.create(
        worker=worker,
        offer=offer,
        partner=offer.partner,
        grant=grant,
        amount_requested=amount_requested,
        purpose_note=purpose_note or "",
        status="submitted",
        history=[{"status": "submitted", "at": timezone.now().isoformat(), "note": ""}],
    )
    notify_partner_referral(referral, "referral.created")
    return referral


@transaction.atomic
def partner_update_status(
    referral: Referral, *, status: str, partner_ref=None, amount_approved=None, note=None
):
    """Only called from the partner API: the partner owns the decision and the money."""
    referral = Referral.objects.select_for_update().get(pk=referral.pk)
    if status != referral.status and status not in Referral.TRANSITIONS.get(referral.status, set()):
        raise InvalidState(message=f"Cannot move a referral from {referral.status} to {status}.")
    referral.status = status
    if partner_ref is not None:
        referral.partner_ref = partner_ref
    if amount_approved is not None:
        referral.amount_approved = amount_approved
    if note is not None:
        referral.partner_note = note
    referral.history = [
        *referral.history,
        {"status": status, "at": timezone.now().isoformat(), "note": note or ""},
    ]
    referral.save()
    _notify_worker(referral)
    return referral


def _notify_worker(referral: Referral):
    from apps.notifications.services import send_sms
    from apps.partners.labels import REFERRAL_STATUS

    body = (
        f"KaamSathi: {referral.partner.name} updated your request '{referral.offer.title}': "
        f"{REFERRAL_STATUS.get(referral.status, referral.status)}."
    )
    send_sms(referral.worker.phone, str(body), kind="finance_referral")


def referral_webhook_data(referral: Referral) -> dict:
    return {
        "referral_id": str(referral.id),
        "status": referral.status,
        "offer": {"id": str(referral.offer_id), "kind": referral.offer.kind, "title": referral.offer.title},
        "worker_id": str(referral.worker_id),
        "grant": {
            "id": str(referral.grant_id),
            "purpose": referral.grant.purpose,
            "scopes": referral.grant.scopes,
            "expires_at": referral.grant.expires_at.isoformat(),
        },
        "amount_requested": money_str(referral.amount_requested)
        if referral.amount_requested is not None
        else None,
        "purpose_note": referral.purpose_note,
        "created_at": referral.created_at.isoformat(),
    }
