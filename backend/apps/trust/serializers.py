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
            "booking": {"id": str(d.booking_id), "code": d.booking.code} if d.booking_id else None,
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
            # N006 / N008
            "evidence_count": getattr(d, "evidence_count", None)
            if getattr(d, "evidence_count", None) is not None
            else d.evidence.count(),
            "can_appeal": d.can_appeal(),
            "appeal_deadline": _dt(d.appeal_deadline()),
            "appeal": (
                {
                    "reason": d.appeal_reason,
                    "party": d.appealed_by_party,
                    "appealed_at": _dt(d.appealed_at),
                    "outcome": d.appeal_outcome,
                    "outcome_label": labels.label(labels.APPEAL_OUTCOME, d.appeal_outcome),
                    "resolution_note": d.appeal_resolution_note,
                    "resolved_by": (
                        {"id": str(d.appeal_resolved_by_id), "full_name": d.appeal_resolved_by.full_name}
                        if d.appeal_resolved_by_id
                        else None
                    ),
                    "resolved_at": _dt(d.appeal_resolved_at),
                }
                if d.appealed_at
                else None
            ),
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
        if attrs.get("kind") == "booking":  # Bolau disputes are raised from the booking itself
            raise serializers.ValidationError(
                {"kind": ["Raise booking disputes from the booking (POST /bolau/bookings/{id}/dispute)."]}
            )
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


class AppealSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000)


class AppealDecisionSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=list(labels.APPEAL_OUTCOME))
    note = serializers.CharField(max_length=2000)


class EvidenceUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, allow_null=True)

    def validate_file(self, value):
        from apps.core.uploads import validate_upload

        return validate_upload(value, kinds={"image", "pdf"}, max_mb=10)


def evidence_payload(e, request=None) -> dict:
    """Evidence row; the URL is issued to the requesting user (callers already checked access)."""
    from apps.core.files import request_user, signed_url

    return {
        "id": str(e.id),
        "dispute_id": str(e.dispute_id),
        "file_url": signed_url(e.file, request_user(request), request, check=f"dispute_evidence:{e.pk}"),
        "file_type": e.file_type,
        "party": e.party,
        "party_label": labels.label(labels.EVIDENCE_PARTY, e.party),
        "uploaded_by": (
            {"id": str(e.uploaded_by_id), "full_name": e.uploaded_by.full_name} if e.uploaded_by_id else None
        ),
        "note": e.note,
        "created_at": _dt(e.created_at),
    }
