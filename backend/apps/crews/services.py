"""Crew (naike) services: referral lifecycle and member management."""

from __future__ import annotations

import datetime as dt
import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.translation import override

from apps.core.bs import today_ad
from apps.core.exceptions import APIError, InvalidState
from apps.core.phone import is_valid_phone, normalize_phone

from . import labels
from .models import Crew, Referral

logger = logging.getLogger("kaamsathi.crews")


def referral_fee() -> Decimal:
    return Decimal(str(settings.NAIKE_REFERRAL_FEE)).quantize(Decimal("0.01"))


def hold_days() -> int:
    return int(settings.NAIKE_REFERRAL_HOLD_DAYS)


def _en(text) -> str:
    with override("en"):
        return str(text)


def active_crew_for(worker) -> Crew | None:
    if not worker.naike_id or worker.naike_id == worker.pk:
        return None
    return Crew.objects.filter(lead_id=worker.naike_id, is_active=True).first()


def create_referral_for_application(application) -> Referral | None:
    """Pending referral when a crew member's application reaches ``joined`` (idempotent)."""
    if application.stage != "joined":
        return None
    worker = application.worker
    crew = active_crew_for(worker)
    if crew is None:
        return None
    existing = Referral.objects.filter(application=application).first()
    if existing:
        return existing
    employment = application.employments.order_by("-created_at").first()
    referral, _ = Referral.objects.get_or_create(
        application=application,
        defaults={
            "crew": crew,
            "worker": worker,
            "employment": employment,
            "amount": referral_fee(),
            "status": "pending",
        },
    )
    return referral


def hold_until(referral: Referral) -> dt.date | None:
    emp = referral.employment
    if emp is None:
        return None
    return emp.start_date + dt.timedelta(days=hold_days())


def update_eligibility(today: dt.date | None = None) -> dict:
    """pending → eligible after the hold period with the employment still active; → void if it
    ended earlier."""
    today = today or today_ad()
    days = hold_days()
    counts = {"eligible": 0, "void": 0}
    for ref in Referral.objects.filter(status="pending").select_related("employment", "application"):
        emp = ref.employment or ref.application.employments.order_by("-created_at").first()
        if emp is None:
            ref.status = "void"
            ref.void_reason = _en(labels.MESSAGES["void_no_employment"])
            ref.save(update_fields=["status", "void_reason"])
            counts["void"] += 1
            continue
        hold_end = emp.start_date + dt.timedelta(days=days)
        if emp.status == "ended" and emp.end_date and emp.end_date < hold_end:
            ref.status = "void"
            ref.void_reason = _en(labels.MESSAGES["void_ended_early"])
            ref.employment = emp
            ref.save(update_fields=["status", "void_reason", "employment"])
            counts["void"] += 1
        elif today >= hold_end:
            ref.status = "eligible"
            ref.eligible_at = timezone.now()
            ref.employment = emp
            ref.save(update_fields=["status", "eligible_at", "employment"])
            counts["eligible"] += 1
    return counts


def mark_paid(referral: Referral, payout_ref: str) -> Referral:
    if referral.status != "eligible":
        raise InvalidState(message=str(labels.MESSAGES["not_eligible"]))
    referral.status = "paid"
    referral.paid_at = timezone.now()
    referral.payout_ref = payout_ref
    referral.save(update_fields=["status", "paid_at", "payout_ref"])
    return referral


def void(referral: Referral, reason: str) -> Referral:
    if referral.status not in ("pending", "eligible"):
        raise InvalidState(message=str(labels.MESSAGES["cannot_void"]))
    referral.status = "void"
    referral.void_reason = reason
    referral.save(update_fields=["status", "void_reason"])
    return referral


# --------------------------------------------------------------------------- crew management
def become_lead(worker, name: str) -> tuple[Crew, bool]:
    crew = Crew.objects.filter(lead=worker).first()
    if crew and crew.is_active:
        from apps.core.exceptions import Duplicate

        raise Duplicate(message=str(labels.MESSAGES["already_lead"]))
    if crew:  # reactivate
        crew.name = name
        crew.is_active = True
        crew.save(update_fields=["name", "is_active"])
        return crew, False
    return Crew.objects.create(lead=worker, name=name), True


@transaction.atomic
def add_member(crew: Crew, *, phone, full_name, trade, years_experience=0):
    """Create or link a Worker under this naike. New workers start unverified; the member's own
    consent is recorded only when they log in and accept (POST /me/consents)."""
    from apps.notifications.services import send_sms
    from apps.workers.models import Worker, WorkerSkill

    if not crew.is_active:
        raise InvalidState(message=str(labels.MESSAGES["crew_inactive"]))
    phone = normalize_phone(phone)
    if not is_valid_phone(phone):
        raise APIError("validation_error", fields={"phone": [str(labels.MESSAGES["invalid_phone"])]})
    worker = Worker.objects.select_for_update().filter(phone=phone).first()
    created = worker is None
    if worker is not None:
        if worker.pk == crew.lead_id:
            raise APIError("validation_error", fields={"phone": [str(labels.MESSAGES["self_member"])]})
        if worker.naike_id and worker.naike_id != crew.lead_id:
            raise InvalidState(message=str(labels.MESSAGES["in_other_crew"]))
        if worker.naike_id != crew.lead_id:
            worker.naike_id = crew.lead_id
            worker.save(update_fields=["naike", "updated_at"])
    else:
        worker = Worker.objects.create(
            phone=phone,
            full_name=full_name,
            naike_id=crew.lead_id,
            verification_status="unverified",
            current_district=crew.lead.current_district,
        )
    WorkerSkill.objects.get_or_create(
        worker=worker, trade=trade, defaults={"years_experience": years_experience or 0}
    )
    send_sms(
        phone,
        f"KaamSathi: {crew.lead.full_name} added you to the crew '{crew.name}'. "
        "Log in to KaamSathi with this number to see jobs and accept.",
        kind="crew_invite",
    )
    return worker, created


def remove_member(crew: Crew, worker) -> None:
    if worker.naike_id != crew.lead_id or worker.pk == crew.lead_id:
        raise APIError("not_found", message=str(labels.MESSAGES["not_member"]), status_code=404)
    worker.naike = None
    worker.save(update_fields=["naike", "updated_at"])


def crew_stats(crew: Crew) -> dict:
    since = timezone.now() - dt.timedelta(days=90)
    refs = Referral.objects.filter(crew=crew)

    def total(*statuses) -> str:
        value = refs.filter(status__in=statuses).aggregate(s=Sum("amount"))["s"] or Decimal("0")
        return f"{value:.2f}"

    return {
        "members": crew.members.count(),
        "placed_90d": refs.filter(created_at__gte=since).exclude(status="void").count(),
        "earned_total": total("paid"),
        "pending_total": total("pending", "eligible"),
    }
