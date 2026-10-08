"""Ops risk endpoints: flags list / manual flag / resolve, and a summary for the dashboard."""

from __future__ import annotations

import datetime as dt

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.exceptions import APIError, InvalidState
from apps.core.permissions import IsOpsStaff

from . import labels
from .models import FraudFlag
from .services import describe_subject, get_subject

OPS_PERMS = [IsAuthenticated, IsOpsStaff]
TREND_DAYS = 30


def _dt(value):
    return timezone.localtime(value).isoformat() if value else None


def _reason_labels(details: dict) -> list[str]:
    return [str(labels.REASON.get(r, r)) for r in (details or {}).get("reasons", [])]


def flag_payload(f: FraudFlag, cache: dict | None = None) -> dict:
    return {
        "id": str(f.id),
        "subject_type": f.subject_type,
        "subject_type_label": labels.label(labels.SUBJECT_TYPE, f.subject_type),
        "subject_id": f.subject_id,
        "subject": describe_subject(f.subject_type, f.subject_id, cache),
        "kind": f.kind,
        "kind_label": labels.label(labels.KIND, f.kind),
        "severity": f.severity,
        "severity_label": labels.label(labels.SEVERITY, f.severity),
        "status": f.status,
        "status_label": labels.label(labels.STATUS, f.status),
        "details": f.details,
        "reasons": _reason_labels(f.details),
        "note": f.note,
        "created_by": (
            {"id": str(f.created_by_id), "full_name": f.created_by.full_name} if f.created_by_id else None
        ),
        "created_at": _dt(f.created_at),
        "updated_at": _dt(f.updated_at),
        "resolved_by": (
            {"id": str(f.resolved_by_id), "full_name": f.resolved_by.full_name} if f.resolved_by_id else None
        ),
        "resolved_at": _dt(f.resolved_at),
    }


class ManualFlagSerializer(serializers.Serializer):
    subject_type = serializers.ChoiceField(choices=list(labels.SUBJECT_TYPE))
    subject_id = serializers.CharField(max_length=64)
    severity = serializers.ChoiceField(choices=list(labels.SEVERITY), default="medium")
    note = serializers.CharField(max_length=2000)


class ResolveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["confirmed", "dismissed"])
    note = serializers.CharField(max_length=2000)


class OpsRiskFlagViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = OPS_PERMS

    def get_queryset(self):
        qs = FraudFlag.objects.select_related("created_by", "resolved_by")
        p = self.request.query_params
        for field in ("status", "kind", "severity", "subject_type"):
            if p.get(field):
                qs = qs.filter(**{f"{field}__in": p[field].split(",")})
        if p.get("subject_id"):
            qs = qs.filter(subject_id=p["subject_id"])
        if p.get("worker"):
            # flags on the worker itself (attendance/employment flags carry the worker in details)
            qs = qs.filter(subject_type="worker", subject_id=p["worker"])
        return qs.order_by("-created_at")

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        cache: dict = {}
        return self.get_paginated_response([flag_payload(f, cache) for f in page])

    def retrieve(self, request, *args, **kwargs):
        return Response(flag_payload(self.get_object()))

    def create(self, request, *args, **kwargs):
        s = ManualFlagSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if get_subject(d["subject_type"], d["subject_id"]) is None:
            raise APIError(
                "validation_error",
                fields={"subject_id": [str(labels.MESSAGES["subject_not_found"])]},
            )
        f = FraudFlag.objects.create(
            subject_type=d["subject_type"],
            subject_id=d["subject_id"],
            kind="manual",
            severity=d["severity"],
            details={"note": d["note"]},
            created_by=request.user,
        )
        log(
            request,
            "ops.risk_flag.create",
            f,
            organization=None,
            changes={"subject": f"{f.subject_type}:{f.subject_id}", "severity": f.severity},
        )
        return Response(flag_payload(f), status=201)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        f = self.get_object()
        if f.status != "open":
            raise InvalidState(message=str(labels.MESSAGES["flag_closed"]))
        s = ResolveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        f.status = s.validated_data["status"]
        f.note = s.validated_data["note"]
        f.resolved_by = request.user
        f.resolved_at = timezone.now()
        f.save(update_fields=["status", "note", "resolved_by", "resolved_at", "updated_at"])
        log(
            request,
            "ops.risk_flag.resolve",
            f,
            organization=None,
            changes={"status": {"from": "open", "to": f.status}, "note": f.note},
        )
        return Response(flag_payload(f))


class OpsRiskSummaryView(APIView):
    """Counts by kind/severity/status and a 30-day trend of flags raised and resolved per day."""

    permission_classes = OPS_PERMS

    def get(self, request):
        today = timezone.localdate()
        start = today - dt.timedelta(days=TREND_DAYS - 1)
        open_qs = FraudFlag.objects.filter(status="open")

        def counts(qs, field, mapping):
            raw = dict(qs.values_list(field).annotate(n=Count("id")))
            return [
                {"key": key, "label": str(text), "count": raw.get(key, 0)} for key, text in mapping.items()
            ]

        created = dict(
            FraudFlag.objects.filter(created_at__date__gte=start)
            .annotate(day=TruncDate("created_at"))
            .values_list("day")
            .annotate(n=Count("id"))
        )
        resolved = dict(
            FraudFlag.objects.filter(resolved_at__date__gte=start)
            .annotate(day=TruncDate("resolved_at"))
            .values_list("day")
            .annotate(n=Count("id"))
        )
        trend = []
        for i in range(TREND_DAYS):
            day = start + dt.timedelta(days=i)
            trend.append(
                {"date": day.isoformat(), "created": created.get(day, 0), "resolved": resolved.get(day, 0)}
            )
        return Response(
            {
                "open": open_qs.count(),
                "open_high": open_qs.filter(severity="high").count(),
                "created_30d": sum(created.values()),
                "resolved_30d": sum(resolved.values()),
                "confirmed_30d": FraudFlag.objects.filter(
                    status="confirmed", resolved_at__date__gte=start
                ).count(),
                "by_kind": counts(open_qs, "kind", labels.KIND),
                "by_severity": counts(open_qs, "severity", labels.SEVERITY),
                "by_status": counts(FraudFlag.objects.all(), "status", labels.STATUS),
                "by_subject_type": counts(open_qs, "subject_type", labels.SUBJECT_TYPE),
                "trend": trend,
            }
        )
