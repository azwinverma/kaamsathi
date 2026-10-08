from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from django.utils.translation import pgettext
from rest_framework import serializers

from apps.core import labels as core_labels
from apps.core.bs import today_ad
from apps.core.serializers import BSModelSerializer, MoneyField, district_ref, ref, trade_ref
from apps.geo.models import District
from apps.partners.models import Partner
from apps.workers.models import Trade

from . import labels
from .models import Course, Enrollment, TrainingProvider, TrainingSession


class ProviderSerializer(serializers.ModelSerializer):
    district = serializers.SlugRelatedField(slug_field="code", queryset=District.objects.all())
    partner_id = serializers.PrimaryKeyRelatedField(
        source="partner", queryset=Partner.objects.all(), required=False, allow_null=True
    )
    kind_label = serializers.SerializerMethodField()
    courses_count = serializers.SerializerMethodField()

    class Meta:
        model = TrainingProvider
        fields = [
            "id",
            "name",
            "name_ne",
            "kind",
            "kind_label",
            "ctevt_affiliation_no",
            "district",
            "address",
            "phone",
            "email",
            "partner_id",
            "is_active",
            "courses_count",
            "created_at",
            "verification_status",
            "verified_at",
            "verification_note",
        ]
        read_only_fields = ["created_at", "verification_status", "verified_at", "verification_note"]

    def get_kind_label(self, obj):
        return core_labels.label(labels.PROVIDER_KIND, obj.kind)

    def get_courses_count(self, obj):
        value = getattr(obj, "courses_count", None)
        return value if value is not None else obj.courses.count()

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        aff = attrs.get("ctevt_affiliation_no", getattr(self.instance, "ctevt_affiliation_no", None))
        if kind == "ctevt_affiliated" and not aff:
            raise serializers.ValidationError(
                {"ctevt_affiliation_no": [_("CTEVT affiliated providers need an affiliation number.")]}
            )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["district"] = district_ref(instance.district)
        data["partner"] = ref(instance.partner, "id", "name")
        data["verification_status_label"] = core_labels.label(
            labels.PROVIDER_VERIFICATION, instance.verification_status
        )
        data["verified_by"] = ref(instance.verified_by, "id", "full_name")
        return data


def provider_ref(p: TrainingProvider) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "name_ne": p.name_ne,
        "kind": p.kind,
        "kind_label": core_labels.label(labels.PROVIDER_KIND, p.kind),
        "ctevt_affiliation_no": p.ctevt_affiliation_no,
        "phone": p.phone,
        "district": district_ref(p.district),
        "verification_status": p.verification_status,
        "verified": p.verification_status == "verified",
    }


class CourseSerializer(BSModelSerializer):
    provider_id = serializers.PrimaryKeyRelatedField(
        source="provider", queryset=TrainingProvider.objects.all()
    )
    trade = serializers.SlugRelatedField(slug_field="code", queryset=Trade.objects.all())
    district = serializers.SlugRelatedField(slug_field="code", queryset=District.objects.all())
    fee = MoneyField(min_value=0)
    level_label = serializers.SerializerMethodField()
    mode_label = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    seats_taken = serializers.SerializerMethodField()
    applied_count = serializers.SerializerMethodField()
    recommended = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "provider_id",
            "trade",
            "title",
            "title_ne",
            "description",
            "level",
            "level_label",
            "duration_days",
            "fee",
            "sponsor_note",
            "mode",
            "mode_label",
            "district",
            "starts_on",
            "seats",
            "seats_taken",
            "applied_count",
            "status",
            "status_label",
            "leads_to_nstb",
            "min_attendance_pct",
            "recommended",
            "created_at",
        ]
        read_only_fields = ["created_at"]
        extra_kwargs = {
            "duration_days": {"min_value": 1},
            "seats": {"min_value": 1},
            "min_attendance_pct": {"min_value": 0, "max_value": 100},
        }

    def get_level_label(self, obj):
        return core_labels.label(labels.LEVEL, obj.level)

    def get_mode_label(self, obj):
        return core_labels.label(labels.MODE, obj.mode)

    def get_status_label(self, obj):
        return core_labels.label(labels.COURSE_STATUS, obj.status)

    def get_seats_taken(self, obj):
        value = getattr(obj, "seats_taken", None)
        if value is not None:
            return value
        return obj.enrollments.filter(status__in=["enrolled", "completed"]).count()

    def get_applied_count(self, obj):
        value = getattr(obj, "applied_count", None)
        if value is not None:
            return value
        return obj.enrollments.filter(status="applied").count()

    def get_recommended(self, obj):
        trades = self.context.get("recommended_trades")
        return bool(trades) and obj.trade_id in trades

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["provider"] = provider_ref(instance.provider)
        data["trade"] = trade_ref(instance.trade)
        data["district"] = district_ref(instance.district)
        return data


def course_ref(c: Course) -> dict:
    from apps.core.bs import bs_str

    return {
        "id": str(c.id),
        "title": c.title,
        "title_ne": c.title_ne,
        "trade": trade_ref(c.trade),
        "level": c.level,
        "level_label": core_labels.label(labels.LEVEL, c.level),
        "starts_on": c.starts_on.isoformat(),
        "starts_on_bs": bs_str(c.starts_on),
        "duration_days": c.duration_days,
        "fee": f"{c.fee:.2f}",
        "provider": {"id": str(c.provider.id), "name": c.provider.name, "name_ne": c.provider.name_ne},
        "status": c.status,
    }


class EnrollmentSerializer(BSModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ["id", "status", "status_label", "applied_at", "completed_on", "updated_at"]
        read_only_fields = fields

    def get_status_label(self, obj):
        return core_labels.label(labels.ENROLLMENT_STATUS, obj.status)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        w = instance.worker
        worker = {"id": str(w.id), "full_name": w.full_name}
        if self.context.get("include_phone"):
            worker["phone"] = w.phone
        data["worker"] = worker
        data["course"] = course_ref(instance.course)
        data["sponsored_by_org"] = ref(instance.sponsored_by_org, "id", "name")
        data["credential_id"] = str(instance.credential_id) if instance.credential_id else None
        from .services import attendance_summary

        data["attendance"] = attendance_summary(instance)  # T006
        return data


class EnrollmentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=list(labels.ENROLLMENT_STATUS.keys()))
    completed_on = serializers.DateField(required=False, allow_null=True)

    def validate_completed_on(self, value):
        if value and value > today_ad():
            raise serializers.ValidationError(_("Completion date cannot be in the future."))
        return value


class MeEnrollSerializer(serializers.Serializer):
    course_id = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.select_related("provider", "trade")
    )


class OrgEnrollSerializer(serializers.Serializer):
    course_id = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.select_related("provider", "trade")
    )
    worker_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=200)


class ProviderVerifySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["verified", "rejected", "pending"])
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True, allow_null=True)


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingSession
        fields = ["id", "date", "start_time", "end_time", "topic", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_time": [pgettext("complete1", "End time must be after the start time.")]}
            )
        return attrs

    def to_representation(self, instance):
        from apps.core.bs import bs_str

        data = super().to_representation(instance)
        data["course_id"] = str(instance.course_id)
        data["date_bs"] = bs_str(instance.date)
        data["present_count"] = getattr(instance, "present_count", None)
        return data


class SessionAttendanceInputSerializer(serializers.Serializer):
    enrollment_id = serializers.UUIDField()
    present = serializers.BooleanField()
