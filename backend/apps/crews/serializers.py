from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.core.bs import bs_str
from apps.core.phone import mask_phone
from apps.workers.models import Trade
from apps.workers.serializers import card_queryset, worker_card

from . import labels
from .models import Crew, Referral
from .services import crew_stats, hold_until


def _dt(value):
    return timezone.localtime(value).isoformat() if value else None


def referral_queryset():
    return Referral.objects.select_related("crew", "worker", "employment", "application__job__organization")


def referral_data(r: Referral) -> dict:
    job = r.application.job
    emp = r.employment
    until = hold_until(r)
    return {
        "id": str(r.id),
        "crew": {"id": str(r.crew_id), "name": r.crew.name},
        "worker": {
            "id": str(r.worker_id),
            "full_name": r.worker.full_name,
            "phone_masked": mask_phone(r.worker.phone),
        },
        "organization": {"id": str(job.organization_id), "name": job.organization.name},
        "job": {"id": str(job.id), "title": job.title},
        "employment_id": str(emp.id) if emp else None,
        "start_date": emp.start_date.isoformat() if emp else None,
        "start_date_bs": bs_str(emp.start_date) if emp else None,
        "employment_status": emp.status if emp else None,
        "hold_until": until.isoformat() if until else None,
        "hold_until_bs": bs_str(until),
        "amount": f"{r.amount:.2f}",
        "status": r.status,
        "status_label": labels.label(labels.REFERRAL_STATUS, r.status),
        "eligible_at": _dt(r.eligible_at),
        "paid_at": _dt(r.paid_at),
        "payout_ref": r.payout_ref,
        "void_reason": r.void_reason,
        "created_at": _dt(r.created_at),
    }


def member_data(worker, request=None) -> dict:
    data = worker_card(worker, request)
    active = next((e for e in worker.employments.all() if e.status == "active"), None)
    data["is_available"] = worker.is_available
    data["current_employer"] = (
        {"id": str(active.organization_id), "name": active.organization.name} if active else None
    )
    return data


def crew_summary(crew: Crew, request=None) -> dict:
    return {
        "id": str(crew.id),
        "name": crew.name,
        "is_active": crew.is_active,
        "created_at": _dt(crew.created_at),
        "lead": worker_card(crew.lead, request),
        "stats": crew_stats(crew),
    }


def crew_detail(crew: Crew, request=None) -> dict:
    data = crew_summary(crew, request)
    members = card_queryset(crew.members).order_by("full_name")
    data["members"] = [member_data(w, request) for w in members]
    return data


class CrewCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)


class MemberCreateSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    full_name = serializers.CharField(max_length=150)
    trade = serializers.SlugRelatedField(slug_field="code", queryset=Trade.objects.all())
    years_experience = serializers.IntegerField(min_value=0, max_value=60, required=False, default=0)


class MarkPaidSerializer(serializers.Serializer):
    payout_ref = serializers.CharField(max_length=120)


class VoidSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)
