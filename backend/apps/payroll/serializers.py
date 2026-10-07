from rest_framework import serializers

from apps.core import labels
from apps.core.bs import MONTHS_EN, MONTHS_NE
from apps.core.serializers import BSModelSerializer, MoneyField

from .models import PayrollRun, Payslip
from .services import run_totals

MONEY_FIELDS = [
    "basic_earned",
    "da_earned",
    "allowance_earned",
    "overtime_pay",
    "festival_allowance",
    "gross_pay",
    "ssf_employee",
    "ssf_employer",
    "tds",
    "advance_recovery",
    "other_deductions",
    "net_pay",
]


class PayrollRunSerializer(BSModelSerializer):
    class Meta:
        model = PayrollRun
        fields = [
            "id",
            "bs_year",
            "bs_month",
            "period_start",
            "period_end",
            "days_in_month",
            "include_festival_allowance",
            "status",
            "approved_at",
            "paid_at",
            "created_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["month_name_en"] = MONTHS_EN[instance.bs_month]
        data["month_name_ne"] = MONTHS_NE[instance.bs_month]
        data["status_label"] = labels.label(labels.PAYROLL_STATUS, instance.status)
        data["approved_by"] = (
            {"id": str(instance.approved_by_id), "full_name": instance.approved_by.full_name}
            if instance.approved_by_id
            else None
        )
        data.update(run_totals(instance))
        return data


class PayrollRunCreateSerializer(serializers.Serializer):
    bs_year = serializers.IntegerField(min_value=2000, max_value=2100)
    bs_month = serializers.IntegerField(min_value=1, max_value=12)
    include_festival_allowance = serializers.BooleanField(default=False)


class MarkPaidSerializer(serializers.Serializer):
    paid_on = serializers.DateField()
    method = serializers.ChoiceField(choices=list(labels.PAYMENT_METHOD), required=False, allow_null=True)


class PayslipSerializer(serializers.ModelSerializer):
    other_deductions = MoneyField(required=False)

    class Meta:
        model = Payslip
        fields = [
            "id",
            "wage_type",
            "days_in_month",
            "present_days",
            "paid_leave_days",
            "holiday_days",
            "weekly_off_days",
            "absent_days",
            "payable_days",
            "overtime_hours",
            *MONEY_FIELDS,
            "note",
            "payment_method",
            "payment_status",
            "paid_at",
            "payment_ref",
        ]
        read_only_fields = [f for f in fields if f not in ("other_deductions", "note", "payment_method")]
        extra_kwargs = {
            "payment_method": {"required": False},
        }

    def validate_payment_method(self, value):
        if value not in labels.PAYMENT_METHOD:
            raise serializers.ValidationError("Must be bank, esewa, khalti or cash.")
        return value

    def validate_other_deductions(self, value):
        if value < 0:
            raise serializers.ValidationError("Cannot be negative.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        run = instance.run
        data["run_id"] = str(run.id)
        data["bs_year"] = run.bs_year
        data["bs_month"] = run.bs_month
        data["month_name_en"] = MONTHS_EN[run.bs_month]
        data["month_name_ne"] = MONTHS_NE[run.bs_month]
        data["run_status"] = run.status
        data["employment_id"] = str(instance.employment_id)
        data["worker"] = {"id": str(instance.worker_id), "full_name": instance.worker.full_name}
        data["designation"] = instance.employment.designation
        data["organization"] = {"id": str(run.organization_id), "name": run.organization.name}
        data["payment_method_label"] = labels.label(labels.PAYMENT_METHOD, instance.payment_method)
        data["payment_status_label"] = labels.label(labels.PAYMENT_STATUS, instance.payment_status)
        for f in (
            "present_days",
            "paid_leave_days",
            "holiday_days",
            "weekly_off_days",
            "absent_days",
            "payable_days",
            "overtime_hours",
        ):
            data[f] = str(getattr(instance, f))
        return data
