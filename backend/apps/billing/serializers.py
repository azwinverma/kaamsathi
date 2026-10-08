"""Billing payloads (money as 2-dp strings, every date with an ``_bs`` twin)."""

from __future__ import annotations

from rest_framework import serializers

from apps.core.bs import bs_str
from apps.core.money import money_str

from . import labels, services
from .models import Charge, Plan


def _d(value):
    return value.isoformat() if value else None


class ChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Charge
        fields = ["id", "kind", "amount", "description", "bs_year", "bs_month", "status", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["application_id"] = str(instance.application_id) if instance.application_id else None
        data["kind_label"] = labels.label(labels.CHARGE_KIND, instance.kind)
        data["status_label"] = labels.label(labels.CHARGE_STATUS, instance.status)
        return data


def plan_dict(plan: Plan) -> dict:
    return {
        "code": plan.code,
        "name": plan.name,
        "code_label": labels.label(labels.PLAN_CODE, plan.code),
        "monthly_base": money_str(plan.monthly_base),
        "per_active_worker": money_str(plan.per_active_worker),
        "min_monthly": money_str(plan.min_monthly),
        "placement_fee": money_str(plan.placement_fee),
        "included_workers": plan.included_workers,
        "features": plan.features or {},
        "is_active": plan.is_active,
    }


def subscription_dict(org) -> dict:
    sub = services.subscription_for(org)
    plan = sub.plan if sub is not None else services.default_plan()
    workers = services.active_worker_count(org)
    return {
        "organization_id": str(org.id),
        "organization_name": org.name,
        "plan": plan_dict(plan),
        "status": sub.status if sub else "active",
        "status_label": labels.label(labels.SUBSCRIPTION_STATUS, sub.status if sub else "active"),
        "started_on": _d(sub.started_on) if sub else None,
        "started_on_bs": bs_str(sub.started_on) if sub else None,
        "is_default": sub is None,
        "active_workers": workers,
        "monthly_estimate": money_str(services.subscription_amount(workers, plan)),
    }


def line_dict(line) -> dict:
    return {
        "id": line.id,
        "kind": line.kind,
        "kind_label": labels.label(labels.CHARGE_KIND, line.kind),
        "description": line.description,
        "quantity": f"{line.quantity:.2f}",
        "unit_price": money_str(line.unit_price),
        "amount": money_str(line.amount),
        "charge_id": str(line.charge_id) if line.charge_id else None,
    }


def payment_dict(p) -> dict:
    return {
        "id": str(p.id),
        "amount": money_str(p.amount),
        "method": p.method,
        "method_label": labels.label(labels.PAYMENT_METHOD, p.method),
        "reference": p.reference,
        "paid_on": _d(p.paid_on),
        "paid_on_bs": bs_str(p.paid_on),
        "recorded_by": p.recorded_by.full_name if p.recorded_by_id else None,
        "created_at": p.created_at.isoformat(),
    }


def credit_note_dict(n) -> dict:
    return {
        "id": str(n.id),
        "number": n.number,
        "amount": money_str(n.amount),
        "vat_amount": money_str(n.vat_amount),
        "reason": n.reason,
        "issue_date": _d(n.issue_date),
        "issue_date_bs": bs_str(n.issue_date),
        "created_at": n.created_at.isoformat(),
    }


def invoice_dict(inv, *, detail: bool = False, ops: bool = False) -> dict:
    data = {
        "id": str(inv.id),
        "number": inv.number,
        "fiscal_year": inv.fiscal_year or None,
        "status": inv.status,
        "status_label": labels.label(labels.INVOICE_STATUS, inv.status),
        "payer_type": "organization" if inv.organization_id else "partner",
        "organization_id": str(inv.organization_id) if inv.organization_id else None,
        "partner_id": str(inv.partner_id) if inv.partner_id else None,
        "buyer_name": inv.buyer_name or str(inv.payer),
        "period_bs_year": inv.period_bs_year,
        "period_bs_month": inv.period_bs_month,
        "issue_date": _d(inv.issue_date),
        "issue_date_bs": bs_str(inv.issue_date),
        "due_date": _d(inv.due_date),
        "due_date_bs": bs_str(inv.due_date),
        "subtotal": money_str(inv.subtotal),
        "vat_rate": f"{inv.vat_rate:.2f}",
        "vat_amount": money_str(inv.vat_amount),
        "total": money_str(inv.total),
        "paid_amount": money_str(services.paid_amount(inv)),
        "credited_amount": money_str(services.credited_amount(inv)),
        "balance_due": money_str(services.balance_due(inv) if inv.status in ("issued", "paid") else 0),
        "created_at": inv.created_at.isoformat(),
    }
    if detail:
        data.update(
            {
                "buyer_address": inv.buyer_address,
                "pan_of_buyer": inv.pan_of_buyer or None,
                "notes": inv.notes,
                "lines": [line_dict(x) for x in inv.lines.all()],
                "payments": [payment_dict(x) for x in inv.payments.select_related("recorded_by")],
                "credit_notes": [credit_note_dict(x) for x in inv.credit_notes.all()],
                "void_reason": inv.void_reason or None,
            }
        )
    if ops:
        data["line_count"] = inv.lines.count()
    return data


# ----------------------------------------------------------------------------- inputs
class PlanInput(serializers.Serializer):
    code = serializers.ChoiceField(choices=list(labels.PLAN_CODE))
    name = serializers.CharField(max_length=60)
    monthly_base = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, default=0)
    per_active_worker = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, default=0)
    min_monthly = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, default=0)
    placement_fee = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, default=0)
    included_workers = serializers.IntegerField(min_value=0, default=0)
    features = serializers.DictField(required=False, default=dict)
    is_active = serializers.BooleanField(default=True)


class GenerateInput(serializers.Serializer):
    bs_year = serializers.IntegerField(min_value=2070, max_value=2100)
    bs_month = serializers.IntegerField(min_value=1, max_value=12)


class VoidInput(serializers.Serializer):
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class PaymentInput(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0)
    method = serializers.ChoiceField(choices=list(labels.PAYMENT_METHOD))
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    paid_on = serializers.DateField()


class CreditNoteInput(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0)
    reason = serializers.CharField(max_length=255)


class SubscriptionInput(serializers.Serializer):
    plan = serializers.CharField(max_length=20)
    status = serializers.ChoiceField(choices=list(labels.SUBSCRIPTION_STATUS), default="active")


class ChargeInput(serializers.Serializer):
    organization_id = serializers.UUIDField(required=False, allow_null=True)
    partner_id = serializers.UUIDField(required=False, allow_null=True)
    kind = serializers.ChoiceField(
        choices=["verification_fee", "training_commission", "partner_referral_fee"]
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    description = serializers.CharField(max_length=255)
    bs_year = serializers.IntegerField(required=False, allow_null=True, min_value=2070, max_value=2100)
    bs_month = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=12)

    def validate(self, attrs):
        org, partner = attrs.get("organization_id"), attrs.get("partner_id")
        if bool(org) == bool(partner):
            raise serializers.ValidationError(
                {"partner_id": ["Give exactly one payer: organization or partner."]}
            )
        if org and attrs["kind"] in labels.PARTNER_KINDS:
            raise serializers.ValidationError({"kind": ["This kind is billed to partners only."]})
        if attrs["amount"] <= 0:
            raise serializers.ValidationError({"amount": ["Must be greater than zero."]})
        return attrs
