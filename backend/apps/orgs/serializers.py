from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import PhoneField
from apps.core import labels
from apps.core.serializers import BSModelSerializer, district_ref, file_url
from apps.geo.models import District

from .models import Membership, Organization, Shift, Site


class OrganizationSerializer(BSModelSerializer):
    district = serializers.SlugRelatedField(slug_field="code", queryset=District.objects.all())

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "name_ne",
            "pan_no",
            "vat_registered",
            "ssf_employer_no",
            "industry",
            "district",
            "municipality",
            "ward",
            "address",
            "phone",
            "email",
            "logo",
            "plan",
            "weekly_off_day",
            "created_at",
            "is_active",
        ]
        read_only_fields = ["id", "plan", "created_at", "is_active"]
        extra_kwargs = {"address": {"required": True}, "phone": {"required": True}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["district"] = district_ref(instance.district)
        data["logo"] = file_url(self.context.get("request"), instance.logo)
        data["industry_label"] = labels.label(labels.INDUSTRY, instance.industry)
        membership = self.context.get("membership")
        if membership is not None:
            data["my_role"] = membership.role
        return data


class SiteSerializer(BSModelSerializer):
    district = serializers.SlugRelatedField(
        slug_field="code", queryset=District.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Site
        fields = [
            "id",
            "name",
            "address",
            "district",
            "lat",
            "lng",
            "geofence_radius_m",
            "qr_token",
            "is_active",
        ]
        read_only_fields = ["id", "qr_token"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["district"] = district_ref(instance.district)
        data["qr_payload"] = f"kaamsathi://site/{instance.qr_token}"
        return data


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = ["id", "name", "start_time", "end_time", "break_minutes"]
        read_only_fields = ["id"]


class MemberSerializer(serializers.ModelSerializer):
    phone = PhoneField(write_only=True, required=False)
    full_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    site_ids = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    user = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = ["id", "user", "role", "is_active", "created_at", "phone", "full_name", "site_ids"]
        read_only_fields = ["id", "created_at"]

    def get_user(self, obj):
        return {"id": str(obj.user_id), "phone": obj.user.phone, "full_name": obj.user.full_name}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["role_label"] = labels.label(labels.ROLE, instance.role)
        data["site_ids"] = [str(s.id) for s in instance.sites.all()]
        return data

    def validate_site_ids(self, value):
        org = self.context["org"]
        sites = list(Site.objects.filter(organization=org, id__in=value))
        if len(sites) != len(set(value)):
            raise serializers.ValidationError("One or more sites do not belong to this organization.")
        return sites

    def validate(self, attrs):
        if self.instance is None:
            if not attrs.get("phone"):
                raise serializers.ValidationError({"phone": ["This field is required."]})
            if Membership.objects.filter(
                organization=self.context["org"], user__phone=attrs["phone"]
            ).exists():
                raise serializers.ValidationError(
                    {"phone": ["This person is already a member."]}, code="unique"
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        org = self.context["org"]
        phone = validated_data.pop("phone")
        full_name = validated_data.pop("full_name", "")
        sites = validated_data.pop("site_ids", [])
        user, created = User.objects.get_or_create(phone=phone, defaults={"full_name": full_name})
        if created:
            user.set_unusable_password()
            user.save()
        elif full_name and not user.full_name:
            user.full_name = full_name
            user.save(update_fields=["full_name"])
        membership = Membership.objects.create(user=user, organization=org, **validated_data)
        membership.sites.set(sites)
        return membership

    @transaction.atomic
    def update(self, instance, validated_data):
        validated_data.pop("phone", None)
        full_name = validated_data.pop("full_name", None)
        sites = validated_data.pop("site_ids", None)
        instance = super().update(instance, validated_data)
        if sites is not None:
            instance.sites.set(sites)
        if full_name:
            instance.user.full_name = full_name
            instance.user.save(update_fields=["full_name"])
        return instance
