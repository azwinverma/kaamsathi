"""Ops audit trail (/ops/audit*, superadmin via ``apps/accounts/staff_roles.ROUTE_ROLES``)."""

from __future__ import annotations

import datetime as dt
import uuid

from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import APIError
from apps.core.permissions import IsOpsStaff

from .models import AuditLog
from .services import verify_chain

OPS_PERMS = [IsAuthenticated, IsOpsStaff]


class AuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "seq",
            "created_at",
            "actor",
            "organization",
            "action",
            "object_type",
            "object_id",
            "changes",
            "ip",
            "hash",
        ]

    def get_actor(self, obj):
        actor = obj.actor if obj.actor_id else None
        if actor is None:
            return {"id": str(obj.actor_id), "full_name": "", "phone": ""} if obj.actor_id else None
        return {"id": str(actor.pk), "full_name": actor.full_name, "phone": actor.phone}

    def get_organization(self, obj):
        org = obj.organization if obj.organization_id else None
        if org is None:
            return {"id": str(obj.organization_id), "name": ""} if obj.organization_id else None
        return {"id": str(org.pk), "name": org.name}


def _date(value: str, field: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value)
    except ValueError as exc:
        raise APIError("validation_error", fields={field: ["Use YYYY-MM-DD."]}) from exc


def _uuid_or_none(value: str):
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        return None


class AuditLogListView(generics.ListAPIView):
    """GET /ops/audit?actor=&organization=&action=&object_type=&object_id=&from=&to="""

    permission_classes = OPS_PERMS
    serializer_class = AuditLogSerializer
    filter_backends = []

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor", "organization").order_by("-seq")
        p = self.request.query_params
        if actor := (p.get("actor") or "").strip():
            actor_id = _uuid_or_none(actor)
            qs = qs.filter(actor_id=actor_id) if actor_id else qs.filter(actor__phone=actor)
        if org := (p.get("organization") or "").strip():
            org_id = _uuid_or_none(org)
            if org_id is None:
                raise APIError("validation_error", fields={"organization": ["Invalid id."]})
            qs = qs.filter(organization_id=org_id)
        if action := (p.get("action") or "").strip():
            qs = qs.filter(Q(action=action) | Q(action__startswith=action.rstrip(".") + "."))
        if object_type := (p.get("object_type") or "").strip():
            qs = qs.filter(object_type=object_type)
        if object_id := (p.get("object_id") or "").strip():
            qs = qs.filter(object_id=object_id)
        tz = timezone.get_current_timezone()
        if start := (p.get("from") or "").strip():
            qs = qs.filter(created_at__gte=dt.datetime.combine(_date(start, "from"), dt.time.min, tzinfo=tz))
        if end := (p.get("to") or "").strip():
            qs = qs.filter(
                created_at__lt=dt.datetime.combine(
                    _date(end, "to") + dt.timedelta(days=1), dt.time.min, tzinfo=tz
                )
            )
        return qs


class AuditVerifyView(APIView):
    """GET /ops/audit/verify → {ok, checked, first_broken_id}."""

    permission_classes = OPS_PERMS

    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response(verify_chain())
