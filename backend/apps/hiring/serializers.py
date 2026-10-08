from django.db.models import Count, Q
from rest_framework import serializers

from apps.core import labels
from apps.core.serializers import BSModelSerializer, MoneyField, ref, trade_ref
from apps.geo.models import District
from apps.orgs.models import Shift, Site
from apps.workers.models import Consent, Trade
from apps.workers.serializers import worker_card, worker_profile

from . import labels as hiring_labels
from .models import Application, JobAlert, JobOpening, StageEvent
from .services import validate_job_wage

STAGES = [k for k in labels.STAGE]
# Worker-interest rows are invisible to the employer until ops shortlists them.
_INTEREST = Q(applications__stage="sourced", applications__source="worker_interest")


def annotate_counts(qs):
    return qs.annotate(
        **{f"n_{s}": Count("applications", filter=Q(applications__stage=s) & ~_INTEREST) for s in STAGES},
        n_interested=Count("applications", filter=_INTEREST),
    )


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
            counts = dict(
                Application.employer_visible(instance.applications.all())
                .values_list("stage")
                .annotate(n=Count("id"))
            )
            data["counts"] = {s: counts.get(s, 0) for s in STAGES}
        return data


class OpsJobSerializer(JobSerializer):
    def to_representation(self, instance):
        from django.utils import timezone

        data = super().to_representation(instance)
        data["organization"] = {"id": str(instance.organization_id), "name": instance.organization.name}
        data["employer_verified"] = instance.organization.verification_status == "verified"
        start = instance.published_at or instance.created_at
        end = timezone.now() if instance.status == "open" else (instance.first_shortlist_at or timezone.now())
        data["hours_open"] = round(max((end - start).total_seconds(), 0) / 3600, 1)
        data["interested_count"] = (
            instance.n_interested
            if hasattr(instance, "n_interested")
            else instance.applications.filter(stage="sourced", source="worker_interest").count()
        )
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
            "source",
            "worker_response",
            "responded_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        data["source_label"] = labels.label(hiring_labels.SOURCE, instance.source)
        data["worker_response_label"] = labels.label(hiring_labels.WORKER_RESPONSE, instance.worker_response)
        data["job"] = {"id": str(instance.job_id), "title": instance.job.title}
        data["offer"] = latest_offer(instance)
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


# --------------------------------------------------------------------------- offers & alerts
class OfferInputSerializer(serializers.Serializer):
    wage_type = serializers.ChoiceField(choices=["monthly", "daily"])
    basic_salary = MoneyField(required=False, allow_null=True)
    dearness_allowance = MoneyField(required=False, allow_null=True)
    daily_wage = MoneyField(required=False, allow_null=True)
    start_date = serializers.DateField()
    site_id = serializers.UUIDField(required=False, allow_null=True)
    designation = serializers.CharField(required=False, allow_blank=True, max_length=120)
    contract_type = serializers.ChoiceField(
        choices=list(hiring_labels.CONTRACT_TYPE), required=False, default="permanent"
    )
    ends_on = serializers.DateField(required=False, allow_null=True)
    expires_in_days = serializers.IntegerField(required=False, min_value=1, max_value=14, default=3)

    def validate(self, attrs):
        from apps.core.bs import today_ad

        if attrs["start_date"] < today_ad():
            raise serializers.ValidationError({"start_date": ["Start date cannot be in the past."]})
        ends = attrs.get("ends_on")
        if attrs.get("contract_type") in ("fixed_term", "probation") and not ends:
            raise serializers.ValidationError(
                {"ends_on": ["Required for fixed-term and probation contracts."]}
            )
        if ends and ends < attrs["start_date"]:
            raise serializers.ValidationError({"ends_on": ["Must be after the start date."]})
        return attrs


def offer_payload(offer) -> dict:
    from apps.core.bs import bs_str
    from apps.core.money import money_str

    def m(v):
        return money_str(v) if v is not None else None

    return {
        "id": str(offer.id),
        "application_id": str(offer.application_id),
        "status": offer.status,
        "status_label": labels.label(hiring_labels.OFFER_STATUS, offer.status),
        "wage_type": offer.wage_type,
        "basic_salary": m(offer.basic_salary),
        "dearness_allowance": m(offer.dearness_allowance),
        "daily_wage": m(offer.daily_wage),
        "start_date": offer.start_date.isoformat(),
        "start_date_bs": bs_str(offer.start_date),
        "site": ref(offer.site, "id", "name"),
        "designation": offer.designation,
        "contract_type": offer.contract_type,
        "contract_type_label": labels.label(hiring_labels.CONTRACT_TYPE, offer.contract_type),
        "ends_on": offer.ends_on.isoformat() if offer.ends_on else None,
        "ends_on_bs": bs_str(offer.ends_on),
        "expires_at": offer.expires_at.isoformat(),
        "created_at": offer.created_at.isoformat(),
        "responded_at": offer.responded_at.isoformat() if offer.responded_at else None,
        "decline_reason": offer.decline_reason,
    }


def latest_offer(application) -> dict | None:
    offers = sorted(application.offers.all(), key=lambda o: o.created_at, reverse=True)
    return offer_payload(offers[0]) if offers else None


class JobAlertSerializer(serializers.ModelSerializer):
    trade = serializers.SlugRelatedField(
        slug_field="code", queryset=Trade.objects.all(), required=False, allow_null=True
    )
    districts = serializers.SlugRelatedField(
        slug_field="code", queryset=District.objects.all(), many=True, required=False
    )
    min_wage = MoneyField(required=False, allow_null=True)

    class Meta:
        model = JobAlert
        fields = [
            "id",
            "trade",
            "districts",
            "min_wage",
            "frequency",
            "is_active",
            "created_at",
            "last_sent_at",
        ]
        read_only_fields = ["id", "created_at", "last_sent_at"]

    def validate_districts(self, value):
        if len(value) > 10:
            raise serializers.ValidationError("Choose at most 10 districts.")
        return value

    def validate_min_wage(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Must not be negative.")
        return value

    def to_representation(self, instance):
        from apps.core.serializers import district_ref

        data = super().to_representation(instance)
        data["trade"] = trade_ref(instance.trade)
        data["districts"] = [district_ref(d) for d in instance.districts.all()]
        data["frequency_label"] = labels.label(hiring_labels.ALERT_FREQUENCY, instance.frequency)
        return data
