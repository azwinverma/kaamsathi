from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from rest_framework import serializers

from apps.core import labels
from apps.core.bs import bs_str
from apps.core.files import worker_file_url
from apps.core.phone import is_valid_phone, mask_phone, normalize_phone
from apps.core.serializers import BSModelSerializer, district_ref, trade_ref
from apps.geo.models import District

from .models import Consent, Trade, Worker, WorkerSkill

WORKER_CARD_SELECT = ("current_district", "permanent_district")
WORKER_CARD_PREFETCH = (
    "skills__trade",
    "employments__ratings",
    "employments__organization",
    "employments__trade",
    "trust",
)


def card_queryset(qs):
    return qs.select_related(*WORKER_CARD_SELECT).prefetch_related(*WORKER_CARD_PREFETCH)


def _employer_rating(employment):
    ratings = [r for r in employment.ratings.all() if r.rater == "employer"]
    if not ratings:
        return None
    r = ratings[0]
    return float((Decimal(r.score_a + r.score_b) / 2).quantize(Decimal("0.1"), ROUND_HALF_UP))


def months_between(start, end) -> int:
    if not start or not end or end < start:
        return 0
    return max((end - start).days // 30, 0)


def _trust_fields(worker: Worker) -> tuple[int, int | None]:
    """(verification_level, reliability_score) from the cached WorkerTrust (apps.trust)."""
    from django.core.exceptions import ObjectDoesNotExist

    try:
        trust = worker.trust
    except ObjectDoesNotExist:
        trust = None
    if trust is None:  # not computed yet: identity check is the only level we know for sure
        return (1 if worker.verification_status == "verified" else 0), None
    return trust.verification_level, trust.reliability_score


def worker_card(worker: Worker, request=None) -> dict:
    skills = list(worker.skills.all())
    employments = list(worker.employments.all())
    ratings = [x for x in (_employer_rating(e) for e in employments) if x is not None]
    district = worker.current_district or worker.permanent_district
    level, reliability = _trust_fields(worker)
    return {
        "id": str(worker.id),
        "full_name": worker.full_name,
        "phone_masked": mask_phone(worker.phone),
        "photo": worker_file_url(request, worker, "photo"),
        "verification_status": worker.verification_status,
        "verification_status_label": labels.label(labels.VERIFICATION_STATUS, worker.verification_status),
        "district": district_ref(district),
        "skills": [
            {
                "trade": trade_ref(s.trade),
                "years_experience": s.years_experience,
                "nstb_level": s.nstb_level,
            }
            for s in skills
        ],
        "total_experience_years": max((s.years_experience for s in skills), default=0),
        "rating_avg": round(sum(ratings) / len(ratings), 1) if ratings else None,
        "placements_count": len(employments),
        "verification_level": level,
        "reliability_score": reliability,
    }


def worker_history(worker: Worker) -> list[dict]:
    from django.utils import timezone

    today = timezone.localdate()
    rows = []
    for e in sorted(worker.employments.all(), key=lambda x: x.start_date, reverse=True):
        rows.append(
            {
                "organization_name": e.organization.name,
                "trade": trade_ref(e.trade),
                "designation": e.designation,
                "start_date": e.start_date.isoformat(),
                "start_date_bs": bs_str(e.start_date),
                "end_date": e.end_date.isoformat() if e.end_date else None,
                "end_date_bs": bs_str(e.end_date),
                "months": months_between(e.start_date, e.end_date or today),
                "rating": _employer_rating(e),
            }
        )
    return rows


def worker_profile(worker: Worker, request=None) -> dict:
    data = worker_card(worker, request)
    data.update(
        {
            "phone": worker.phone,
            "gender": worker.gender,
            "date_of_birth": worker.date_of_birth.isoformat() if worker.date_of_birth else None,
            "date_of_birth_bs": bs_str(worker.date_of_birth),
            "address": worker.address,
            "history": worker_history(worker),
        }
    )
    return data


class WorkerCardField(serializers.Field):
    def __init__(self, **kwargs):
        kwargs["read_only"] = True
        super().__init__(**kwargs)

    def to_representation(self, value):
        return worker_card(value, self.context.get("request"))

    def get_attribute(self, instance):
        return getattr(instance, self.source or self.field_name)


class TradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trade
        fields = ["code", "name_en", "name_ne", "category"]


class SkillSerializer(serializers.ModelSerializer):
    trade = serializers.SlugRelatedField(slug_field="code", queryset=Trade.objects.all())

    class Meta:
        model = WorkerSkill
        fields = ["trade", "years_experience", "nstb_level", "certificate_no"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["trade"] = trade_ref(instance.trade)
        return data


class WorkerDetailSerializer(BSModelSerializer):
    """Full worker record (ops console and /me/worker)."""

    permanent_district = serializers.SlugRelatedField(
        slug_field="code", queryset=District.objects.all(), required=False, allow_null=True
    )
    current_district = serializers.SlugRelatedField(
        slug_field="code", queryset=District.objects.all(), required=False, allow_null=True
    )
    naike_id = serializers.PrimaryKeyRelatedField(
        source="naike", queryset=Worker.objects.all(), required=False, allow_null=True
    )
    skills = SkillSerializer(many=True, required=False)
    user_id = serializers.UUIDField(read_only=True)
    verified_by = serializers.SerializerMethodField()

    class Meta:
        model = Worker
        fields = [
            "id",
            "user_id",
            "full_name",
            "full_name_ne",
            "phone",
            "gender",
            "date_of_birth",
            "permanent_district",
            "current_district",
            "address",
            "citizenship_no",
            "nid_no",
            "id_front",
            "id_back",
            "photo",
            "verification_status",
            "verified_by",
            "verified_at",
            "verification_note",
            "expected_monthly_wage",
            "is_available",
            "available_from",
            "payment_method",
            "bank_name",
            "bank_account_no",
            "bank_account_name",
            "wallet_id",
            "ssf_id",
            "naike_id",
            "notes",
            "skills",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["verification_status", "verified_by", "verified_at", "verification_note"]

    def get_verified_by(self, obj):
        if not obj.verified_by_id:
            return None
        return {"id": str(obj.verified_by_id), "full_name": obj.verified_by.full_name}

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if not is_valid_phone(phone):
            raise serializers.ValidationError("Enter a valid 10-digit mobile number (97/98…).")
        qs = Worker.objects.filter(phone=phone)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A worker with this phone already exists.", code="unique")
        return phone

    def to_internal_value(self, data):
        # multipart requests may send skills as a JSON string
        if hasattr(data, "get") and isinstance(data.get("skills"), str):
            import json

            data = data.copy()
            try:
                skills = json.loads(data.get("skills") or "[]")
            except ValueError as exc:
                raise serializers.ValidationError({"skills": ["Invalid JSON."]}) from exc
            data = {k: data.get(k) for k in data.keys()}
            data["skills"] = skills
        return super().to_internal_value(data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        data["permanent_district"] = district_ref(instance.permanent_district)
        data["current_district"] = district_ref(instance.current_district)
        for f in ("photo", "id_front", "id_back"):
            data[f] = worker_file_url(request, instance, f)
        card = worker_card(instance, request)
        for k in (
            "phone_masked",
            "district",
            "total_experience_years",
            "rating_avg",
            "placements_count",
            "verification_status_label",
            "verification_level",
            "reliability_score",
        ):
            data[k] = card[k]
        data["payment_method_label"] = labels.label(labels.PAYMENT_METHOD, instance.payment_method)
        return data

    def _save_skills(self, worker, skills):
        if skills is None:
            return
        keep = []
        for s in skills:
            obj, _ = WorkerSkill.objects.update_or_create(
                worker=worker,
                trade=s["trade"],
                defaults={
                    "years_experience": s.get("years_experience", 0),
                    "nstb_level": s.get("nstb_level", "none"),
                    "certificate_no": s.get("certificate_no"),
                },
            )
            keep.append(obj.pk)
        worker.skills.exclude(pk__in=keep).delete()

    @transaction.atomic
    def create(self, validated_data):
        skills = validated_data.pop("skills", None)
        worker = super().create(validated_data)
        self._save_skills(worker, skills)
        return worker

    @transaction.atomic
    def update(self, instance, validated_data):
        skills = validated_data.pop("skills", None)
        worker = super().update(instance, validated_data)
        self._save_skills(worker, skills)
        return worker


class SelfWorkerSerializer(WorkerDetailSerializer):
    """/me/worker — a worker can edit only a few self-service fields."""

    class Meta(WorkerDetailSerializer.Meta):
        read_only_fields = [
            f
            for f in WorkerDetailSerializer.Meta.fields
            if f
            not in {
                "full_name_ne",
                "payment_method",
                "bank_name",
                "bank_account_no",
                "bank_account_name",
                "wallet_id",
                "is_available",
            }
        ]


class ConsentSerializer(serializers.ModelSerializer):
    organization_id = serializers.UUIDField(required=False, allow_null=True)
    organization = serializers.SerializerMethodField()

    class Meta:
        model = Consent
        fields = ["id", "organization_id", "organization", "scope", "granted", "channel", "created_at"]
        read_only_fields = ["id", "channel", "created_at"]

    def get_organization(self, obj):
        if not obj.organization_id:
            return None
        return {"id": str(obj.organization_id), "name": obj.organization.name}

    def validate_organization_id(self, value):
        from apps.orgs.models import Organization

        if value and not Organization.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Organization not found.")
        return value
