from __future__ import annotations

import os

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core import labels as core_labels
from apps.core.bs import today_ad
from apps.core.files import request_user, signed_url
from apps.core.serializers import BSModelSerializer, ref, trade_ref
from apps.partners.models import Partner
from apps.workers.models import Trade, Worker

from . import labels
from .models import SHARE_MAX_DAYS, Credential, Passport, PassportShare, SkillAssessment
from .services import public_url, share_url

ALLOWED_DOC_EXT = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
MAX_DOC_BYTES = 10 * 1024 * 1024


def worker_ref(worker: Worker) -> dict:
    return {
        "id": str(worker.id),
        "full_name": worker.full_name,
        "phone": worker.phone,
        "verification_status": worker.verification_status,
    }


class CredentialSerializer(BSModelSerializer):
    """Credential as the worker (and ops) see it."""

    kind_label = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    verification_method_label = serializers.SerializerMethodField()
    document = serializers.FileField(required=False, allow_null=True, write_only=True)
    document_url = serializers.SerializerMethodField()
    document_type = serializers.SerializerMethodField()
    days_to_expiry = serializers.SerializerMethodField()

    class Meta:
        model = Credential
        fields = [
            "id",
            "kind",
            "kind_label",
            "title",
            "issuer",
            "certificate_no",
            "level",
            "issued_on",
            "expires_on",
            "document",
            "document_url",
            "document_type",
            "status",
            "status_label",
            "verification_method",
            "verification_method_label",
            "verified_at",
            "note",
            "days_to_expiry",
            "created_at",
            "resubmission_of",
        ]
        read_only_fields = [
            "status",
            "verification_method",
            "verified_at",
            "note",
            "created_at",
            "resubmission_of",
        ]

    def get_kind_label(self, obj):
        return core_labels.label(labels.KIND, obj.kind)

    def get_status_label(self, obj):
        return core_labels.label(labels.STATUS, obj.status)

    def get_verification_method_label(self, obj):
        return core_labels.label(labels.METHOD, obj.verification_method)

    def get_document_url(self, obj):
        # Only the worker themself and ops staff are served this serializer (see views).
        request = self.context.get("request")
        return signed_url(obj.document, request_user(request), request, check=f"credential:{obj.pk}")

    def get_document_type(self, obj):
        """``pdf`` | ``image`` | None — lets clients pick a viewer without fetching the file."""
        if not obj.document:
            return None
        return "pdf" if os.path.splitext(obj.document.name)[1].lower() == ".pdf" else "image"

    def get_days_to_expiry(self, obj):
        if not obj.expires_on:
            return None
        return (obj.expires_on - today_ad()).days

    def validate_document(self, value):
        if value is None:
            return value
        ext = os.path.splitext(value.name or "")[1].lower()
        if ext not in ALLOWED_DOC_EXT:
            raise serializers.ValidationError(_("Upload a PDF or a photo (JPG, PNG)."))
        if value.size and value.size > MAX_DOC_BYTES:
            raise serializers.ValidationError(_("File is too large (maximum 10 MB)."))
        from apps.core.uploads import validate_upload  # magic bytes, EXIF strip, PDF scripts, ClamAV

        return validate_upload(value, kinds={"image", "pdf"}, max_mb=10)

    def validate(self, attrs):
        issued = attrs.get("issued_on", getattr(self.instance, "issued_on", None))
        expires = attrs.get("expires_on", getattr(self.instance, "expires_on", None))
        if issued and expires and expires < issued:
            raise serializers.ValidationError(
                {"expires_on": [_("Expiry date cannot be before the issue date.")]}
            )
        if issued and issued > today_ad():
            raise serializers.ValidationError({"issued_on": [_("Issue date cannot be in the future.")]})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        prev = instance.resubmission_of if instance.resubmission_of_id else None
        # G012: link to the rejected record (with its rejection note) and whether it can be resubmitted
        data["resubmission_of"] = (
            {
                "id": str(prev.id),
                "status": prev.status,
                "note": prev.note,
                "created_at": prev.created_at.isoformat(),
            }
            if prev
            else None
        )
        data["can_resubmit"] = instance.status == "rejected" and not any(
            r.status in ("pending", "verified") for r in instance.resubmissions.all()
        )
        return data


class OpsCredentialSerializer(CredentialSerializer):
    worker = serializers.SerializerMethodField()
    verified_by = serializers.SerializerMethodField()

    class Meta(CredentialSerializer.Meta):
        fields = [*CredentialSerializer.Meta.fields, "worker", "verified_by"]

    def get_worker(self, obj):
        return worker_ref(obj.worker)

    def get_verified_by(self, obj):
        return ref(obj.verified_by, "id", "full_name")


class ExpiringCredentialSerializer(CredentialSerializer):
    worker = serializers.SerializerMethodField()

    class Meta(CredentialSerializer.Meta):
        fields = [
            "id",
            "kind",
            "kind_label",
            "title",
            "issuer",
            "level",
            "expires_on",
            "status",
            "status_label",
            "days_to_expiry",
            "worker",
        ]

    def get_worker(self, obj):
        return {"id": str(obj.worker.id), "full_name": obj.worker.full_name}


class VerifyCredentialSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["verified", "rejected"])
    method = serializers.ChoiceField(choices=list(labels.METHOD.keys()), default="document")
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=1000)


class AssessmentSerializer(BSModelSerializer):
    worker_id = serializers.PrimaryKeyRelatedField(
        source="worker", queryset=Worker.objects.all(), write_only=True
    )
    trade = serializers.SlugRelatedField(slug_field="code", queryset=Trade.objects.all())
    assessor_partner_id = serializers.PrimaryKeyRelatedField(
        source="assessor_partner", queryset=Partner.objects.all(), required=False, allow_null=True
    )
    score = serializers.IntegerField(min_value=0, max_value=100, required=False, allow_null=True)
    result_label = serializers.SerializerMethodField()

    class Meta:
        model = SkillAssessment
        fields = [
            "id",
            "worker_id",
            "trade",
            "assessor_partner_id",
            "assessed_on",
            "result",
            "result_label",
            "score",
            "level",
            "notes",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_result_label(self, obj):
        return core_labels.label(labels.RESULT, obj.result)

    def validate_assessed_on(self, value):
        if value > today_ad():
            raise serializers.ValidationError(_("Assessment date cannot be in the future."))
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["trade"] = trade_ref(instance.trade)
        data["worker"] = worker_ref(instance.worker)
        data["assessor_user"] = ref(instance.assessor_user, "id", "full_name")
        data["assessor_partner"] = ref(instance.assessor_partner, "id", "name")
        return data


class PassportSerializer(serializers.ModelSerializer):
    public_url = serializers.SerializerMethodField()

    class Meta:
        model = Passport
        fields = ["public_code", "is_public", "show_contact", "updated_at", "public_url"]
        read_only_fields = ["public_code", "updated_at"]

    def get_public_url(self, obj):
        return public_url(obj)


class PassportShareSerializer(serializers.ModelSerializer):
    days = serializers.IntegerField(min_value=1, max_value=SHARE_MAX_DAYS, write_only=True, default=30)
    purpose_label = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = PassportShare
        fields = [
            "id",
            "audience_label",
            "purpose",
            "purpose_label",
            "days",
            "include_contact",
            "expires_at",
            "views",
            "revoked_at",
            "created_at",
            "is_active",
            "url",
        ]
        read_only_fields = ["expires_at", "views", "revoked_at", "created_at"]

    def get_purpose_label(self, obj):
        return core_labels.label(labels.SHARE_PURPOSE, obj.purpose)

    def get_url(self, obj):
        return share_url(obj)

    def get_is_active(self, obj):
        return obj.revoked_at is None and obj.expires_at > timezone.now()
