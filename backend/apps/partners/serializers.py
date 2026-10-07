from __future__ import annotations

from rest_framework import serializers

from apps.core import labels

from . import labels as plabels
from .models import ConsentGrant, Partner, PartnerAccessLog, PartnerAPIKey


def partner_ref(p: Partner | None):
    if p is None:
        return None
    return {"id": str(p.id), "name": p.name}


def partner_public(p: Partner) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "kind": p.kind,
        "kind_label": labels.label(plabels.PARTNER_KIND, p.kind),
        "regulator": p.regulator or None,
        "regulator_label": labels.label(plabels.REGULATOR, p.regulator),
        "license_no": p.license_no or None,
    }


def scope_list(scopes) -> list[dict]:
    return [{"scope": s, "label": labels.label(plabels.SCOPE, s)} for s in scopes or []]


def grant_dict(g: ConsentGrant, *, for_partner: bool = False) -> dict:
    status = g.current_status
    data = {
        "id": str(g.id),
        "purpose": g.purpose,
        "purpose_label": labels.label(plabels.PURPOSE, g.purpose),
        "scopes": list(g.scopes or []),
        "scope_labels": [labels.label(plabels.SCOPE, s) for s in g.scopes or []],
        "granted_at": g.granted_at.isoformat(),
        "expires_at": g.expires_at.isoformat(),
        "revoked_at": g.revoked_at.isoformat() if g.revoked_at else None,
        "channel": g.channel,
        "status": status,
        "status_label": labels.label(plabels.GRANT_STATUS, status),
    }
    if for_partner:
        data["worker"] = (
            {"id": str(g.worker_id), "full_name": g.worker.full_name}
            if status == "active"
            else {"id": str(g.worker_id)}
        )
    else:
        data["partner"] = partner_public(g.partner)
    return data


def access_log_dict(row: PartnerAccessLog, *, with_worker: bool = False) -> dict:
    data = {
        "id": str(row.id),
        "partner": partner_ref(row.partner),
        "endpoint": row.endpoint,
        "method": row.method,
        "scope": row.scope or None,
        "scope_label": labels.label(plabels.SCOPE, row.scope),
        "status_code": row.status_code,
        "granted": 200 <= row.status_code < 300,
        "created_at": row.created_at.isoformat(),
    }
    if with_worker:
        data["worker"] = (
            {"id": str(row.worker_id), "full_name": row.worker.full_name} if row.worker_id else None
        )
        data["api_key_prefix"] = row.api_key.prefix if row.api_key_id else None
    return data


def key_dict(k: PartnerAPIKey) -> dict:
    return {
        "id": str(k.id),
        "name": k.name,
        "prefix": k.prefix,
        "masked": f"ks_{k.prefix}_••••",
        "scopes": list(k.scopes or []),
        "created_at": k.created_at.isoformat(),
        "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
        "revoked_at": k.revoked_at.isoformat() if k.revoked_at else None,
        "is_active": k.revoked_at is None,
    }


class OpsPartnerSerializer(serializers.ModelSerializer):
    kind_label = serializers.SerializerMethodField()
    regulator_label = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()
    has_webhook_secret = serializers.SerializerMethodField()

    class Meta:
        model = Partner
        fields = [
            "id",
            "name",
            "kind",
            "kind_label",
            "license_no",
            "regulator",
            "regulator_label",
            "contact_email",
            "contact_phone",
            "webhook_url",
            "has_webhook_secret",
            "is_active",
            "created_at",
            "stats",
        ]
        read_only_fields = ["id", "created_at"]

    def get_kind_label(self, obj):
        return labels.label(plabels.PARTNER_KIND, obj.kind)

    def get_regulator_label(self, obj):
        return labels.label(plabels.REGULATOR, obj.regulator)

    def get_has_webhook_secret(self, obj):
        return bool(obj.webhook_secret)

    def get_stats(self, obj):
        return {
            "active_keys": getattr(obj, "n_active_keys", None),
            "active_grants": getattr(obj, "n_active_grants", None),
            "offers": getattr(obj, "n_offers", None),
            "referrals": getattr(obj, "n_referrals", None),
        }


class GrantCreateSerializer(serializers.Serializer):
    partner_id = serializers.UUIDField()
    purpose = serializers.ChoiceField(choices=list(plabels.PURPOSE.keys()))
    scopes = serializers.ListField(child=serializers.ChoiceField(choices=plabels.DATA_SCOPES), min_length=1)
    days = serializers.IntegerField(min_value=1, required=False, default=30)


class KeyCreateSerializer(serializers.Serializer):
    scopes = serializers.ListField(child=serializers.ChoiceField(choices=plabels.KEY_SCOPES), min_length=1)
    name = serializers.CharField(required=False, allow_blank=True, max_length=100, default="")


class ReferralStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["under_review", "approved", "rejected", "disbursed", "closed"])
    partner_ref = serializers.CharField(required=False, allow_blank=True, max_length=100)
    amount_approved = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, min_value=0)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)
