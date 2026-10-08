from rest_framework import serializers

from apps.accounts.models import User
from apps.core import labels
from apps.core.money import q2
from apps.core.serializers import BSModelSerializer, MoneyField, ref, trade_ref
from apps.orgs.models import Shift, Site
from apps.workers.models import Trade, Worker
from apps.workers.serializers import worker_card

from .models import Advance, Attendance, Employment, Holiday, LeaveRequest
from .services import validate_wage


def org_scoped(field, org):
    if org is not None and hasattr(field, "queryset") and field.queryset is not None:
        model = field.queryset.model
        if model in (Site, Shift):
            field.queryset = model.objects.filter(organization=org)
        elif model is Employment:
            field.queryset = Employment.objects.filter(organization=org)
        elif model is User:
            field.queryset = User.objects.filter(memberships__organization=org, memberships__is_active=True)


class EmploymentSerializer(BSModelSerializer):
    aliases = {"site": "site_id", "supervisor": "supervisor_id", "shift": "shift_id"}

    site_id = serializers.PrimaryKeyRelatedField(
        source="site", queryset=Site.objects.all(), required=False, allow_null=True, write_only=True
    )
    shift_id = serializers.PrimaryKeyRelatedField(
        source="shift", queryset=Shift.objects.all(), required=False, allow_null=True, write_only=True
    )
    supervisor_id = serializers.PrimaryKeyRelatedField(
        source="supervisor", queryset=User.objects.all(), required=False, allow_null=True, write_only=True
    )
    trade = serializers.SlugRelatedField(
        slug_field="code", queryset=Trade.objects.all(), required=False, allow_null=True
    )
    basic_salary = MoneyField(required=False, allow_null=True)
    dearness_allowance = MoneyField(required=False, allow_null=True)
    other_allowance = MoneyField(required=False)
    daily_wage = MoneyField(required=False, allow_null=True)

    class Meta:
        model = Employment
        fields = [
            "id",
            "site_id",
            "shift_id",
            "supervisor_id",
            "trade",
            "designation",
            "employee_code",
            "start_date",
            "end_date",
            "status",
            "end_reason",
            "wage_type",
            "basic_salary",
            "dearness_allowance",
            "other_allowance",
            "daily_wage",
            "ssf_enrolled",
            "replacement_eligible_until",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "end_date",
            "status",
            "end_reason",
            "replacement_eligible_until",
            "created_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        org = self.context.get("org")
        for name in ("site_id", "shift_id", "supervisor_id"):
            if name in self.fields:
                org_scoped(self.fields[name], org)

    def validate(self, attrs):
        inst = self.instance
        wage_keys = {"wage_type", "basic_salary", "dearness_allowance", "daily_wage"}
        if inst is not None and wage_keys & set(attrs):
            wage_type = attrs.get("wage_type", inst.wage_type)
            validate_wage(
                wage_type,
                attrs.get("basic_salary", inst.basic_salary),
                attrs.get("dearness_allowance", inst.dearness_allowance),
                attrs.get("daily_wage", inst.daily_wage),
            )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        data["worker"] = worker_card(instance.worker, request)
        data["site"] = ref(instance.site, "id", "name")
        data["shift"] = ref(instance.shift, "id", "name")
        data["trade"] = trade_ref(instance.trade)
        data["supervisor"] = (
            {"id": str(instance.supervisor_id), "full_name": instance.supervisor.full_name}
            if instance.supervisor_id
            else None
        )
        data["monthly_gross"] = f"{q2(instance.monthly_gross):.2f}"
        data["status_label"] = labels.label(labels.EMPLOYMENT_STATUS, instance.status)
        data["wage_type_label"] = labels.label(labels.WAGE_TYPE, instance.wage_type)
        data["end_reason_label"] = labels.label(labels.END_REASON, instance.end_reason)
        data["application_id"] = str(instance.application_id) if instance.application_id else None
        return data


class MyEmploymentSerializer(EmploymentSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        org = instance.organization
        data["organization"] = {"id": str(org.id), "name": org.name, "name_ne": org.name_ne}
        data["employer_verified"] = org.verification_status == "verified"
        data.pop("supervisor", None)
        return data


class NewWorkerSerializer(serializers.Serializer):
    phone = serializers.CharField()
    full_name = serializers.CharField(required=False, allow_blank=True)
    full_name_ne = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    gender = serializers.ChoiceField(choices=[c[0] for c in Worker.GENDERS], required=False)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    citizenship_no = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    nid_no = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    payment_method = serializers.ChoiceField(choices=list(labels.PAYMENT_METHOD), required=False)
    bank_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    bank_account_no = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    bank_account_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    wallet_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    ssf_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    permanent_district = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    current_district = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class EmploymentCreateSerializer(EmploymentSerializer):
    worker = NewWorkerSerializer(required=False, write_only=True)
    worker_id = serializers.PrimaryKeyRelatedField(
        queryset=Worker.objects.all(), required=False, write_only=True
    )
    start_date = serializers.DateField()

    class Meta(EmploymentSerializer.Meta):
        fields = EmploymentSerializer.Meta.fields + ["worker", "worker_id"]

    def validate(self, attrs):
        if not attrs.get("worker") and not attrs.get("worker_id"):
            raise serializers.ValidationError({"worker": ["Provide worker details or worker_id."]})
        return attrs


class EndEmploymentSerializer(serializers.Serializer):
    end_date = serializers.DateField()
    end_reason = serializers.ChoiceField(choices=list(labels.END_REASON))


class RateSerializer(serializers.Serializer):
    score_a = serializers.IntegerField(min_value=1, max_value=5)
    score_b = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class AttendanceSerializer(BSModelSerializer):
    employment_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "id",
            "employment_id",
            "date",
            "status",
            "check_in_at",
            "check_out_at",
            "method",
            "overtime_minutes",
            "note",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["status_label"] = labels.label(labels.ATTENDANCE_STATUS, instance.status)
        return data


class BulkRecordSerializer(serializers.Serializer):
    client_uuid = serializers.UUIDField()
    employment_id = serializers.UUIDField()
    date = serializers.DateField()
    status = serializers.ChoiceField(choices=list(labels.ATTENDANCE_STATUS))
    check_in_at = serializers.DateTimeField(required=False, allow_null=True)
    check_out_at = serializers.DateTimeField(required=False, allow_null=True)
    lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    lng = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    method = serializers.ChoiceField(choices=[c[0] for c in Attendance.METHODS], default="supervisor")
    overtime_minutes = serializers.IntegerField(min_value=0, max_value=24 * 60, required=False, default=0)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)

    def to_internal_value(self, data):
        # Round lat/lng to 6 dp before decimal validation (GPS gives more).
        if hasattr(data, "get"):
            data = dict(data)
            for k in ("lat", "lng"):
                if data.get(k) not in (None, ""):
                    try:
                        data[k] = round(float(data[k]), 6)
                    except (TypeError, ValueError):
                        pass
        return super().to_internal_value(data)


class LeaveSerializer(BSModelSerializer):
    aliases = {"employment_id": "employment"}

    employment = serializers.PrimaryKeyRelatedField(queryset=Employment.objects.all(), write_only=True)
    days = serializers.DecimalField(max_digits=5, decimal_places=1, required=False, coerce_to_string=False)

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "employment",
            "leave_type",
            "from_date",
            "to_date",
            "days",
            "reason",
            "status",
            "decided_at",
            "decision_note",
            "created_at",
        ]
        read_only_fields = ["id", "status", "decided_at", "decision_note", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        org_scoped(self.fields["employment"], self.context.get("org"))

    def validate(self, attrs):
        start, end = attrs.get("from_date"), attrs.get("to_date")
        if start and end and end < start:
            raise serializers.ValidationError({"to_date": ["Must be on or after from_date."]})
        if start and end and not attrs.get("days"):
            attrs["days"] = (end - start).days + 1
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        emp = instance.employment
        data["employment_id"] = str(emp.id)
        data["worker"] = {"id": str(emp.worker_id), "full_name": emp.worker.full_name}
        data["designation"] = emp.designation
        data["leave_type_label"] = labels.label(labels.LEAVE_TYPE, instance.leave_type)
        data["status_label"] = labels.label(labels.LEAVE_STATUS, instance.status)
        data["decided_by"] = (
            {"id": str(instance.decided_by_id), "full_name": instance.decided_by.full_name}
            if instance.decided_by_id
            else None
        )
        return data


class AdvanceSerializer(BSModelSerializer):
    aliases = {"employment_id": "employment"}

    employment = serializers.PrimaryKeyRelatedField(queryset=Employment.objects.all(), write_only=True)
    amount = MoneyField()
    recover_per_month = MoneyField()
    recovered_amount = MoneyField(read_only=True)

    class Meta:
        model = Advance
        fields = [
            "id",
            "employment",
            "amount",
            "given_on",
            "recover_per_month",
            "recovered_amount",
            "note",
            "created_at",
        ]
        read_only_fields = ["id", "recovered_amount", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        org_scoped(self.fields["employment"], self.context.get("org"))
        if self.instance is not None and not isinstance(self.instance, list):
            self.fields["employment"].read_only = True

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Must be greater than zero.")
        if self.instance is not None and value < self.instance.recovered_amount:
            raise serializers.ValidationError("Cannot be less than the amount already recovered.")
        return value

    def validate_recover_per_month(self, value):
        if value <= 0:
            raise serializers.ValidationError("Must be greater than zero.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        emp = instance.employment
        data["employment_id"] = str(emp.id)
        data["worker"] = {"id": str(emp.worker_id), "full_name": emp.worker.full_name}
        data["balance"] = f"{q2(instance.balance):.2f}"
        return data


class HolidaySerializer(BSModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "date", "name_en", "name_ne"]
        read_only_fields = ["id"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["is_national"] = instance.organization_id is None
        return data
