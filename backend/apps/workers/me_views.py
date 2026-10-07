"""Worker self-service endpoints under /me/*."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.bs import BSDateError, BSMonth, today_ad
from apps.core.exceptions import APIError, InvalidState, OutsideGeofence
from apps.core.geo import within_geofence
from apps.core.pagination import StandardPagination
from apps.orgs.models import Site

from .models import Consent, Worker
from .serializers import ConsentSerializer, SelfWorkerSerializer, card_queryset, worker_history


def current_worker(request) -> Worker:
    worker = Worker.objects.filter(user=request.user).first()
    if worker is None:
        raise NotFound("No worker profile is linked to this account.")
    return worker


class MeWorkerView(APIView):
    def get(self, request):
        worker = card_queryset(Worker.objects.filter(pk=current_worker(request).pk)).get()
        return Response(SelfWorkerSerializer(worker, context={"request": request}).data)

    def patch(self, request):
        worker = current_worker(request)
        s = SelfWorkerSerializer(worker, data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save()
        log(request, "worker.self_update", worker, organization=None, changes=dict(request.data))
        return Response(s.data)


class MeWorkerClaimView(APIView):
    @transaction.atomic
    def post(self, request):
        existing = Worker.objects.filter(user=request.user).first()
        if existing:
            return Response(SelfWorkerSerializer(existing, context={"request": request}).data)
        worker = Worker.objects.select_for_update().filter(phone=request.user.phone).first()
        if worker is None:
            raise NotFound("No worker record with your phone number.")
        if worker.user_id and worker.user_id != request.user.id:
            raise InvalidState(message="This worker profile is already linked to another account.")
        worker.user = request.user
        worker.save(update_fields=["user", "updated_at"])
        if not request.user.full_name:
            request.user.full_name = worker.full_name
            request.user.save(update_fields=["full_name"])
        log(request, "worker.claim", worker, organization=None)
        return Response(SelfWorkerSerializer(worker, context={"request": request}).data)


class _PaginatedListView(APIView):
    def paginate(self, request, items):
        paginator = StandardPagination()
        page = paginator.paginate_queryset(items, request, view=self)
        return paginator.get_paginated_response(page)


class MeEmploymentsView(_PaginatedListView):
    def get(self, request):
        from apps.workforce.serializers import MyEmploymentSerializer
        from apps.workforce.views import employment_queryset

        worker = current_worker(request)
        qs = employment_queryset().filter(worker=worker).order_by("-start_date")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        data = MyEmploymentSerializer(page, many=True, context={"request": request}).data
        return paginator.get_paginated_response(data)


class MeHistoryView(_PaginatedListView):
    def get(self, request):
        worker = card_queryset(Worker.objects.filter(pk=current_worker(request).pk)).get()
        return self.paginate(request, worker_history(worker))


class MeAttendanceView(APIView):
    def get(self, request):
        from apps.workforce.models import Attendance

        worker = current_worker(request)
        p = request.query_params
        try:
            month = (
                BSMonth(int(p["bs_year"]), int(p["bs_month"])) if p.get("bs_year") else BSMonth.of(today_ad())
            )
            dates = month.dates()
        except (ValueError, KeyError, BSDateError) as exc:
            raise APIError("validation_error", fields={"bs_month": ["Invalid BS year/month."]}) from exc
        records = {}
        for a in Attendance.objects.filter(employment__worker=worker, date__range=(month.start, month.end)):
            records.setdefault(a.date, a)
        totals = {"present": 0, "half_day": 0, "absent": 0, "leave": 0, "overtime_hours": 0.0}
        ot = 0
        days = []
        for i, d in enumerate(dates):
            rec = records.get(d)
            if rec:
                ot += rec.overtime_minutes
                if rec.status in totals:
                    totals[rec.status] += 1
            days.append(
                {
                    "date": d.isoformat(),
                    "bs_day": i + 1,
                    "status": rec.status if rec else None,
                    "check_in_at": timezone.localtime(rec.check_in_at).isoformat()
                    if rec and rec.check_in_at
                    else None,
                    "check_out_at": timezone.localtime(rec.check_out_at).isoformat()
                    if rec and rec.check_out_at
                    else None,
                }
            )
        totals["overtime_hours"] = round(ot / 60, 2)
        return Response(
            {
                "bs_year": month.year,
                "bs_month": month.month,
                "month_name_en": month.name_en,
                "month_name_ne": month.name_ne,
                "days": days,
                "totals": totals,
            }
        )


class CheckInSerializer(serializers.Serializer):
    site_qr_token = serializers.UUIDField()
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    client_uuid = serializers.UUIDField(required=False, allow_null=True)


class _CheckBase(APIView):
    def resolve(self, request):
        from apps.workforce.models import Employment

        s = CheckInSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        worker = current_worker(request)
        site = (
            Site.objects.select_related("organization")
            .filter(qr_token=d["site_qr_token"], is_active=True)
            .first()
        )
        if site is None:
            raise NotFound("Unknown or inactive site QR code.")
        today = today_ad()
        emps = Employment.objects.select_related("organization", "shift").filter(
            worker=worker, organization=site.organization, status="active", start_date__lte=today
        )
        emp = emps.filter(site=site).first() or emps.first()
        if emp is None:
            raise APIError("permission_denied", message="You are not employed at this site.", status_code=403)
        if not within_geofence(site.lat, site.lng, site.geofence_radius_m, d["lat"], d["lng"]):
            raise OutsideGeofence()
        return d, emp, today

    @staticmethod
    def respond(record):
        from apps.workforce.serializers import AttendanceSerializer

        return Response(AttendanceSerializer(record).data)


class CheckInView(_CheckBase):
    def post(self, request):
        from apps.workforce.models import Attendance
        from apps.workforce.services import upsert_attendance

        d, emp, today = self.resolve(request)
        existing = Attendance.objects.filter(employment=emp, date=today).first()
        if existing and existing.check_in_at:
            return self.respond(existing)  # idempotent: already checked in
        record = upsert_attendance(
            emp,
            today,
            {
                "status": "present",
                "method": "qr",
                "check_in_at": timezone.now(),
                "check_in_lat": round(d["lat"], 6),
                "check_in_lng": round(d["lng"], 6),
            },
            client_uuid=d.get("client_uuid"),
            user=request.user,
        )
        return self.respond(record)


class CheckOutView(_CheckBase):
    def post(self, request):
        from apps.workforce.models import Attendance
        from apps.workforce.services import upsert_attendance

        d, emp, today = self.resolve(request)
        existing = Attendance.objects.filter(employment=emp, date=today).first()
        if existing is None or not existing.check_in_at:
            raise InvalidState(message="Check in first.")
        now = timezone.now()
        values = {
            "check_out_at": now,
            "check_out_lat": round(d["lat"], 6),
            "check_out_lng": round(d["lng"], 6),
        }
        if emp.shift_id:
            worked = int((now - existing.check_in_at).total_seconds() // 60)
            extra = worked - emp.shift.working_minutes - emp.shift.break_minutes
            values["overtime_minutes"] = max(extra // 30 * 30, 0)  # whole half-hours only
        record = upsert_attendance(emp, today, values, user=request.user)
        return self.respond(record)


class MePayslipViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    def get_serializer_class(self):
        from apps.payroll.serializers import PayslipSerializer

        return PayslipSerializer

    def get_queryset(self):
        from apps.payroll.models import Payslip

        worker = current_worker(self.request)
        return (
            Payslip.objects.filter(worker=worker, run__status__in=["approved", "paid"])
            .select_related("run__organization", "employment", "worker")
            .order_by("-run__bs_year", "-run__bs_month")
        )

    @action(detail=True, methods=["get"], url_path=r"payslip\.pdf")
    def pdf(self, request, pk=None):
        from apps.payroll.exports import payslip_pdf
        from apps.payroll.views import file_response, payslip_filename

        slip = self.get_object()
        return file_response(payslip_pdf(slip), "application/pdf", payslip_filename(slip), inline=True)


class MeConsentViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = ConsentSerializer

    def get_queryset(self):
        return Consent.objects.filter(worker=current_worker(self.request)).select_related("organization")

    def perform_create(self, serializer):
        worker = current_worker(self.request)
        consent = serializer.save(worker=worker, channel="app")
        log(
            self.request,
            "consent.create",
            consent,
            organization=consent.organization,
            changes={"scope": consent.scope, "granted": consent.granted},
        )
