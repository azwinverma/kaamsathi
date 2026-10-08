"""Platform endpoints: /ops/system/* (superadmin) and the Prometheus /metrics endpoint."""

from __future__ import annotations

import datetime as dt
import hmac
import logging

from django.conf import settings
from django.db import connection
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log

from . import metrics
from .exceptions import APIError
from .models import FailedTask
from .permissions import IsOpsStaff
from .tasks import HEARTBEAT_KEY, retry_failed

logger = logging.getLogger("kaamsathi.system")
OPS_PERMS = [IsAuthenticated, IsOpsStaff]
BEAT_STALE_AFTER = dt.timedelta(minutes=15)


def _check_db() -> str:
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
        return "ok"
    except Exception:  # noqa: BLE001
        logger.exception("health: database unavailable")
        return "unavailable"


def _check_cache() -> str:
    try:
        from django.core.cache import cache

        cache.set("ks-health-probe", "1", 10)
        return "ok" if cache.get("ks-health-probe") == "1" else "unavailable"
    except Exception:  # noqa: BLE001
        logger.exception("health: redis unavailable")
        return "unavailable"


def _celery() -> dict:
    out = {"queue_length": None, "workers_seen": None}
    if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
        return out
    broker = getattr(settings, "CELERY_BROKER_URL", "") or ""
    if broker.startswith("redis"):
        try:
            import redis

            client = redis.Redis.from_url(broker, socket_timeout=0.5, socket_connect_timeout=0.5)
            out["queue_length"] = int(client.llen("celery"))
        except Exception:  # noqa: BLE001
            logger.warning("health: broker queue length unavailable", exc_info=True)
    try:
        from config.celery import app

        out["workers_seen"] = len(app.control.ping(timeout=0.5) or [])
    except Exception:  # noqa: BLE001
        logger.warning("health: celery ping failed", exc_info=True)
    return out


def _beat() -> dict:
    from django.core.cache import cache

    raw = cache.get(HEARTBEAT_KEY)
    last = parse_datetime(raw) if isinstance(raw, str) else None
    return {
        "last_heartbeat": last.isoformat() if last else None,
        "stale": last is None or timezone.now() - last > BEAT_STALE_AFTER,
    }


class SystemHealthView(APIView):
    """GET /ops/system/health."""

    permission_classes = OPS_PERMS

    @extend_schema(responses={200: dict})
    def get(self, request):
        from apps.notifications.models import SMSMessage

        since = timezone.now() - dt.timedelta(hours=24)
        return Response(
            {
                "db": _check_db(),
                "redis": _check_cache(),
                "celery": _celery(),
                "beat": _beat(),
                "failed_tasks_24h": FailedTask.objects.filter(created_at__gte=since).count(),
                "sms_failed_24h": SMSMessage.objects.filter(status="failed", created_at__gte=since).count(),
                "version": getattr(settings, "RELEASE", "") or "dev",
            }
        )


class FailedTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = FailedTask
        fields = [
            "id",
            "task_name",
            "task_id",
            "args_redacted",
            "exception",
            "traceback",
            "created_at",
            "retried_at",
            "dismissed_at",
        ]


class FailedTaskListView(generics.ListAPIView):
    """GET /ops/system/failed-tasks?status=open|retried|dismissed|all (default open)."""

    permission_classes = OPS_PERMS
    serializer_class = FailedTaskSerializer
    filter_backends = []

    def get_queryset(self):
        qs = FailedTask.objects.order_by("-created_at")
        status = self.request.query_params.get("status") or "open"
        if status == "open":
            qs = qs.filter(retried_at__isnull=True, dismissed_at__isnull=True)
        elif status == "retried":
            qs = qs.filter(retried_at__isnull=False)
        elif status == "dismissed":
            qs = qs.filter(dismissed_at__isnull=False)
        return qs


class _FailedTaskAction(APIView):
    permission_classes = OPS_PERMS

    def _get(self, pk) -> FailedTask:
        obj = FailedTask.objects.filter(pk=pk).first()
        if obj is None:
            raise APIError("not_found", status_code=404)
        return obj


class FailedTaskRetryView(_FailedTaskAction):
    """POST /ops/system/failed-tasks/{id}/retry."""

    @extend_schema(request=None, responses=FailedTaskSerializer)
    def post(self, request, pk):
        obj = self._get(pk)
        task_id = retry_failed(obj, request.user)
        log(request, "system.failed_task.retry", obj, object_type="failed_task", changes={"task_id": task_id})
        return Response(FailedTaskSerializer(obj).data)


class FailedTaskDismissView(_FailedTaskAction):
    """POST /ops/system/failed-tasks/{id}/dismiss."""

    @extend_schema(request=None, responses=FailedTaskSerializer)
    def post(self, request, pk):
        obj = self._get(pk)
        if obj.dismissed_at is None:
            obj.dismissed_at = timezone.now()
            obj.save(update_fields=["dismissed_at"])
            log(request, "system.failed_task.dismiss", obj, object_type="failed_task")
        return Response(FailedTaskSerializer(obj).data)


class MetricsView(APIView):
    """GET /metrics — Prometheus text format; ``Authorization: Bearer <METRICS_TOKEN>``.

    404 when ``METRICS_TOKEN`` is unset so the endpoint doesn't exist unless configured.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    @extend_schema(exclude=True)
    def get(self, request):
        token = getattr(settings, "METRICS_TOKEN", "")
        if not token:
            raise APIError("not_found", status_code=404)
        header = request.headers.get("Authorization", "")
        supplied = header[7:].strip() if header.lower().startswith("bearer ") else ""
        if not (supplied and hmac.compare_digest(supplied.encode(), token.encode())):
            raise APIError("not_authenticated", status_code=401)
        return HttpResponse(metrics.render(), content_type="text/plain; version=0.0.4; charset=utf-8")
