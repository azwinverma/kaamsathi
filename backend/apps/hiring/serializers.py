from django.db.models import Count, Q
from rest_framework import serializers

from apps.core import labels
from apps.core.serializers import BSModelSerializer, MoneyField, ref, trade_ref
from apps.orgs.models import Shift, Site
from apps.workers.models import Consent, Trade
from apps.workers.serializers import worker_card, worker_profile

from .models import Application, JobOpening, StageEvent
from .services import validate_job_wage

STAGES = [k for k in labels.STAGE]


def annotate_counts(qs):
    return qs.annotate(**{f"n_{s}": Count("applications", filter=Q(applications__stage=s)) for s in STAGES})


class JobSerializer(BSModelSerializer):
    aliases = {"site": "site_id", "shift": "shift_id"}

    trade = serializers.SlugRelatedField(slug_field="code", queryset=Trade.objects.all())
    site_id = serializers.PrimaryKeyRelatedField(
        source="site", queryset=Site.objects.all(), required=False, allow_null=True, write_only=True
    )
    shift_id = serializers.PrimaryKeyRelatedField(
        source="shift", queryset=Shift.objects.all(), required=False, allow_null=True, write_only=True
    )
    wage_amount = MoneyField()

    class Meta:
        model = JobOpening
        fields = [
            "id",
            "title",
            "description",
            "trade",
            "site_id",
            "shift_id",
            "openings_count",
            "wage_type",
            "wage_amount",
            "food_provided",
            "accommodation_provided",
            "start_date",
            "min_experience_years",
            "status",
            "created_at",
            "published_at",
            "first_shortlist_at",
        ]
        read_only_fields = ["id", "status", "created_at", "published_at", "first_shortlist_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        org = self.context.get("org")
        if org is not None:
            self.fields["site_id"].queryset = Site.objects.filter(organization=org)
            self.fields["shift_id"].queryset = Shift.objects.filter(organization=org)

    def validate_openings_count(self, value):
        if value < 1:
            raise serializers.ValidationError("Must be at least 1.")
        return value

    def validate(self, attrs):
        wage_type = attrs.get("wage_type", getattr(self.instance, "wage_type", "monthly"))
        amount = attrs.get("wage_amount", getattr(self.instance, "wage_amount", None))
        if "wage_type" in attrs or "wage_amount" in attrs:
            validate_job_wage(wage_type, amount)
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["trade"] = trade_ref(instance.trade)
        data["site"] = ref(instance.site, "id", "name")
        data["shift"] = ref(instance.shift, "id", "name")
        data["status_label"] = labels.label(labels.JOB_STATUS, instance.status)
        if hasattr(instance, "n_joined"):
            data["counts"] = {s: getattr(instance, f"n_{s}") for s in STAGES}
        else:
            counts = dict(instance.applications.values_list("stage").annotate(n=Count("id")))
            data["counts"] = {s: counts.get(s, 0) for s in STAGES}
        return data


class OpsJobSerializer(JobSerializer):
    def to_representation(self, instance):
        from django.utils import timezone

        data = super().to_representation(instance)
        data["organization"] = {"id": str(instance.organization_id), "name": instance.organization.name}
        start = instance.published_at or instance.created_at
        end = timezone.now() if instance.status == "open" else (instance.first_shortlist_at or timezone.now())
        data["hours_open"] = round(max((end - start).total_seconds(), 0) / 3600, 1)
        return data


class StageEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageEvent
        fields = ["id", "from_stage", "to_stage", "note", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["from_stage_label"] = labels.label(labels.STAGE, instance.from_stage)
        data["to_stage_label"] = labels.label(labels.STAGE, instance.to_stage)
        data["by"] = (
            {"id": str(instance.by_id), "full_name": instance.by.full_name} if instance.by_id else None
        )
        return data


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = [
            "id",
            "stage",
            "interview_at",
            "notes",
            "rejection_reason",
            "created_at",
            "stage_changed_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        data["job"] = {"id": str(instance.job_id), "title": instance.job.title}
        data["worker"] = worker_card(instance.worker, request)
        data["stage_label"] = labels.label(labels.STAGE, instance.stage)
        emp = next(iter(instance.employments.all()), None) if instance.stage == "joined" else None
        data["employment_id"] = str(emp.id) if emp else None
        return data


def can_see_profile(application) -> bool:
    org = application.job.organization
    if application.stage not in ("sourced", "rejected"):
        return True  # shortlisted (or beyond) to this org
    if application.stage == "rejected" and application.events.filter(to_stage="shortlisted").exists():
        return True  # rejected after having been shortlisted
    # sourced, or rejected straight from sourced: never shortlisted → consent required
    return Consent.is_granted(application.worker, org, "profile_share")


class ApplicationDetailSerializer(ApplicationSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        data["profile_visible"] = can_see_profile(instance)
        if data["profile_visible"]:
            data["worker"] = worker_profile(instance.worker, request)
        data["events"] = StageEventSerializer(instance.events.select_related("by"), many=True).data
        return data


class JoinEmploymentSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    site_id = serializers.UUIDField(required=False, allow_null=True)
    designation = serializers.CharField(required=False, allow_blank=True)
    wage_type = serializers.ChoiceField(choices=["monthly", "daily"])
    basic_salary = MoneyField(required=False, allow_null=True)
    dearness_allowance = MoneyField(required=False, allow_null=True)
    other_allowance = MoneyField(required=False, allow_null=True)
    daily_wage = MoneyField(required=False, allow_null=True)
    ssf_enrolled = serializers.BooleanField(default=False)
    employee_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class MoveSerializer(serializers.Serializer):
    stage = serializers.ChoiceField(choices=STAGES)
    interview_at = serializers.DateTimeField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    rejection_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    employment = JoinEmploymentSerializer(required=False)

    def validate(self, attrs):
        if attrs["stage"] == "joined" and not attrs.get("employment"):
            raise serializers.ValidationError({"employment": ["Required when stage is joined."]})
        return attrs
