from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.core.bs import bs_str
from apps.core.phone import mask_phone

from . import labels
from .models import Dispute, ProfileView


def _dt(value):
    return timezone.localtime(value).isoformat() if value else None


def _ref(obj, *fields):
    if obj is None:
        return None
    return {"id": str(obj.pk), **{f: getattr(obj, f) for f in fields}}


class ProfileViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfileView
        fields = ["id", "context", "created_at"]

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "organization": _ref(instance.organization, "name"),
            "partner": _ref(instance.partner, "name"),
            "context": instance.context,
            "context_label": labels.label(labels.VIEW_CONTEXT, instance.context),
            "created_at": _dt(instance.created_at),
        }


class DisputeSerializer(serializers.ModelSerializer):
    """Read shape shared by worker, employer and ops endpoints."""

    class Meta:
        model = Dispute
        fields = ["id"]

    def to_representation(self, d):
        emp = d.employment
        slip = d.payslip
        return {
            "id": str(d.id),
            "worker": {
                "id": str(d.worker_id),
                "full_name": d.worker.full_name,
                "phone_masked": mask_phone(d.worker.phone),
            },
            "organization": _ref(d.organization, "name"),
            "employment": {"id": str(emp.id), "designation": emp.designation} if emp else None,
            "payslip": (
                {"id": str(slip.id), "bs_year": slip.run.bs_year, "bs_month": slip.run.bs_month}
                if slip
                else None
            ),
            "attendance_date": d.attendance_date.isoformat() if d.attendance_date else None,
            "attendance_date_bs": bs_str(d.attendance_date),
            "kind": d.kind,
            "kind_label": labels.label(labels.DISPUTE_KIND, d.kind),
            "description": d.description,
            "status": d.status,
            "status_label": labels.label(labels.DISPUTE_STATUS, d.status),
            "employer_note": d.employer_note,
            "resolution_note": d.resolution_note,
            "raised_at": _dt(d.raised_at),
            "responded_at": _dt(d.responded_at),
            "resolved_by": (
                {"id": str(d.resolved_by_id), "full_name": d.resolved_by.full_name}
                if d.resolved_by_id
                else None
            ),
            "resolved_at": _dt(d.resolved_at),
            "sla_due_at": _dt(d.sla_due_at),
            "overdue": bool(d.sla_due_at and d.sla_due_at < timezone.now()),
            "escalated": d.escalated,
        }


class DisputeCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=list(labels.DISPUTE_KIND))
    description = serializers.CharField(max_length=2000)
    employment_id = serializers.UUIDField(required=False, allow_null=True)
    payslip_id = serializers.UUIDField(required=False, allow_null=True)
    attendance_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        from apps.payroll.models import Payslip
        from apps.workforce.models import Employment

        worker = self.context["worker"]
        employment = payslip = None
        if attrs.get("employment_id"):
            employment = (
                Employment.objects.select_related("organization")
                .filter(pk=attrs["employment_id"], worker=worker)
                .first()
            )
            if employment is None:
                raise serializers.ValidationError(
                    {"employment_id": [str(labels.MESSAGES["not_your_employment"])]}
                )
        if attrs.get("payslip_id"):
            payslip = (
                Payslip.objects.select_related("run__organization", "employment")
                .filter(pk=attrs["payslip_id"], worker=worker)
                .first()
            )
            if payslip is None:
                raise serializers.ValidationError({"payslip_id": [str(labels.MESSAGES["not_your_payslip"])]})
            employment = employment or payslip.employment
        kind = attrs["kind"]
        if kind in ("attendance", "wage", "employment_dates", "rating") and employment is None:
            raise serializers.ValidationError({"employment_id": [str(labels.MESSAGES["dispute_needs_org"])]})
        attrs["employment"] = employment
        attrs["payslip"] = payslip
        attrs["organization"] = (
            employment.organization if employment else (payslip.run.organization if payslip else None)
        )
        return attrs


class RespondSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=2000)


class ResolveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["resolved", "rejected"])
    note = serializers.CharField(max_length=2000)


class WorkerRateSerializer(serializers.Serializer):
    score_a = serializers.IntegerField(min_value=1, max_value=5)
    score_b = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=1000)
