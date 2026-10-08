"""Org UI for API keys + webhooks (/org/api-keys, /org/webhooks) and the enterprise API (/enterprise/*)."""

from __future__ import annotations

import datetime as dt

from django.utils import timezone
from django.utils.translation import pgettext
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.exceptions import APIError, InvalidState
from apps.core.pagination import StandardPagination
from apps.core.permissions import ADMINS, OrgScopedMixin

from . import services
from .auth import HasOrgScope, OrgKeyAuthentication
from .models import EVENT_CODES, SCOPE_CODES, SCOPES, OrgAPIKey, WebhookDelivery, WebhookEndpoint

try:  # Idempotency-Key support (apps.core.idempotency, built by the platform agent).
    from apps.core.idempotency import idempotent
except ImportError:  # pragma: no cover - module not there yet: no-op decorator

    def idempotent(fn):
        return fn


def _iso(value):
    return timezone.localtime(value).isoformat() if value else None


# =========================================================================== serializers
def key_dict(k: OrgAPIKey) -> dict:
    return {
        "id": str(k.id),
        "name": k.name,
        "prefix": k.prefix,
        "masked": f"ks_org_{k.prefix}_…",
        "scopes": k.scopes,
        "created_by": {"id": str(k.created_by_id), "full_name": k.created_by.full_name}
        if k.created_by_id
        else None,
        "created_at": _iso(k.created_at),
        "last_used_at": _iso(k.last_used_at),
        "revoked_at": _iso(k.revoked_at),
        "is_active": k.revoked_at is None,
    }


def endpoint_dict(e: WebhookEndpoint, with_secret=False) -> dict:
    out = {
        "id": str(e.id),
        "url": e.url,
        "description": e.description,
        "events": e.events,
        "is_active": e.is_active,
        "secret_hint": f"{e.secret[:10]}…",
        "created_at": _iso(e.created_at),
    }
    if with_secret:
        out["secret"] = e.secret
    stats = getattr(e, "_stats", None)
    if stats is not None:
        out.update(stats)
    return out


def delivery_dict(d: WebhookDelivery) -> dict:
    return {
        "id": str(d.id),
        "endpoint_id": str(d.endpoint_id),
        "event": d.event,
        "payload": d.payload,
        "status": d.status,
        "attempts": d.attempts,
        "next_attempt_at": _iso(d.next_attempt_at),
        "last_status_code": d.last_status_code,
        "last_error": d.last_error,
        "created_at": _iso(d.created_at),
        "delivered_at": _iso(d.delivered_at),
    }


class KeyCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=SCOPE_CODES), min_length=1, max_length=len(SCOPE_CODES)
    )


class EndpointSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=500)
    description = serializers.CharField(max_length=200, required=False, allow_blank=True)
    events = serializers.ListField(child=serializers.ChoiceField(choices=EVENT_CODES), required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_url(self, value):
        error = services.validate_webhook_url(value)
        if error:
            raise serializers.ValidationError(error)
        return value


# =========================================================================== org UI
class OrgAPIKeyViewSet(OrgScopedMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    default_roles = ADMINS
    serializer_class = KeyCreateSerializer

    def get_queryset(self):
        return (
            OrgAPIKey.objects.filter(organization=self.org)
            .select_related("created_by")
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        resp = self.get_paginated_response([key_dict(k) for k in page])
        resp.data["available_scopes"] = [{"code": c, "label": str(lbl)} for c, lbl in SCOPES]
        return resp

    def create(self, request, *args, **kwargs):
        s = KeyCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        key, full = services.create_api_key(
            self.org, s.validated_data["name"], s.validated_data["scopes"], user=request.user
        )
        log(
            request,
            "org_api_key.create",
            key,
            organization=self.org,
            changes={"name": key.name, "prefix": key.prefix, "scopes": key.scopes},
        )
        return Response({**key_dict(key), "key": full}, status=201)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        key = services.revoke_api_key(self.get_object())
        log(request, "org_api_key.revoke", key, organization=self.org, changes={"prefix": key.prefix})
        return Response(key_dict(key))


class WebhookViewSet(OrgScopedMixin, viewsets.GenericViewSet):
    default_roles = ADMINS
    serializer_class = EndpointSerializer

    def get_queryset(self):
        return WebhookEndpoint.objects.filter(organization=self.org).order_by("-created_at")

    def _with_stats(self, endpoints):
        since = timezone.now() - dt.timedelta(days=7)
        for e in endpoints:
            qs = e.deliveries.filter(created_at__gte=since)
            e._stats = {
                "deliveries_7d": qs.count(),
                "failed_7d": qs.filter(status="failed").count(),
                "last_delivery_at": _iso(
                    e.deliveries.order_by("-created_at").values_list("created_at", flat=True).first()
                ),
            }
        return endpoints

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        resp = self.get_paginated_response([endpoint_dict(e) for e in self._with_stats(page)])
        resp.data["available_events"] = list(EVENT_CODES)
        return resp

    def retrieve(self, request, pk=None):
        return Response(endpoint_dict(self.get_object(), with_secret=True))

    def create(self, request):
        s = EndpointSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        e = WebhookEndpoint.objects.create(
            organization=self.org,
            url=d["url"],
            description=d.get("description") or "",
            events=d.get("events") or [],
            is_active=d.get("is_active", True),
        )
        log(request, "webhook.create", e, organization=self.org, changes={"url": e.url, "events": e.events})
        return Response(endpoint_dict(e, with_secret=True), status=201)

    def partial_update(self, request, pk=None):
        e = self.get_object()
        s = EndpointSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        for field, value in s.validated_data.items():
            setattr(e, field, value)
        e.save()
        log(request, "webhook.update", e, organization=self.org, changes=dict(s.validated_data))
        return Response(endpoint_dict(e))

    def destroy(self, request, pk=None):
        e = self.get_object()
        log(request, "webhook.delete", e, organization=self.org, changes={"url": e.url})
        e.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="rotate-secret")
    def rotate_secret(self, request, pk=None):
        from .models import new_webhook_secret

        e = self.get_object()
        e.secret = new_webhook_secret()
        e.save(update_fields=["secret"])
        log(request, "webhook.rotate_secret", e, organization=self.org)
        return Response(endpoint_dict(e, with_secret=True))

    @action(detail=True, methods=["post"])
    def test(self, request, pk=None):
        d = services.send_test(self.get_object())
        return Response(delivery_dict(d))

    @action(detail=True, methods=["get"])
    def deliveries(self, request, pk=None):
        e = self.get_object()
        qs = e.deliveries.order_by("-created_at")
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        page = self.paginate_queryset(qs)
        return self.get_paginated_response([delivery_dict(d) for d in page])


class RedeliverView(OrgScopedMixin, APIView):
    default_roles = ADMINS

    def post(self, request, delivery_id):
        d = (
            WebhookDelivery.objects.select_related("endpoint")
            .filter(pk=delivery_id, endpoint__organization=self.org)
            .first()
        )
        if d is None:
            raise NotFound()
        if d.status == "pending" and d.attempts == 0:
            raise InvalidState(message=pgettext("enterprise", "This delivery has not been attempted yet."))
        d = services.redeliver(d)
        log(request, "webhook.redeliver", d, organization=self.org, object_type="webhookdelivery")
        return Response(delivery_dict(d))


# =========================================================================== enterprise API
class EnterpriseAPIView(APIView):
    """Base for /enterprise/*: org-key auth; ``required_scopes`` maps HTTP method → scope."""

    authentication_classes = [OrgKeyAuthentication]
    permission_classes = [HasOrgScope]
    required_scopes: dict = {}

    @property
    def org(self):
        return self.request.auth.organization

    def paginate(self, qs, fn):
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, self.request, view=self)
        return paginator.get_paginated_response([fn(x) for x in page])

    def ctx(self):
        return {"request": self.request, "org": self.org}


def _date_param(request, name):
    value = request.query_params.get(name)
    if not value:
        return None
    try:
        return dt.date.fromisoformat(value)
    except ValueError as exc:
        raise APIError("validation_error", fields={name: ["Expected YYYY-MM-DD."]}) from exc


class EnterpriseJobsView(EnterpriseAPIView):
    required_scopes = {"get": "jobs.read", "post": "jobs.write"}

    def get(self, request):
        from apps.hiring.models import JobOpening
        from apps.hiring.serializers import JobSerializer

        qs = JobOpening.objects.filter(organization=self.org).select_related("trade", "site", "shift")
        if request.query_params.get("status"):
            qs = qs.filter(status__in=request.query_params["status"].split(","))
        return self.paginate(qs.order_by("-created_at"), lambda j: JobSerializer(j, context=self.ctx()).data)

    def post(self, request):
        from apps.hiring.serializers import JobSerializer

        s = JobSerializer(data=request.data, context=self.ctx())
        s.is_valid(raise_exception=True)  # same minimum-wage rules as /org/jobs
        job = s.save(organization=self.org, created_by=request.auth.created_by)
        log(
            None,
            "job.create",
            job,
            organization=self.org,
            changes={"via": "enterprise_api", "api_key": request.auth.prefix},
        )
        return Response(JobSerializer(job, context=self.ctx()).data, status=201)


class EnterpriseEmploymentsView(EnterpriseAPIView):
    required_scopes = {"get": "workforce.read"}

    def get(self, request):
        from apps.workforce.serializers import EmploymentSerializer
        from apps.workforce.views import employment_queryset

        qs = employment_queryset().filter(organization=self.org)
        p = request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("site"):
            qs = qs.filter(site_id=p["site"])
        return self.paginate(
            qs.order_by("worker__full_name"), lambda e: EmploymentSerializer(e, context=self.ctx()).data
        )


class EnterpriseAttendanceView(EnterpriseAPIView):
    required_scopes = {"get": "attendance.read"}
    MAX_DAYS = 62

    def get(self, request):
        from apps.core.bs import today_ad
        from apps.workforce.models import Attendance
        from apps.workforce.serializers import AttendanceSerializer

        end = _date_param(request, "to") or today_ad()
        start = _date_param(request, "from") or end - dt.timedelta(days=6)
        if start > end:
            raise APIError("validation_error", fields={"from": ["'from' must be on or before 'to'."]})
        if (end - start).days >= self.MAX_DAYS:
            raise APIError(
                "validation_error", fields={"from": [f"At most {self.MAX_DAYS} days per request."]}
            )
        qs = Attendance.objects.filter(
            employment__organization=self.org, date__range=(start, end)
        ).select_related("employment__worker")
        if request.query_params.get("site"):
            qs = qs.filter(employment__site_id=request.query_params["site"])

        def row(a):
            data = AttendanceSerializer(a).data
            data["employment_id"] = str(a.employment_id)
            data["worker"] = {"id": str(a.employment.worker_id), "full_name": a.employment.worker.full_name}
            return data

        return self.paginate(qs.order_by("date", "employment__worker__full_name"), row)


class EnterpriseAttendanceBulkView(EnterpriseAPIView):
    """Same semantics as POST /org/attendance/bulk; honours ``Idempotency-Key``."""

    required_scopes = {"post": "attendance.write"}

    @idempotent
    def post(self, request):
        from apps.core import labels
        from apps.workforce import services as wf
        from apps.workforce.models import Employment
        from apps.workforce.serializers import BulkRecordSerializer

        records = request.data.get("records") if isinstance(request.data, dict) else None
        if not isinstance(records, list):
            raise APIError("validation_error", fields={"records": ["Expected a list of records."]})
        if len(records) > 1000:
            raise APIError("validation_error", fields={"records": ["At most 1000 records per request."]})
        saved, errors, emp_cache = [], [], {}
        for raw in records:
            client_uuid = raw.get("client_uuid") if isinstance(raw, dict) else None
            s = BulkRecordSerializer(data=raw)
            if not s.is_valid():
                first = next(iter(s.errors.items()))
                errors.append(
                    {
                        "client_uuid": client_uuid,
                        "code": "validation_error",
                        "message": f"{first[0]}: {first[1][0]}",
                    }
                )
                continue
            d = s.validated_data
            client_uuid = str(d["client_uuid"])
            if d["employment_id"] not in emp_cache:
                emp_cache[d["employment_id"]] = (
                    Employment.objects.select_related("organization")
                    .filter(organization=self.org, pk=d["employment_id"])
                    .first()
                )
            emp = emp_cache[d["employment_id"]]
            if emp is None:
                errors.append(
                    {
                        "client_uuid": client_uuid,
                        "code": "not_found",
                        "message": str(labels.ERROR_MESSAGES["not_found"]),
                    }
                )
                continue
            values = {
                "status": d["status"],
                "method": d.get("method") or "manual",
                "overtime_minutes": d.get("overtime_minutes") or 0,
                "note": d.get("note"),
            }
            if d.get("check_in_at") is not None:
                values["check_in_at"] = d["check_in_at"]
                values["check_in_lat"], values["check_in_lng"] = d.get("lat"), d.get("lng")
            if d.get("check_out_at") is not None:
                values["check_out_at"] = d["check_out_at"]
                values["check_out_lat"], values["check_out_lng"] = d.get("lat"), d.get("lng")
            try:
                wf.upsert_attendance(emp, d["date"], values, client_uuid=d["client_uuid"], user=None)
                saved.append(client_uuid)
            except APIError as exc:
                errors.append({"client_uuid": client_uuid, "code": exc.code, "message": str(exc.detail)})
        if saved:
            log(
                None,
                "attendance.bulk",
                None,
                organization=self.org,
                object_type="attendance",
                changes={"saved": len(saved), "errors": len(errors), "via": "enterprise_api"},
            )
        return Response({"saved": saved, "errors": errors})


class EnterprisePayrollRunsView(EnterpriseAPIView):
    required_scopes = {"get": "payroll.read"}

    def get(self, request):
        from apps.payroll.models import PayrollRun
        from apps.payroll.serializers import PayrollRunSerializer

        qs = PayrollRun.objects.filter(organization=self.org).select_related("organization", "approved_by")
        return self.paginate(qs.order_by("-bs_year", "-bs_month"), lambda r: PayrollRunSerializer(r).data)


class EnterprisePayslipsView(EnterpriseAPIView):
    required_scopes = {"get": "payroll.read"}

    def get(self, request, run_id):
        from apps.payroll.models import PayrollRun
        from apps.payroll.serializers import PayslipSerializer

        run = PayrollRun.objects.filter(organization=self.org, pk=run_id).first()
        if run is None:
            raise NotFound()
        qs = run.payslips.select_related("worker", "employment", "run__organization").order_by(
            "worker__full_name"
        )
        return self.paginate(qs, lambda s: PayslipSerializer(s).data)


class EnterpriseTimesheetsView(EnterpriseAPIView):
    required_scopes = {"get": "timesheets.read"}

    def get(self, request):
        from apps.timesheets import services as ts_services
        from apps.timesheets.views import timesheet_dict, timesheet_queryset

        qs = timesheet_queryset().filter(employment__organization=self.org)
        p = request.query_params
        if p.get("week_start"):
            qs = qs.filter(week_start=ts_services.parse_week_start(p["week_start"]))
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        policy = ts_services.policy_or_default(self.org)
        return self.paginate(
            qs.order_by("-week_start", "employment__worker__full_name"), lambda t: timesheet_dict(t, policy)
        )
