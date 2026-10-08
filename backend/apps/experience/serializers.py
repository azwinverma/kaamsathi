from __future__ import annotations

import os
import re

from django.utils.translation import pgettext_lazy
from rest_framework import serializers

from apps.core import labels as core_labels
from apps.core.bs import today_ad
from apps.core.files import request_user, signed_url, worker_file_url
from apps.core.phone import mask_phone, normalize_phone
from apps.core.serializers import BSModelSerializer, district_ref, ref, trade_ref
from apps.geo.models import District
from apps.orgs.models import Organization
from apps.workers.models import Trade

from . import labels
from .models import WorkHistoryEntry
from .services import validate_document

PHONE_DIGITS = re.compile(r"^\d{7,15}$")


class WorkHistorySerializer(BSModelSerializer):
    """Entry as the worker sees it (their own data, reference phone included)."""

    aliases = {"employer_org": "employer_org_id"}

    employer_org_id = serializers.PrimaryKeyRelatedField(
        source="employer_org",
        queryset=Organization.objects.filter(is_active=True),
        required=False,
        allow_null=True,
        write_only=True,
    )
    trade = serializers.SlugRelatedField(
        slug_field="code", queryset=Trade.objects.all(), required=False, allow_null=True
    )
    district = serializers.SlugRelatedField(
        slug_field="code", queryset=District.objects.all(), required=False, allow_null=True
    )
    reference_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    document = serializers.FileField(required=False, allow_null=True, write_only=True)
    document_url = serializers.SerializerMethodField()
    document_type = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    verification_method_label = serializers.SerializerMethodField()
    months = serializers.IntegerField(read_only=True)
    editable = serializers.SerializerMethodField()

    class Meta:
        model = WorkHistoryEntry
        fields = [
            "id",
            "employer_name",
            "employer_org_id",
            "trade",
            "role_title",
            "district",
            "start_date",
            "end_date",
            "months",
            "description",
            "reference_name",
            "reference_phone",
            "document",
            "document_url",
            "document_type",
            "status",
            "status_label",
            "verification_method",
            "verification_method_label",
            "verified_at",
            "note",
            "editable",
            "created_at",
        ]
        read_only_fields = ["id", "status", "verification_method", "verified_at", "note", "created_at"]

    def get_document_url(self, obj):
        request = self.context.get("request")
        return signed_url(obj.document, request_user(request), request, check=f"work_history:{obj.pk}")

    def get_document_type(self, obj):
        if not obj.document:
            return None
        return "pdf" if os.path.splitext(obj.document.name)[1].lower() == ".pdf" else "image"

    def get_status_label(self, obj):
        return core_labels.label(labels.STATUS, obj.status)

    def get_verification_method_label(self, obj):
        return core_labels.label(labels.METHOD, obj.verification_method)

    def get_editable(self, obj):
        return obj.status != "verified"

    def validate_reference_phone(self, value):
        if not value:
            return None
        digits = normalize_phone(value)
        if not PHONE_DIGITS.match(digits):
            raise serializers.ValidationError(pgettext_lazy("growth", "Enter a valid phone number."))
        return digits

    def validate_document(self, value):
        return validate_document(value)

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        today = today_ad()
        if start and start > today:
            raise serializers.ValidationError(
                {"start_date": [pgettext_lazy("growth", "Start date cannot be in the future.")]}
            )
        if end and end > today:
            raise serializers.ValidationError(
                {"end_date": [pgettext_lazy("growth", "End date cannot be in the future.")]}
            )
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": [pgettext_lazy("growth", "End date cannot be before the start date.")]}
            )
        name = attrs.get("reference_name", getattr(self.instance, "reference_name", None))
        phone = attrs.get("reference_phone", getattr(self.instance, "reference_phone", None))
        if phone and not name:
            raise serializers.ValidationError(
                {"reference_name": [pgettext_lazy("growth", "Who should we call at this number?")]}
            )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["trade"] = trade_ref(instance.trade)
        data["district"] = district_ref(instance.district)
        data["employer_org"] = ref(instance.employer_org, "id", "name")
        return data


class OpsWorkHistorySerializer(WorkHistorySerializer):
    """Ops reference-check queue: reference phone is shown to ops only."""

    worker = serializers.SerializerMethodField()
    verified_by = serializers.SerializerMethodField()

    class Meta(WorkHistorySerializer.Meta):
        fields = [*WorkHistorySerializer.Meta.fields, "worker", "verified_by", "updated_at"]

    def get_worker(self, obj):
        w = obj.worker
        return {
            "id": str(w.id),
            "full_name": w.full_name,
            "phone": w.phone,
            "verification_status": w.verification_status,
        }

    def get_verified_by(self, obj):
        return ref(obj.verified_by, "id", "full_name")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        org = instance.employer_org
        if org is not None:
            data["employer_org"]["verification_status"] = getattr(org, "verification_status", None)
        return data


class OrgWorkHistorySerializer(serializers.ModelSerializer):
    """What an on-platform employer sees when asked to confirm — never the reference or documents."""

    class Meta:
        model = WorkHistoryEntry
        fields = ["id", "employer_name", "role_title", "start_date", "end_date", "description", "status"]

    def to_representation(self, instance):
        from apps.core.bs import bs_str

        data = super().to_representation(instance)
        request = self.context.get("request")
        w = instance.worker
        data.update(
            {
                "worker": {
                    "id": str(w.id),
                    "full_name": w.full_name,
                    "phone_masked": mask_phone(w.phone),
                    "photo": worker_file_url(request, w, "photo"),
                },
                "trade": trade_ref(instance.trade),
                "district": district_ref(instance.district),
                "start_date_bs": bs_str(instance.start_date),
                "end_date_bs": bs_str(instance.end_date),
                "months": instance.months,
                "status_label": core_labels.label(labels.STATUS, instance.status),
                "verification_method": instance.verification_method,
                "verified_at": instance.verified_at.isoformat() if instance.verified_at else None,
                "created_at": instance.created_at.isoformat(),
            }
        )
        return data


class OpsVerifySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["verified", "unverifiable", "rejected"])
    method = serializers.ChoiceField(choices=list(labels.METHOD), required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="", max_length=2000)

    def validate(self, attrs):
        if attrs["status"] == "verified" and not attrs.get("method"):
            raise serializers.ValidationError(
                {"method": [pgettext_lazy("growth", "Say how this was verified.")]}
            )
        if attrs["status"] != "verified" and not (attrs.get("note") or "").strip():
            raise serializers.ValidationError(
                {"note": [pgettext_lazy("growth", "Add a note for the worker.")]}
            )
        return attrs


class EmployerDecisionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="", max_length=2000)
