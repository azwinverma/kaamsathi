from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.core.phone import mask_phone

from . import labels
from .models import CaseMessage, HelpArticle, SupportCase


def _dt(value):
    return timezone.localtime(value).isoformat() if value else None


def _user(user, *, phone=False):
    if user is None:
        return None
    out = {"id": str(user.pk), "full_name": user.full_name}
    if phone:
        out["phone"] = user.phone
    return out


def hide_requester(case: SupportCase, viewer) -> bool:
    """An anonymous safety report shared with the employer never reveals who reported it."""
    return case.anonymous and (viewer is None or viewer.pk != case.requester_id)


def case_payload(case: SupportCase, *, staff: bool = False, viewer=None) -> dict:
    """Shared read shape. ``staff`` adds the requester's phone, assignment, safety links and the
    identity-check state; for non-staff ``viewer`` an anonymous reporter is masked."""
    last = getattr(case, "last_message_at", None)
    count = getattr(case, "messages_count", None)
    anonymous = not staff and hide_requester(case, viewer)
    if staff:
        requester = _user(case.requester, phone=True)
    elif anonymous:
        requester = {"id": None, "full_name": str(labels.MESSAGES["anonymous_worker"]), "phone_masked": ""}
    else:
        requester = {
            "id": str(case.requester_id),
            "full_name": case.requester.full_name,
            "phone_masked": mask_phone(case.requester.phone),
        }
    data = {
        "id": str(case.id),
        "number": case.number,
        "requester": requester,
        "worker": (
            {"id": str(case.worker_id), "full_name": case.worker.full_name}
            if case.worker_id and not anonymous
            else None
        ),
        "organization": (
            {"id": str(case.organization_id), "name": case.organization.name}
            if case.organization_id
            else None
        ),
        "channel": case.channel,
        "channel_label": labels.label(labels.CHANNEL, case.channel),
        "category": case.category,
        "category_label": labels.label(labels.CATEGORY, case.category),
        "subject": case.subject,
        "description": case.description,
        "priority": case.priority,
        "priority_label": labels.label(labels.PRIORITY, case.priority),
        "status": case.status,
        "status_label": labels.label(labels.STATUS, case.status),
        "assignee": _user(case.assignee) if staff else None,
        "sla_due_at": _dt(case.sla_due_at),
        "overdue": case.is_overdue,
        "first_response_at": _dt(case.first_response_at),
        "resolved_at": _dt(case.resolved_at),
        "escalated": case.escalated if staff else False,
        "created_at": _dt(case.created_at),
        "updated_at": _dt(case.updated_at),
        "last_message_at": _dt(last),
        "messages_count": count,
        "safety_kind": case.safety_kind,
        "safety_kind_label": labels.label(labels.SAFETY_KIND, case.safety_kind),
        "confidential": case.confidential,
        "anonymous": case.anonymous,
        "emergency": case.emergency,
    }
    if staff:
        data.update(
            {
                "shared_with_org": case.shared_with_org,
                "dispute_id": str(case.dispute_id) if case.dispute_id else None,
                "risk_flag_id": str(case.risk_flag_id) if case.risk_flag_id else None,
                "identity_verified": case.identity_verified,
                "identity_verified_at": _dt(case.identity_verified_at),
                "identity_method": case.identity_method,
                "worker_phone": case.worker.phone if case.worker_id else None,
            }
        )
    return data


def message_payload(msg: CaseMessage, *, staff: bool = False, anonymize_user_id=None) -> dict:
    author = msg.author
    if anonymize_user_id is not None and msg.author_id == anonymize_user_id and not msg.from_staff:
        author = None
    return {
        "id": str(msg.id),
        "body": msg.body,
        "internal": msg.internal,
        "from_staff": msg.from_staff,
        "channel": msg.channel,
        "author": (
            {"id": str(author.pk), "full_name": author.full_name}
            if author is not None and (staff or not msg.from_staff)
            # requesters see "KaamSathi support", not the individual staff member
            else (
                {"id": None, "full_name": "KaamSathi"}
                if msg.from_staff
                else {"id": None, "full_name": str(labels.MESSAGES["anonymous_worker"])}
            )
        ),
        "created_at": _dt(msg.created_at),
    }


class CaseCreateSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=5000)
    category = serializers.ChoiceField(choices=list(labels.CATEGORY), default="other")
    priority = serializers.ChoiceField(choices=["low", "normal", "high"], default="normal")
    channel = serializers.ChoiceField(choices=["app", "web"], default="app")
    # safety incidents only
    safety_kind = serializers.ChoiceField(choices=list(labels.SAFETY_KIND), required=False, allow_null=True)
    anonymous = serializers.BooleanField(default=False)
    emergency = serializers.BooleanField(default=False)
    organization_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("category") == "safety" and not attrs.get("safety_kind"):
            raise serializers.ValidationError({"safety_kind": [str(labels.MESSAGES["safety_kind_required"])]})
        return attrs


class MessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=5000)


class StaffMessageCreateSerializer(MessageCreateSerializer):
    internal = serializers.BooleanField(default=False)
    # "phone" = a call note from the contact center (always stored as internal)
    channel = serializers.ChoiceField(choices=["app", "web", "phone", "sms", "field"], default="web")


class CaseUpdateSerializer(serializers.Serializer):
    assignee_id = serializers.UUIDField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=list(labels.STATUS), required=False)
    priority = serializers.ChoiceField(choices=list(labels.PRIORITY), required=False)
    shared_with_org = serializers.BooleanField(required=False)
    dispute_id = serializers.UUIDField(required=False, allow_null=True)
    risk_flag_id = serializers.UUIDField(required=False, allow_null=True)


class IdentityCheckSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=list(labels.IDENTITY_METHOD))
    result = serializers.ChoiceField(choices=["passed", "failed"])


class WorkerSensitiveUpdateSerializer(serializers.Serializer):
    phone = serializers.RegexField(r"^9[78]\d{8}$", required=False)
    payment_method = serializers.ChoiceField(choices=["bank", "esewa", "khalti", "cash"], required=False)
    bank_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    bank_account_no = serializers.CharField(max_length=40, required=False, allow_blank=True)
    bank_account_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    wallet_id = serializers.CharField(max_length=40, required=False, allow_blank=True)


class HelpArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = HelpArticle
        fields = [
            "id",
            "slug",
            "audience",
            "category",
            "title_en",
            "title_ne",
            "body_en",
            "body_ne",
            "is_published",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        from django.utils.translation import get_language

        data = super().to_representation(instance)
        ne = (get_language() or "en").startswith("ne")
        data["title"] = instance.title_ne if ne and instance.title_ne else instance.title_en
        data["body"] = instance.body_ne if ne and instance.body_ne else instance.body_en
        data["audience_label"] = labels.label(labels.HELP_AUDIENCE, instance.audience)
        data["category_label"] = labels.label(labels.HELP_CATEGORY, instance.category)
        data["updated_by"] = (
            {"id": str(instance.updated_by_id), "full_name": instance.updated_by.full_name}
            if self.context.get("staff") and instance.updated_by_id
            else None
        )
        return data
