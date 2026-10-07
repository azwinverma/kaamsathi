from __future__ import annotations

from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.core import labels
from apps.core.money import money_str
from apps.partners import labels as plabels
from apps.partners.serializers import partner_public

from .models import FinancialProfile, Offer, Referral


def _m(value):
    return money_str(value) if value is not None else None


def profile_dict(p: FinancialProfile) -> dict:
    return {
        "worker_id": str(p.worker_id),
        "months_on_platform": p.months_on_platform,
        "verified_months": p.verified_months,
        "avg_monthly_net": _m(p.avg_monthly_net),
        "min_monthly_net": _m(p.min_monthly_net),
        "max_monthly_net": _m(p.max_monthly_net),
        "income_stability": float(p.income_stability) if p.income_stability is not None else None,
        "employers_count": p.employers_count,
        "current_employment_months": p.current_employment_months,
        "ssf_months": p.ssf_months,
        "last_payslip_month": p.last_payslip_month or None,
        "monthly": p.monthly,
        "basis": "paid_payslips",
        "computed_at": p.computed_at.isoformat() if p.computed_at else None,
    }


def offered_by(partner) -> str:
    reg = labels.label(plabels.REGULATOR, partner.regulator)
    if reg:
        return _("Offered by %(partner)s, regulated by %(regulator)s") % {
            "partner": partner.name,
            "regulator": reg,
        }
    return _("Offered by %(partner)s") % {"partner": partner.name}


def offer_dict(o: Offer) -> dict:
    return {
        "id": str(o.id),
        "partner": partner_public(o.partner),
        "kind": o.kind,
        "kind_label": labels.label(plabels.OFFER_KIND, o.kind),
        "title": o.title,
        "title_ne": o.title_ne or None,
        "description": o.description,
        "description_ne": o.description_ne or None,
        "min_verified_months": o.min_verified_months,
        "min_avg_net": _m(o.min_avg_net),
        "max_amount": _m(o.max_amount),
        "interest_note": o.interest_note or None,
        "offered_by_label": offered_by(o.partner),
        "is_active": o.is_active,
    }


def referral_dict(r: Referral, audience: str = "worker") -> dict:
    data = {
        "id": str(r.id),
        "offer": {
            "id": str(r.offer_id),
            "kind": r.offer.kind,
            "title": r.offer.title,
            "title_ne": r.offer.title_ne or None,
        },
        "amount_requested": _m(r.amount_requested),
        "purpose_note": r.purpose_note or None,
        "status": r.status,
        "status_label": labels.label(plabels.REFERRAL_STATUS, r.status),
        "partner_ref": r.partner_ref or None,
        "amount_approved": _m(r.amount_approved),
        "partner_note": r.partner_note or None,
        "grant_id": str(r.grant_id),
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }
    if audience in ("worker", "ops"):
        data["partner"] = partner_public(r.partner)
        data["offered_by_label"] = offered_by(r.partner)
        data["history"] = r.history
    if audience == "ops":
        data["worker"] = {"id": str(r.worker_id), "full_name": r.worker.full_name}
        data["partner_notified_at"] = r.partner_notified_at.isoformat() if r.partner_notified_at else None
    if audience == "partner":
        grant_active = r.grant.is_active_at()
        data["worker"] = (
            {"id": str(r.worker_id), "full_name": r.worker.full_name, "phone": r.worker.phone}
            if grant_active
            else {"id": str(r.worker_id)}
        )
        data["grant_active"] = grant_active
    return data


class OfferSerializer(serializers.ModelSerializer):
    partner_id = serializers.UUIDField()

    class Meta:
        model = Offer
        fields = [
            "partner_id",
            "kind",
            "title",
            "title_ne",
            "description",
            "description_ne",
            "min_verified_months",
            "min_avg_net",
            "max_amount",
            "interest_note",
            "is_active",
        ]

    def validate_partner_id(self, value):
        from apps.partners.models import Partner

        if not Partner.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Partner not found.")
        return value

    def to_representation(self, instance):
        return offer_dict(instance)


class ApplySerializer(serializers.Serializer):
    amount_requested = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    purpose_note = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")
    days = serializers.IntegerField(required=False, min_value=1, allow_null=True)
