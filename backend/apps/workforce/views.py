import datetime as dt

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import AuditedViewSetMixin, log, snapshot
from apps.core import labels
from apps.core.bs import BSDateError, BSMonth, bs_str, bs_year_range, js_weekday, today_ad
from apps.core.exceptions import APIError, Duplicate, InvalidState
from apps.core.permissions import ALL_ROLES, OrgScopedMixin
from apps.geo.models import District
from apps.workers.models import Rating
from apps.workers.serializers import WORKER_CARD_PREFETCH

from . import importer, services
from .models import Advance, Attendance, Employment, Holiday, LeaveRequest
from .serializers import (
    AdvanceSerializer,
    AttendanceSerializer,
    BulkRecordSerializer,
    EmploymentCreateSerializer,
    EmploymentSerializer,
    EndEmploymentSerializer,
    HolidaySerializer,
    LeaveSerializer,
    RateSerializer,
)

CELL_CODES = {
    "present": "P",
    "absent": "A",
    "half_day": "H",
    "leave": "L",
    "holiday": "PH",
    "weekly_off": "WO",
}


def employment_queryset():
    return Employment.objects.select_related(
        "worker__current_district",
        "worker__permanent_district",
        "site",
        "trade",
        "supervisor",
        "shift",
        "organization",
    ).prefetch_related(*[f"worker__{p}" for p in WORKER_CARD_PREFETCH])


class SupervisorScopeMixin:
    def scope_employments(self, qs, field="site_id"):
        if self.is_supervisor:
            qs = qs.filter(**{f"{field}__in": self.supervisor_site_ids()})
        return qs

    def check_employment_access(self, employment):
        if self.is_supervisor and employment.site_id not in self.supervisor_site_ids():
            raise PermissionDenied()


def _parse_date_param(value, name="date"):
    try:
        return dt.date.fromisoformat(value) if value else today_ad()
    except ValueError as exc:
        raise APIError("validation_error", fields={name: ["Expected YYYY-MM-DD."]}) from exc


def _bs_month_params(request):
    p = request.query_params
    try:
        if p.get("bs_year") and p.get("bs_month"):
            month = BSMonth(int(p["bs_year"]), int(p["bs_month"]))
            _ = month.days
            return month
    except (ValueError, BSDateError) as exc:
        raise APIError("validation_error", fields={"bs_month": ["Invalid BS year/month."]}) from exc
    return BSMonth.of(today_ad())


# ---------------------------------------------------------------------------
# Employments
# ---------------------------------------------------------------------------


class EmploymentViewSet(OrgScopedMixin, SupervisorScopeMixin, AuditedViewSetMixin, viewsets.ModelViewSet):
    serializer_class = EmploymentSerializer
    role_rules = {"list": ALL_ROLES, "retrieve": ALL_ROLES}
    http_method_names = ["get", "post", "patch"]
    ordering_fields = ["start_date", "worker__full_name", "created_at", "designation"]
    audit_prefix = "employment"

    def get_queryset(self):
        qs = self.scope_employments(employment_queryset().filter(organization=self.org))
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("site"):
            qs = qs.filter(site_id=p["site"])
        if p.get("trade"):
            qs = qs.filter(trade_id=p["trade"])
        if p.get("wage_type"):
            qs = qs.filter(wage_type=p["wage_type"])
        if p.get("q"):
            q = p["q"]
            qs = qs.filter(
                Q(worker__full_name__icontains=q)
                | Q(worker__phone__contains=q)
                | Q(designation__icontains=q)
                | Q(employee_code__icontains=q)
            )
        return qs.order_by("worker__full_name")

    def get_serializer_class(self):
        return EmploymentCreateSerializer if self.action == "create" else EmploymentSerializer

    def create(self, request, *args, **kwargs):
        s = EmploymentCreateSerializer(data=request.data, context=self.get_serializer_context())
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        with transaction.atomic():
            worker = d.pop("worker_id", None)
            worker_data = d.pop("worker", None)
            if worker is None:
                worker_data = dict(worker_data)
                for fk in ("permanent_district", "current_district"):
                    code = worker_data.get(fk)
                    worker_data[fk] = District.objects.filter(code=code).first() if code else None
                worker, _ = services.get_or_create_worker(worker_data)
            employment = services.create_employment(self.org, worker, d)
            log(
                request,
                "employment.create",
                employment,
                organization=self.org,
                changes={"after": snapshot(employment)},
            )
        employment = self.get_queryset().model.objects.get(pk=employment.pk)
        return Response(
            EmploymentSerializer(employment, context=self.get_serializer_context()).data, status=201
        )

    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        emp = self.get_object()
        s = EndEmploymentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.end_employment(emp, s.validated_data["end_date"], s.validated_data["end_reason"])
        log(request, "employment.end", emp, organization=self.org, changes=s.data)
        return Response(EmploymentSerializer(emp, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def rate(self, request, pk=None):
        emp = self.get_object()
        s = RateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                rating = Rating.objects.create(employment=emp, rater="employer", **s.validated_data)
        except IntegrityError as exc:
            raise Duplicate(message="This employment is already rated.") from exc
        log(request, "employment.rate", emp, organization=self.org, changes=s.data)
        return Response(
            {
                "id": str(rating.id),
                "rater": "employer",
                "score_a": rating.score_a,
                "score_b": rating.score_b,
                "comment": rating.comment,
                "created_at": timezone.localtime(rating.created_at).isoformat(),
            },
            status=201,
        )

    @action(detail=False, methods=["post"], url_path="import", parser_classes=[MultiPartParser, FormParser])
    def import_file(self, request):
        upload = request.FILES.get("file")
        if not upload:
            raise APIError("validation_error", fields={"file": ["This field is required."]})
        result = importer.import_employments(self.org, upload)
        log(
            request,
            "employment.import",
            None,
            organization=self.org,
            object_type="employment",
            changes={
                "created": result["created"],
                "updated": result["updated"],
                "errors": len(result["errors"]),
            },
        )
        return Response(result)

    @action(detail=False, methods=["get"], url_path=r"import-template\.xlsx")
    def import_template(self, request):
        resp = HttpResponse(
            importer.template_xlsx(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = 'attachment; filename="kaamsathi-employment-import-template.xlsx"'
        return resp


# ---------------------------------------------------------------------------
# Attendance (Hajiri)
# ---------------------------------------------------------------------------


def _holiday_map(org, start, end) -> dict:
    return {
        h.date: h
        for h in Holiday.objects.filter(
            Q(organization__isnull=True) | Q(organization=org), date__range=(start, end)
        ).order_by("organization_id")
    }


class AttendanceDayView(OrgScopedMixin, SupervisorScopeMixin, APIView):
    role_rules = {"get": ALL_ROLES}

    def get(self, request):
        day = _parse_date_param(request.query_params.get("date"))
        qs = (
            employment_queryset()
            .filter(organization=self.org, start_date__lte=day)
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=day))
        )
        qs = self.scope_employments(qs)
        if request.query_params.get("site"):
            qs = qs.filter(site_id=request.query_params["site"])
        emps = list(qs.order_by("worker__full_name"))
        records = {a.employment_id: a for a in Attendance.objects.filter(employment__in=emps, date=day)}
        holiday = _holiday_map(self.org, day, day).get(day)
        lang_ne = getattr(request, "LANGUAGE_CODE", "en") == "ne"
        rows, summary = [], {"present": 0, "absent": 0, "half_day": 0, "leave": 0, "not_marked": 0}
        from apps.core.serializers import file_url

        for e in emps:
            rec = records.get(e.id)
            if rec is None:
                summary["not_marked"] += 1
            elif rec.status in summary:
                summary[rec.status] += 1
            rows.append(
                {
                    "employment_id": str(e.id),
                    "worker": {
                        "id": str(e.worker_id),
                        "full_name": e.worker.full_name,
                        "photo": file_url(request, e.worker.photo),
                    },
                    "designation": e.designation,
                    "site_id": str(e.site_id) if e.site_id else None,
                    "record": AttendanceSerializer(rec).data if rec else None,
                }
            )
        return Response(
            {
                "date": day.isoformat(),
                "date_bs": bs_str(day),
                "is_holiday": holiday is not None,
                "holiday_name": (holiday.name_ne or holiday.name_en)
                if holiday and lang_ne
                else (holiday.name_en if holiday else None),
                "is_weekly_off": js_weekday(day) == self.org.weekly_off_day,
                "rows": rows,
                "summary": summary,
            }
        )


class AttendanceRegisterView(OrgScopedMixin, SupervisorScopeMixin, APIView):
    role_rules = {"get": ALL_ROLES}

    def get(self, request):
        month = _bs_month_params(request)
        start, end = month.start, month.end
        qs = (
            employment_queryset()
            .filter(organization=self.org, start_date__lte=end)
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=start))
        )
        qs = self.scope_employments(qs)
        if request.query_params.get("site"):
            qs = qs.filter(site_id=request.query_params["site"])
        emps = list(qs.order_by("worker__full_name"))
        holidays = _holiday_map(self.org, start, end)
        dates = month.dates()
        today = today_ad()
        days = [
            {
                "date": d.isoformat(),
                "bs_day": i + 1,
                "weekday": js_weekday(d),
                "is_holiday": d in holidays,
                "is_weekly_off": js_weekday(d) == self.org.weekly_off_day,
            }
            for i, d in enumerate(dates)
        ]
        by_emp: dict = {}
        for a in Attendance.objects.filter(employment__in=emps, date__range=(start, end)):
            by_emp.setdefault(a.employment_id, {})[a.date] = a
        rows = []
        for e in emps:
            recs = by_emp.get(e.id, {})
            cells, totals = {}, {"present": 0, "half_day": 0, "absent": 0, "leave": 0, "overtime_hours": 0.0}
            ot_minutes = 0
            for d in dates:
                rec = recs.get(d)
                code = None
                if rec is not None:
                    code = CELL_CODES.get(rec.status)
                    ot_minutes += rec.overtime_minutes
                    if rec.status in totals:
                        totals[rec.status] += 1
                elif e.is_active_on(d) and d <= today:
                    if d in holidays:
                        code = "PH"
                    elif js_weekday(d) == self.org.weekly_off_day:
                        code = "WO"
                cells[d.isoformat()] = code
            totals["overtime_hours"] = round(ot_minutes / 60, 2)
            rows.append(
                {
                    "employment_id": str(e.id),
                    "worker_name": e.worker.full_name,
                    "designation": e.designation,
                    "cells": cells,
                    "totals": totals,
                }
            )
        return Response(
            {
                "bs_year": month.year,
                "bs_month": month.month,
                "month_name_en": month.name_en,
                "month_name_ne": month.name_ne,
                "days": days,
                "rows": rows,
            }
        )


class AttendanceBulkView(OrgScopedMixin, SupervisorScopeMixin, APIView):
    role_rules = {"post": ALL_ROLES}

    def post(self, request):
        records = request.data.get("records") if isinstance(request.data, dict) else None
        if not isinstance(records, list):
            raise APIError("validation_error", fields={"records": ["Expected a list of records."]})
        if len(records) > 1000:
            raise APIError("validation_error", fields={"records": ["At most 1000 records per request."]})
        saved, errors = [], []
        emp_cache: dict = {}
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
            emp = emp_cache.get(d["employment_id"])
            if emp is None:
                emp = (
                    Employment.objects.select_related("organization")
                    .filter(organization=self.org, pk=d["employment_id"])
                    .first()
                )
                emp_cache[d["employment_id"]] = emp
            if emp is None:
                errors.append(
                    {
                        "client_uuid": client_uuid,
                        "code": "not_found",
                        "message": str(labels.ERROR_MESSAGES["not_found"]),
                    }
                )
                continue
            if self.is_supervisor and emp.site_id not in self.supervisor_site_ids():
                errors.append(
                    {
                        "client_uuid": client_uuid,
                        "code": "permission_denied",
                        "message": str(labels.ERROR_MESSAGES["permission_denied"]),
                    }
                )
                continue
            values = {
                "status": d["status"],
                "method": d.get("method") or "supervisor",
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
                services.upsert_attendance(
                    emp, d["date"], values, client_uuid=d["client_uuid"], user=request.user
                )
                saved.append(client_uuid)
            except APIError as exc:
                errors.append({"client_uuid": client_uuid, "code": exc.code, "message": str(exc.detail)})
        if saved:
            log(
                request,
                "attendance.bulk",
                None,
                organization=self.org,
                object_type="attendance",
                changes={"saved": len(saved), "errors": len(errors)},
            )
        return Response({"saved": saved, "errors": errors})


# ---------------------------------------------------------------------------
# Leave, advances, holidays
# ---------------------------------------------------------------------------


class LeaveViewSet(
    OrgScopedMixin,
    SupervisorScopeMixin,
    AuditedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = LeaveSerializer
    default_roles = ALL_ROLES
    audit_prefix = "leave"
    ordering_fields = ["created_at", "from_date"]

    def get_queryset(self):
        qs = LeaveRequest.objects.filter(employment__organization=self.org).select_related(
            "employment__worker", "decided_by"
        )
        qs = self.scope_employments(qs, "employment__site_id")
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("employment"):
            qs = qs.filter(employment_id=p["employment"])
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        self.check_employment_access(serializer.validated_data["employment"])
        super().perform_create(serializer)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        leave = self.get_object()
        services.approve_leave(leave, request.user)
        log(request, "leave.approve", leave, organization=self.org)
        return Response(self.get_serializer(leave).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        leave = self.get_object()
        if leave.status != "pending":
            raise InvalidState()
        leave.status = "rejected"
        leave.decided_by = request.user
        leave.decided_at = timezone.now()
        leave.decision_note = (request.data or {}).get("note") or None
        leave.save(update_fields=["status", "decided_by", "decided_at", "decision_note"])
        log(request, "leave.reject", leave, organization=self.org, changes={"note": leave.decision_note})
        return Response(self.get_serializer(leave).data)


class AdvanceViewSet(
    OrgScopedMixin,
    AuditedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdvanceSerializer
    http_method_names = ["get", "post", "patch"]
    audit_prefix = "advance"

    def get_queryset(self):
        qs = Advance.objects.filter(employment__organization=self.org).select_related("employment__worker")
        if self.request.query_params.get("employment"):
            qs = qs.filter(employment_id=self.request.query_params["employment"])
        return qs.order_by("-given_on")


class HolidayViewSet(
    OrgScopedMixin,
    AuditedViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = HolidaySerializer
    role_rules = {"list": ALL_ROLES}
    audit_prefix = "holiday"

    def get_queryset(self):
        qs = Holiday.objects.filter(Q(organization__isnull=True) | Q(organization=self.org))
        year = self.request.query_params.get("bs_year")
        if year:
            try:
                start, end = bs_year_range(int(year))
            except (ValueError, BSDateError) as exc:
                raise APIError("validation_error", fields={"bs_year": ["Invalid BS year."]}) from exc
            qs = qs.filter(date__range=(start, end))
        return qs.order_by("date")

    def get_create_kwargs(self):
        return {"organization": self.org}

    def perform_destroy(self, instance):
        if instance.organization_id is None:
            raise PermissionDenied("National holidays cannot be deleted.")
        super().perform_destroy(instance)
