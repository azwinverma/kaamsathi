from rest_framework import serializers

from apps.core.bs import MONTHS_EN, MONTHS_NE
from apps.core.labels import label

from .models import BATCH_STATUS, ITEM_STATUS, PROVIDER_LABELS, PayoutBatch, PayoutItem


def mask(value: str | None) -> str | None:
    if not value:
        return value
    return "X" * max(len(value) - 4, 0) + value[-4:]


class PayoutItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayoutItem
        fields = [
            "id",
            "amount",
            "method",
            "account_name",
            "account_no",
            "bank_name",
            "wallet_id",
            "status",
            "provider_ref",
            "failure_reason",
            "updated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        slip = instance.payslip
        data["payslip_id"] = str(slip.id)
        data["worker"] = {"id": str(slip.worker_id), "full_name": slip.worker.full_name}
        data["status_label"] = label(ITEM_STATUS, instance.status)
        data["account_no_masked"] = mask(instance.account_no)
        return data


class PayoutBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayoutBatch
        fields = ["id", "provider", "status", "created_at", "submitted_at", "completed_at", "totals"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        run = instance.run
        data["provider_label"] = label(PROVIDER_LABELS, instance.provider)
        data["status_label"] = label(BATCH_STATUS, instance.status)
        data["run"] = {
            "id": str(run.id),
            "bs_year": run.bs_year,
            "bs_month": run.bs_month,
            "month_name_en": MONTHS_EN[run.bs_month],
            "month_name_ne": MONTHS_NE[run.bs_month],
            "status": run.status,
        }
        data["has_file"] = bool(instance.file) or instance.provider == "bank_file"
        data["created_by"] = (
            {"id": str(instance.created_by_id), "full_name": instance.created_by.full_name}
            if instance.created_by_id
            else None
        )
        if self.context.get("with_items"):
            items = instance.items.select_related("payslip__worker").order_by("payslip__worker__full_name")
            data["items"] = PayoutItemSerializer(items, many=True).data
        return data


class CreateBatchSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=list(PROVIDER_LABELS))


class MarkItemSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["sent", "paid", "failed"])
    provider_ref = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=80)
    failure_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)
