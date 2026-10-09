"""Progressive Sipalu onboarding — ``POST /me/sipalu/onboarding-step {step, data}`` (idempotent).

Each step validates its own ``data`` and saves; repeating a step with the same data changes nothing.
Steps: name → photo → skills → languages → service_area → availability → services → headline →
payment → identity → consent. Files (photo, ID) come as multipart fields next to ``step``.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.core.exceptions import APIError
from apps.core.uploads import validate_upload
from apps.workers import labels as worker_labels

from . import profiles
from .models import SipaluProfile, SipaluService

NSTB = ["none", "elementary", "level1", "level2", "level3"]


class NameStep(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    full_name_ne = serializers.CharField(max_length=150, required=False, allow_blank=True)


class SkillRow(serializers.Serializer):
    trade = serializers.SlugField()
    years_experience = serializers.IntegerField(min_value=0, max_value=60, default=0)
    nstb_level = serializers.ChoiceField(choices=NSTB, default="none")


class SkillsStep(serializers.Serializer):
    skills = SkillRow(many=True, allow_empty=False)
    primary_trade = serializers.SlugField(required=False)


class LanguageRow(serializers.Serializer):
    language = serializers.ChoiceField(choices=list(worker_labels.LANGUAGE))
    proficiency = serializers.ChoiceField(
        choices=list(worker_labels.PROFICIENCY), required=False, default="conversational"
    )


class LanguagesStep(serializers.Serializer):
    languages = LanguageRow(many=True, allow_empty=False)


class ServiceAreaStep(serializers.Serializer):
    current_district = serializers.SlugField(required=False)
    service_districts = serializers.ListField(child=serializers.SlugField(), allow_empty=False)
    service_municipality = serializers.CharField(max_length=120, required=False, allow_blank=True)
    service_radius_km = serializers.IntegerField(min_value=1, max_value=100, required=False, allow_null=True)
    base_lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    base_lng = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)


class RuleRow(serializers.Serializer):
    weekday = serializers.IntegerField(min_value=0, max_value=6)
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()


class AvailabilityStep(serializers.Serializer):
    rules = RuleRow(many=True, allow_empty=False)


class ServiceRow(serializers.Serializer):
    trade = serializers.SlugField()
    title = serializers.CharField(max_length=120)
    title_ne = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    description = serializers.CharField(max_length=600, required=False, allow_blank=True, default="")
    price_type = serializers.ChoiceField(choices=["fixed", "hourly", "visit_then_quote"])
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    visit_fee = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True
    )
    estimated_minutes = serializers.IntegerField(min_value=15, max_value=720, required=False, allow_null=True)


class ServicesStep(serializers.Serializer):
    services = ServiceRow(many=True, allow_empty=False)


class HeadlineStep(serializers.Serializer):
    headline = serializers.CharField(max_length=80, required=False, allow_blank=True)
    headline_ne = serializers.CharField(max_length=80, required=False, allow_blank=True)
    bio = serializers.CharField(max_length=600, required=False, allow_blank=True)
    bio_ne = serializers.CharField(max_length=600, required=False, allow_blank=True)

    def validate(self, attrs):
        if not (attrs.get("headline") or "").strip() and not (attrs.get("headline_ne") or "").strip():
            raise serializers.ValidationError({"headline": ["Write a short headline."]})
        return attrs


class PaymentStep(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=["esewa", "khalti", "bank", "cash"])
    wallet_id = serializers.CharField(max_length=40, required=False, allow_blank=True)
    bank_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    bank_account_no = serializers.CharField(max_length=40, required=False, allow_blank=True)
    bank_account_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate(self, attrs):
        m = attrs["payment_method"]
        if m in ("esewa", "khalti") and not attrs.get("wallet_id"):
            raise serializers.ValidationError({"wallet_id": ["Add your wallet ID (phone number)."]})
        if m == "bank" and not (attrs.get("bank_name") and attrs.get("bank_account_no")):
            raise serializers.ValidationError({"bank_account_no": ["Add bank name and account number."]})
        return attrs


class IdentityStep(serializers.Serializer):
    citizenship_no = serializers.CharField(max_length=40, required=False, allow_blank=True)
    nid_no = serializers.CharField(max_length=40, required=False, allow_blank=True)

    def validate(self, attrs):
        if not (attrs.get("citizenship_no") or attrs.get("nid_no")):
            raise serializers.ValidationError(
                {"citizenship_no": ["Add your citizenship or national ID number."]}
            )
        return attrs


class ConsentStep(serializers.Serializer):
    data_processing = serializers.BooleanField()
    public_profile = serializers.BooleanField()


def _valid(cls, data):
    s = cls(data=data)
    s.is_valid(raise_exception=True)
    return s.validated_data


def _districts(codes):
    from apps.geo.models import District

    found = list(District.objects.filter(code__in=codes))
    missing = set(codes) - {d.code for d in found}
    if missing:
        raise APIError(
            "validation_error",
            fields={"service_districts": [f"Unknown district(s): {', '.join(sorted(missing))}"]},
        )
    return found


def _trades(codes):
    from apps.workers.models import Trade

    found = {t.code: t for t in Trade.objects.filter(code__in=codes, is_active=True)}
    missing = set(codes) - set(found)
    if missing:
        raise APIError(
            "validation_error", fields={"trade": [f"Unknown trade(s): {', '.join(sorted(missing))}"]}
        )
    return found


@transaction.atomic
def apply_step(profile: SipaluProfile, step: str, data, files) -> None:
    from apps.workers.models import Consent, WorkerSkill

    w = profile.worker
    if step == "name":
        d = _valid(NameStep, data)
        w.full_name = d["full_name"].strip()
        if "full_name_ne" in d:
            w.full_name_ne = d["full_name_ne"].strip() or None
        w.save(update_fields=["full_name", "full_name_ne", "updated_at"])
        if w.user and not w.user.full_name:
            w.user.full_name = w.full_name
            w.user.save(update_fields=["full_name"])
    elif step == "photo":
        f = files.get("photo")
        if f is None:
            raise APIError("validation_error", fields={"photo": ["Add a photo."]})
        f = validate_upload(f, kinds={"image"}, max_mb=8)
        w.photo.save(getattr(f, "name", "photo.jpg"), f, save=False)
        w.save(update_fields=["photo", "updated_at"])
    elif step == "skills":
        d = _valid(SkillsStep, data)
        trades = _trades([r["trade"] for r in d["skills"]])
        keep = []
        for r in d["skills"]:
            obj, _ = WorkerSkill.objects.update_or_create(
                worker=w,
                trade=trades[r["trade"]],
                defaults={"years_experience": r["years_experience"], "nstb_level": r["nstb_level"]},
            )
            keep.append(obj.pk)
        w.skills.exclude(pk__in=keep).delete()
        profile.years_total = max(r["years_experience"] for r in d["skills"])
        profile.save(update_fields=["years_total", "updated_at"])
    elif step == "languages":
        from apps.workers.services import set_languages

        d = _valid(LanguagesStep, data)
        set_languages(w, d["languages"])
    elif step == "service_area":
        d = _valid(ServiceAreaStep, data)
        districts = _districts(d["service_districts"])
        profile.service_districts.set(districts)
        if d.get("current_district"):
            w.current_district = _districts([d["current_district"]])[0]
            w.save(update_fields=["current_district", "updated_at"])
        elif not w.current_district_id:
            w.current_district = districts[0]
            w.save(update_fields=["current_district", "updated_at"])
        for key in ("service_municipality", "service_radius_km"):
            if key in d:
                setattr(
                    profile,
                    key,
                    d[key] if d[key] is not None else (None if key == "service_radius_km" else ""),
                )
        for key in ("base_lat", "base_lng"):
            if key in d:
                setattr(profile, key, round(d[key], 2) if d[key] is not None else None)
        profile.save()
    elif step == "availability":
        d = _valid(AvailabilityStep, data)
        profiles.set_availability(profile, d["rules"])
    elif step == "services":
        d = _valid(ServicesStep, data)
        trades = _trades([r["trade"] for r in d["services"]])
        for i, r in enumerate(d["services"]):
            profiles.validate_service_data(r)
            SipaluService.objects.update_or_create(
                profile=profile,
                trade=trades[r["trade"]],
                title=r["title"],
                defaults={
                    "title_ne": r.get("title_ne") or "",
                    "description": r.get("description") or "",
                    "price_type": r["price_type"],
                    "price": r["price"],
                    "visit_fee": r.get("visit_fee"),
                    "estimated_minutes": r.get("estimated_minutes"),
                    "is_active": True,
                    "order": i,
                },
            )
    elif step == "headline":
        d = _valid(HeadlineStep, data)
        for k, v in d.items():
            setattr(profile, k, v.strip())
        profile.save()
    elif step == "payment":
        d = _valid(PaymentStep, data)
        w.payment_method = d["payment_method"]
        for k in ("wallet_id", "bank_name", "bank_account_no", "bank_account_name"):
            if k in d:
                setattr(w, k, d[k] or None)
        w.save()
    elif step == "identity":
        d = _valid(IdentityStep, data)
        front = files.get("id_front")
        back = files.get("id_back")
        if front is None and not w.id_front:
            raise APIError("validation_error", fields={"id_front": ["Add a photo of the front of your ID."]})
        if d.get("citizenship_no"):
            w.citizenship_no = d["citizenship_no"]
        if d.get("nid_no"):
            w.nid_no = d["nid_no"]
        if front is not None:
            front = validate_upload(front, kinds={"image", "pdf"}, max_mb=8)
            w.id_front.save(getattr(front, "name", "id-front.jpg"), front, save=False)
        if back is not None:
            back = validate_upload(back, kinds={"image", "pdf"}, max_mb=8)
            w.id_back.save(getattr(back, "name", "id-back.jpg"), back, save=False)
        if w.verification_status in ("unverified", "rejected"):
            w.verification_status = "pending"
        w.save()
    elif step == "consent":
        d = _valid(ConsentStep, data)
        for scope, granted in (
            ("data_processing", d["data_processing"]),
            ("profile_share", d["public_profile"]),
        ):
            if Consent.is_granted(w, None, scope) != granted:
                Consent.objects.create(worker=w, scope=scope, granted=granted, channel="app")
        profile.public_consent_at = (
            (profile.public_consent_at or timezone.now()) if d["public_profile"] else None
        )
        if not d["public_profile"]:
            profile.bolau_enabled = False
        profile.save(update_fields=["public_consent_at", "bolau_enabled", "updated_at"])
    else:  # pragma: no cover - validated by the view
        raise APIError("validation_error", fields={"step": ["Unknown step."]})
