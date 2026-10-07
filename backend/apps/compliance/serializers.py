from django.utils import timezone
from rest_framework import serializers

from apps.core.bs import MONTHS_EN, MONTHS_NE, today_ad
from apps.core.labels import label
from apps.core.serializers import BSModelSerializer, trade_ref
from apps.workers.models import Trade, Worker

from .models import SSF_FILING_STATUS, Contractor, EmploymentContract, SSFFiling


def _dt(value):
    return timezone.localtime(value).isoformat() if value else None


class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmploymentContract
        fields = ["id", "version", "generated_at", "language", "accepted_at", "accepted_channel"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        t = instance.terms or {}
        data["employment_id"] = str(instance.employment_id)
        data["is_accepted"] = instance.accepted_at is not None
        data["terms"] = {
            k: t.get(k)
            for k in (
                "designation",
                "site_name",
                "wage_type",
                "basic_salary",
                "dearness_allowance",
                "other_allowance",
                "daily_wage",
                "monthly_gross",
                "ssf_enrolled",
                "start_date",
                "start_date_bs",
            )
        }
        data["generated_by"] = (
            {"id": str(instance.generated_by_id), "full_name": instance.generated_by.full_name}
            if instance.generated_by_id
            else None
        )
        return data


class GenerateContractSerializer(serializers.Serializer):
    language = serializers.ChoiceField(choices=["en", "ne", "both"], default="both")
    force = serializers.BooleanField(default=False)


class OrgAcceptSerializer(serializers.Serializer):
    channel = serializers.ChoiceField(choices=["paper", "sms"], default="paper")


class SSFFilingSerializer(BSModelSerializer):
    class Meta:
        model = SSFFiling
        fields = [
            "id",
            "status",
            "due_date",
            "prepared_at",
            "submitted_on",
            "receipt_no",
            "note",
            "summary",
            "updated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        run = instance.run
        data["status_label"] = label(SSF_FILING_STATUS, instance.status)
        data["run"] = {
            "id": str(run.id),
            "bs_year": run.bs_year,
            "bs_month": run.bs_month,
            "month_name_en": MONTHS_EN[run.bs_month],
            "month_name_ne": MONTHS_NE[run.bs_month],
            "status": run.status,
        }
        data["prepared_by"] = (
            {"id": str(instance.prepared_by_id), "full_name": instance.prepared_by.full_name}
            if instance.prepared_by_id
            else None
        )
        data["is_overdue"] = instance.status == "prepared" and instance.due_date < today_ad()
        return data


class SSFFilingUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=list(SSF_FILING_STATUS), required=False)
    submitted_on = serializers.DateField(required=False, allow_null=True)
    receipt_no = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=60)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ContractorSerializer(serializers.ModelSerializer):
    lead_worker_id = serializers.PrimaryKeyRelatedField(
        source="lead_worker", queryset=Worker.objects.all(), required=False, allow_null=True, write_only=True
    )
    trades = serializers.SlugRelatedField(
        slug_field="code", queryset=Trade.objects.all(), many=True, required=False
    )

    class Meta:
        model = Contractor
        fields = ["id", "name", "pan_no", "phone", "lead_worker_id", "trades", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["trades"] = [trade_ref(t) for t in instance.trades.all()]
        lw = instance.lead_worker
        data["lead_worker"] = {"id": str(lw.id), "full_name": lw.full_name, "phone": lw.phone} if lw else None
        data["active_workers"] = getattr(instance, "active_workers", None)
        if data["active_workers"] is None:
            data["active_workers"] = instance.assignments.filter(employment__status="active").count()
        return data


class AssignSerializer(serializers.Serializer):
    employment_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False, max_length=500)
