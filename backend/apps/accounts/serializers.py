from rest_framework import serializers

from apps.core.phone import is_valid_phone, normalize_phone
from apps.core.serializers import file_url

from .models import StaffProfile, User


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
    staff_roles = serializers.SerializerMethodField()
    mfa_enabled = serializers.SerializerMethodField()
    mfa_required = serializers.SerializerMethodField()
    pending_legal = serializers.SerializerMethodField()

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
            "staff_roles",
            "mfa_enabled",
            "mfa_required",
            "pending_legal",
        ]
        read_only_fields = ["id", "phone", "is_staff"]

    def get_pending_legal(self, obj):
        from .legal import doc_ref, pending_for

        return [doc_ref(d) for d in pending_for(obj)]

    def get_staff_roles(self, obj):
        from .staff_roles import STAFF_ROLES, user_roles

        roles = user_roles(obj)
        return [r for r in STAFF_ROLES if r in roles]

    def get_mfa_enabled(self, obj):
        profile = StaffProfile.objects.filter(user=obj).only("mfa_enabled").first()
        return bool(profile and profile.mfa_enabled)

    def get_mfa_required(self, obj):
        from django.conf import settings

        return bool(obj.is_staff and getattr(settings, "STAFF_MFA_REQUIRED", False))

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


class MFALoginSerializer(serializers.Serializer):
    mfa_token = serializers.CharField()
    code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    recovery_code = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate(self, attrs):
        if not (attrs.get("code") or attrs.get("recovery_code")):
            raise serializers.ValidationError({"code": ["Enter the code from your authenticator app."]})
        return attrs


class MFACodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=10)


class SessionDeviceSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user_agent = serializers.CharField()
    ip = serializers.CharField(allow_null=True)
    platform = serializers.CharField()
    created_at = serializers.DateTimeField()
    last_seen_at = serializers.DateTimeField()
    current = serializers.SerializerMethodField()

    def get_current(self, obj):
        return str(obj.pk) == str(self.context.get("current_sid") or "")


class StaffSerializer(serializers.ModelSerializer):
    """Ops staff admin (GET|POST /ops/staff, PATCH /ops/staff/{user_id})."""

    roles = serializers.SerializerMethodField()
    mfa_enabled = serializers.SerializerMethodField()
    mfa_enrolled_at = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "phone",
            "full_name",
            "is_active",
            "roles",
            "mfa_enabled",
            "mfa_enrolled_at",
            "last_login",
            "date_joined",
        ]

    def _profile(self, obj):
        try:
            return obj.staff_profile
        except StaffProfile.DoesNotExist:
            return None

    def get_roles(self, obj):
        profile = self._profile(obj)
        return list(profile.roles or []) if profile else []

    def get_mfa_enabled(self, obj):
        profile = self._profile(obj)
        return bool(profile and profile.mfa_enabled)

    def get_mfa_enrolled_at(self, obj):
        profile = self._profile(obj)
        return profile.mfa_enrolled_at.isoformat() if profile and profile.mfa_enrolled_at else None


def _roles_field():
    from .staff_roles import STAFF_ROLES

    return serializers.ListField(child=serializers.ChoiceField(choices=list(STAFF_ROLES)), allow_empty=True)


class StaffCreateSerializer(serializers.Serializer):
    phone = PhoneField()
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    roles = _roles_field()


class StaffUpdateSerializer(serializers.Serializer):
    roles = _roles_field()
    is_active = serializers.BooleanField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["roles"].required = False
