from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.core import labels
from apps.core.files import signed_url
from apps.core.phone import mask_phone

from .models import KIND, STATUS, PrivacyRequest


class PrivacyRequestSerializer(serializers.ModelSerializer):
    """Worker view (/me/privacy-requests)."""

    kind = serializers.ChoiceField(choices=list(KIND))
    details = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=4000)
    kind_label = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    file_available = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = PrivacyRequest
        fields = [
            "id",
            "kind",
            "kind_label",
            "status",
            "status_label",
            "details",
            "response_note",
            "created_at",
            "completed_at",
            "file_available",
            "file_expires_at",
            "download_url",
        ]
        read_only_fields = ["id", "status", "response_note", "created_at", "completed_at", "file_expires_at"]

    def validate(self, attrs):
        if attrs.get("kind") == "correction" and not (attrs.get("details") or "").strip():
            raise serializers.ValidationError({"details": [_("Tell us what needs to be corrected.")]})
        return attrs

    def get_kind_label(self, obj):
        return labels.label(KIND, obj.kind)

    def get_status_label(self, obj):
        return labels.label(STATUS, obj.status)

    def get_file_available(self, obj):
        return obj.file_available

    def get_download_url(self, obj):
        if not obj.file_available:
            return None
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return signed_url(obj.file, user, request, check=f"privacy:{obj.id}")


class OpsPrivacyRequestSerializer(PrivacyRequestSerializer):
    worker = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    handled_by = serializers.SerializerMethodField()
    active_employments = serializers.SerializerMethodField()

    class Meta(PrivacyRequestSerializer.Meta):
        fields = [*PrivacyRequestSerializer.Meta.fields, "worker", "user", "handled_by", "active_employments"]

    def get_worker(self, obj):
        w = obj.worker
        if w is None:
            return None
        return {"id": str(w.id), "full_name": w.full_name, "phone_masked": mask_phone(w.phone)}

    def get_user(self, obj):
        u = obj.user
        if u is None:
            return None
        return {"id": str(u.id), "full_name": u.full_name, "phone": u.phone}

    def get_handled_by(self, obj):
        u = obj.handled_by
        return {"id": str(u.id), "full_name": u.full_name} if u else None

    def get_active_employments(self, obj):
        if obj.worker_id is None:
            return 0
        return obj.worker.employments.filter(status="active").count()


class ProcessSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=4000)

    def validate(self, attrs):
        if attrs["action"] == "reject" and not (attrs.get("note") or "").strip():
            raise serializers.ValidationError({"note": [_("Give the reason for rejecting.")]})
        return attrs
