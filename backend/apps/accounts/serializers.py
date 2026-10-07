from rest_framework import serializers

from apps.core.phone import is_valid_phone, normalize_phone
from apps.core.serializers import file_url

from .models import User


class PhoneField(serializers.CharField):
    def to_internal_value(self, data):
        phone = normalize_phone(super().to_internal_value(data))
        if not is_valid_phone(phone):
            raise serializers.ValidationError("Enter a valid 10-digit mobile number (97/98…).")
        return phone


class OTPRequestSerializer(serializers.Serializer):
    phone = PhoneField()


class OTPVerifySerializer(serializers.Serializer):
    phone = PhoneField()
    code = serializers.CharField(max_length=10)


class RefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class MeSerializer(serializers.ModelSerializer):
    worker_id = serializers.SerializerMethodField()
    memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "phone",
            "full_name",
            "email",
            "preferred_language",
            "is_staff",
            "worker_id",
            "memberships",
        ]
        read_only_fields = ["id", "phone", "is_staff"]

    def get_worker_id(self, obj):
        worker = getattr(obj, "worker", None) if hasattr(obj, "worker") else None
        return str(worker.id) if worker else None

    def get_memberships(self, obj):
        request = self.context.get("request")
        out = []
        qs = (
            obj.memberships.filter(is_active=True, organization__is_active=True)
            .select_related("organization")
            .prefetch_related("sites")
        )
        for m in qs:
            org = m.organization
            out.append(
                {
                    "id": str(m.id),
                    "role": m.role,
                    "organization": {
                        "id": str(org.id),
                        "name": org.name,
                        "logo": file_url(request, org.logo),
                        "industry": org.industry,
                    },
                    "site_ids": [str(s.id) for s in m.sites.all()],
                }
            )
        return out
