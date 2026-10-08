"""``POST /telemetry/events`` (auth optional, throttled) and the ops analytics API."""

from __future__ import annotations

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from apps.core.exceptions import APIError
from apps.core.permissions import IsOpsStaff

from . import analytics, services
from .schema import ANON_RE, CLIENT_EVENTS, MAX_BATCH, NAME_RE, PLATFORMS_CLIENT, clean_properties


class TelemetryThrottle(SimpleRateThrottle):
    scope = "telemetry"

    def get_rate(self):
        return getattr(settings, "TELEMETRY_THROTTLE_RATE", "60/minute")

    def get_cache_key(self, request, view):
        ident = request.user.pk if request.user and request.user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class EventInput(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    platform = serializers.ChoiceField(choices=sorted(PLATFORMS_CLIENT), default="web")
    properties = serializers.JSONField(required=False, default=dict)
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
    anonymous_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")

    def validate_name(self, value):
        if not NAME_RE.match(value) or value not in CLIENT_EVENTS:
            raise serializers.ValidationError("Unknown event.")
        return value

    def validate_anonymous_id(self, value):
        if value and not ANON_RE.match(value):
            raise serializers.ValidationError("8–64 letters, digits, '-' or '_'.")
        return value

    def validate_properties(self, value):
        clean, errors = clean_properties(value, strict=True)
        if errors:
            raise serializers.ValidationError([f"{k}: {v}" for k, v in sorted(errors.items())])
        return clean


class BatchInput(serializers.Serializer):
    events = EventInput(many=True, allow_empty=False)

    def validate_events(self, value):
        if len(value) > MAX_BATCH:
            raise serializers.ValidationError(f"At most {MAX_BATCH} events per request.")
        return value


def _quiet_org(request):
    """Organization from X-Org-Id when the user is an active member; otherwise None (never 403)."""
    if not (request.user and request.user.is_authenticated) or not request.headers.get("X-Org-Id"):
        return None
    from apps.core.permissions import resolve_membership

    try:
        return resolve_membership(request).organization
    except Exception:  # noqa: BLE001
        return None


class EventIngestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [TelemetryThrottle]

    @extend_schema(request=BatchInput, responses={202: dict})
    def post(self, request):
        data = request.data
        if isinstance(data, list):
            data = {"events": data}
        if (
            isinstance(data, dict)
            and isinstance(data.get("events"), list)
            and len(data["events"]) > MAX_BATCH
        ):
            raise APIError(
                "validation_error", fields={"events": [f"At most {MAX_BATCH} events per request."]}
            )
        s = BatchInput(data=data)
        s.is_valid(raise_exception=True)
        if not services.enabled():
            return Response({"accepted": 0}, status=202)
        user = request.user if request.user and request.user.is_authenticated else None
        n = services.ingest(s.validated_data["events"], user=user, organization=_quiet_org(request))
        return Response({"accepted": n}, status=202)


def _int_param(request, name, default, lo, hi):
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise APIError("validation_error", fields={name: ["Must be a number."]}) from exc
    if not lo <= value <= hi:
        raise APIError("validation_error", fields={name: [f"Must be between {lo} and {hi}."]})
    return value


class OpsFunnelView(APIView):
    permission_classes = [IsAuthenticated, IsOpsStaff]

    @extend_schema(responses=dict)
    def get(self, request):
        name = request.query_params.get("name", "worker_onboarding")
        if name not in analytics.FUNNELS:
            raise APIError("validation_error", fields={"name": [f"One of: {', '.join(analytics.FUNNELS)}."]})
        days = _int_param(request, "days", 30, 1, 400)
        return Response(analytics.funnel(name, days))


class OpsRetentionView(APIView):
    permission_classes = [IsAuthenticated, IsOpsStaff]

    @extend_schema(responses=dict)
    def get(self, request):
        cohort = request.query_params.get("cohort", "week")
        if cohort != "week":
            raise APIError("validation_error", fields={"cohort": ["Only 'week' is supported."]})
        weeks = _int_param(request, "weeks", 8, 1, 26)
        return Response(analytics.retention(weeks))
