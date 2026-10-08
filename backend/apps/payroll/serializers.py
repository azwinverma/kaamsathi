from django.utils.translation import pgettext
from rest_framework import serializers

from apps.core import labels
from apps.core.bs import MONTHS_EN, MONTHS_NE
from apps.core.serializers import BSModelSerializer, MoneyField

from .models import PayGroup, PayPolicy, PayrollRun, Payslip
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
        data["pay_group"] = (
            {"id": str(instance.pay_group_id), "name": instance.pay_group.name}
            if instance.pay_group_id
            else None
        )
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
    # Omitted / null → the pay policy decides (festival_month); false when no policy (contract default).
    include_festival_allowance = serializers.BooleanField(required=False, allow_null=True, default=None)
    pay_group_id = serializers.PrimaryKeyRelatedField(
        source="pay_group", queryset=PayGroup.objects.none(), required=False, allow_null=True, default=None
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        org = self.context.get("org")
        if org is not None:
            self.fields["pay_group_id"].queryset = PayGroup.objects.filter(organization=org)


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
            "regular_hours",
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
            "regular_hours",
        ):
            data[f] = str(getattr(instance, f))
        return data


# --------------------------------------------------------------------------- pay policy & groups
class PayPolicySerializer(serializers.ModelSerializer):
    ot_multiplier = serializers.DecimalField(max_digits=4, decimal_places=2, required=False)
    half_day_fraction = serializers.DecimalField(max_digits=3, decimal_places=2, required=False)
    festival_custom_amount = MoneyField(required=False)

    class Meta:
        model = PayPolicy
        fields = [
            "ot_multiplier",
            "festival_allowance_rule",
            "festival_custom_amount",
            "festival_month",
            "rounding",
            "weekly_off_paid",
            "half_day_fraction",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_ot_multiplier(self, value):
        from decimal import Decimal

        if value < Decimal("1.5"):
            raise serializers.ValidationError(
                pgettext("complete2", "Overtime must be paid at least 1.5× (Labour Act 2074).")
            )
        if value > Decimal("5"):
            raise serializers.ValidationError(pgettext("complete2", "Must be 5× or less."))
        return value

    def validate_half_day_fraction(self, value):
        from decimal import Decimal

        if not Decimal("0") < value < Decimal("1"):
            raise serializers.ValidationError(pgettext("complete2", "Must be between 0 and 1."))
        return value

    def validate_festival_custom_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Cannot be negative.")
        return value

    def validate_festival_month(self, value):
        if value is not None and not 1 <= value <= 12:
            raise serializers.ValidationError(pgettext("complete2", "Must be a BS month from 1 to 12."))
        return value

    def validate(self, attrs):
        rule = attrs.get("festival_allowance_rule", getattr(self.instance, "festival_allowance_rule", None))
        amount = attrs.get("festival_custom_amount", getattr(self.instance, "festival_custom_amount", 0))
        if rule == "custom_amount" and not amount:
            raise serializers.ValidationError(
                {"festival_custom_amount": [pgettext("complete2", "Enter the festival allowance amount.")]}
            )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["ot_multiplier"] = f"{instance.ot_multiplier:.2f}"
        data["half_day_fraction"] = f"{instance.half_day_fraction:.2f}"
        data["is_default"] = instance.pk is None or instance._state.adding
        return data


class PayGroupSerializer(serializers.ModelSerializer):
    site_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    wage_types = serializers.ListField(
        child=serializers.ChoiceField(choices=list(labels.WAGE_TYPE)), required=False
    )
    contractor_ids = serializers.ListField(child=serializers.UUIDField(), required=False)

    class Meta:
        model = PayGroup
        fields = [
            "id",
            "name",
            "site_ids",
            "wage_types",
            "contractor_ids",
            "pay_day",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        org = self.context.get("org")
        qs = PayGroup.objects.filter(organization=org, name__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                pgettext("complete2", "A pay group with this name already exists.")
            )
        return value

    def validate_pay_day(self, value):
        if value is not None and not 1 <= value <= 32:
            raise serializers.ValidationError(pgettext("complete2", "Must be a day from 1 to 32."))
        return value

    def _own(self, ids, model, field):
        org = self.context.get("org")
        ids = sorted({str(i) for i in ids})
        found = {
            str(pk) for pk in model.objects.filter(organization=org, pk__in=ids).values_list("pk", flat=True)
        }
        missing = [i for i in ids if i not in found]
        if missing:
            raise serializers.ValidationError(
                {field: [pgettext("complete2", "Unknown id: %(id)s") % {"id": missing[0]}]}
            )
        return ids

    def validate(self, attrs):
        from apps.orgs.models import Site

        if "site_ids" in attrs:
            attrs["site_ids"] = self._own(attrs["site_ids"], Site, "site_ids")
        if "contractor_ids" in attrs:
            from apps.compliance.models import Contractor

            attrs["contractor_ids"] = self._own(attrs["contractor_ids"], Contractor, "contractor_ids")
        if "wage_types" in attrs:
            attrs["wage_types"] = sorted(set(attrs["wage_types"]))
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        counts = self.context.get("member_counts")
        if callable(counts):
            counts = self.context["member_counts"] = counts()
        if counts is not None:
            data["employment_count"] = counts.get(instance.id, 0)
        return data
