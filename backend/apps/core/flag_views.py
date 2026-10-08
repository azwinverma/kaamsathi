"""Feature flag endpoints: ``GET /flags`` (signed-in clients) and ``/ops/flags`` CRUD (superadmin)."""

from __future__ import annotations

import uuid

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import diff, log, snapshot

from . import flags
from .models import FeatureFlag
from .permissions import IsOpsStaff

OPS_PERMS = [IsAuthenticated, IsOpsStaff]


class FeatureFlagSerializer(serializers.ModelSerializer):
    key = serializers.RegexField(r"^[a-z0-9_]{2,64}$", max_length=64)

    class Meta:
        model = FeatureFlag
        fields = [
            "key",
            "description",
            "enabled",
            "rollout",
            "org_ids",
            "percent",
            "client_visible",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_percent(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("Must be between 0 and 100.")
        return value

    def validate_org_ids(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Must be a list of organization ids.")
        out = []
        for raw in value:
            try:
                out.append(str(uuid.UUID(str(raw))))
            except ValueError as exc:
                raise serializers.ValidationError(f"Not an organization id: {raw}") from exc
        return sorted(set(out))

    def validate(self, attrs):
        rollout = attrs.get("rollout", getattr(self.instance, "rollout", "all"))
        org_ids = attrs.get("org_ids", getattr(self.instance, "org_ids", []))
        if rollout == "orgs" and not org_ids:
            raise serializers.ValidationError({"org_ids": ["Pick at least one organization."]})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["updated_by"] = (
            {"id": str(instance.updated_by_id), "full_name": instance.updated_by.full_name}
            if instance.updated_by_id
            else None
        )
        data["has_settings_fallback"] = instance.key in flags.SETTINGS_FALLBACK
        return data


def _known_defaults(existing: set[str]) -> list[dict]:
    """Settings-backed flags that have no row yet (shown so ops can create an override)."""
    return [
        {"key": key, "default": flags.default_for(key)}
        for key in sorted(flags.SETTINGS_FALLBACK)
        if key not in existing
    ]


class OpsFlagListView(APIView):
    """GET /ops/flags → {results: [Flag], settings_defaults: [{key, default}]} · POST /ops/flags."""

    permission_classes = OPS_PERMS

    @extend_schema(responses={200: dict})
    def get(self, request):
        rows = list(FeatureFlag.objects.select_related("updated_by"))
        return Response(
            {
                "results": FeatureFlagSerializer(rows, many=True).data,
                "settings_defaults": _known_defaults({r.key for r in rows}),
            }
        )

    @extend_schema(request=FeatureFlagSerializer, responses={201: FeatureFlagSerializer})
    def post(self, request):
        s = FeatureFlagSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if FeatureFlag.objects.filter(key=s.validated_data["key"]).exists():
            from .exceptions import Duplicate

            raise Duplicate(message="A flag with this key already exists.")
        flag = s.save(updated_by=request.user)
        log(request, "ops.flag.create", flag, organization=None, changes={"after": snapshot(flag)})
        return Response(FeatureFlagSerializer(flag).data, status=201)


class OpsFlagDetailView(APIView):
    """GET|PATCH|DELETE /ops/flags/{key}."""

    permission_classes = OPS_PERMS

    def _get(self, key) -> FeatureFlag:
        return get_object_or_404(FeatureFlag.objects.select_related("updated_by"), key=key)

    @extend_schema(responses={200: FeatureFlagSerializer})
    def get(self, request, key):
        return Response(FeatureFlagSerializer(self._get(key)).data)

    @extend_schema(request=FeatureFlagSerializer, responses={200: FeatureFlagSerializer})
    def patch(self, request, key):
        flag = self._get(key)
        data = {k: v for k, v in request.data.items() if k != "key"}
        s = FeatureFlagSerializer(flag, data=data, partial=True)
        s.is_valid(raise_exception=True)
        before = snapshot(flag)
        flag = s.save(updated_by=request.user)
        log(request, "ops.flag.update", flag, organization=None, changes=diff(before, snapshot(flag)))
        return Response(FeatureFlagSerializer(flag).data)

    def delete(self, request, key):
        flag = self._get(key)
        log(request, "ops.flag.delete", flag, organization=None, changes={"before": snapshot(flag)})
        flag.delete()
        return Response(status=204)


class ClientFlagsView(APIView):
    """GET /flags → {flags: {key: bool}} for client-visible flags (optional X-Org-Id)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: dict})
    def get(self, request):
        org = None
        raw = request.headers.get("X-Org-Id", "").strip()
        if raw:
            from .permissions import resolve_membership

            org = resolve_membership(request).organization
        return Response({"flags": flags.client_flags(org, request.user)})
