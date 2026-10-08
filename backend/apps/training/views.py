"""Training endpoints (docs/CONTRACT-ECOSYSTEM.md §4)."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import pgettext
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import AuditedViewSetMixin, log, snapshot
from apps.core.exceptions import APIError, Duplicate, InvalidState
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsOpsStaff, OrgScopedMixin
from apps.workers.me_views import current_worker

from . import services
from .models import Course, Enrollment, TrainingProvider
from .serializers import (
    CourseSerializer,
    EnrollmentSerializer,
    EnrollmentStatusSerializer,
    MeEnrollSerializer,
    OrgEnrollSerializer,
    ProviderSerializer,
    ProviderVerifySerializer,
    SessionAttendanceInputSerializer,
    SessionSerializer,
)

OPS_PERMS = [IsAuthenticated, IsOpsStaff]


def course_queryset():
    return Course.objects.select_related("provider__district", "trade", "district").annotate(
        seats_taken=Count("enrollments", filter=Q(enrollments__status__in=["enrolled", "completed"])),
        applied_count=Count("enrollments", filter=Q(enrollments__status="applied")),
    )


def enrollment_queryset():
    return Enrollment.objects.select_related(
        "worker", "course__provider", "course__trade", "sponsored_by_org"
    ).order_by("-applied_at")


def _open_courses(request, recommended: set[str]):
    qs = course_queryset().filter(status="open", provider__is_active=True)
    p = request.query_params
    if p.get("trade"):
        qs = qs.filter(trade_id=p["trade"])
    if p.get("district"):
        qs = qs.filter(district_id=p["district"])
    if p.get("q"):
        qs = qs.filter(
            Q(title__icontains=p["q"]) | Q(title_ne__icontains=p["q"]) | Q(provider__name__icontains=p["q"])
        )
    if p.get("recommended") in ("true", "1"):
        qs = qs.filter(trade_id__in=recommended)
    rank = Case(
        When(trade_id__in=list(recommended) or [""], then=Value(0)),
        default=Value(1),
        output_field=IntegerField(),
    )
    return qs.annotate(rank=rank).order_by("rank", "starts_on", "title")


def _paginate(view, request, qs, serializer_cls, **ctx):
    paginator = StandardPagination()
    page = paginator.paginate_queryset(qs, request, view=view)
    data = serializer_cls(page, many=True, context={"request": request, **ctx}).data
    return paginator.get_paginated_response(data)


# --- worker -----------------------------------------------------------------------------------


class MeCoursesView(APIView):
    def get(self, request):
        worker = current_worker(request)
        recommended = set(worker.skills.values_list("trade_id", flat=True)) | services.top_shortage_trades()
        qs = _open_courses(request, recommended)
        return _paginate(self, request, qs, CourseSerializer, recommended_trades=recommended)


class MeEnrollmentsView(APIView):
    def get(self, request):
        qs = enrollment_queryset().filter(worker=current_worker(request))
        return _paginate(self, request, qs, EnrollmentSerializer)

    def post(self, request):
        worker = current_worker(request)
        s = MeEnrollSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        course = s.validated_data["course_id"]
        if course.status != "open" or not course.provider.is_active:
            raise InvalidState(message=_("This course is not open for applications."))
        try:
            with transaction.atomic():
                enrollment = Enrollment.objects.create(course=course, worker=worker, status="applied")
        except IntegrityError as exc:
            raise Duplicate(message=_("You have already applied for this course.")) from exc
        log(request, "enrollment.apply", enrollment, organization=None)
        return Response(EnrollmentSerializer(enrollment, context={"request": request}).data, status=201)


# --- employer ---------------------------------------------------------------------------------


class OrgCoursesView(OrgScopedMixin, APIView):
    def get(self, request):
        from apps.workforce.models import Employment

        workforce_trades = set(
            Employment.objects.filter(organization=self.org, status="active", trade__isnull=False)
            .values_list("trade_id", flat=True)
            .distinct()
        )
        recommended = workforce_trades | services.top_shortage_trades()
        qs = _open_courses(request, recommended)
        return _paginate(self, request, qs, CourseSerializer, recommended_trades=recommended)


class OrgEnrollmentsView(OrgScopedMixin, APIView):
    def get(self, request):
        qs = enrollment_queryset().filter(sponsored_by_org=self.org)
        p = request.query_params
        if p.get("course"):
            qs = qs.filter(course_id=p["course"])
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        return _paginate(self, request, qs, EnrollmentSerializer)

    def post(self, request):
        from apps.workforce.models import Employment

        s = OrgEnrollSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        course = s.validated_data["course_id"]
        if course.status != "open" or not course.provider.is_active:
            raise InvalidState(message=_("This course is not open for applications."))
        worker_ids = list(dict.fromkeys(s.validated_data["worker_ids"]))
        active = {
            e.worker_id: e.worker
            for e in Employment.objects.filter(
                organization=self.org, status="active", worker_id__in=worker_ids
            ).select_related("worker")
        }
        existing = set(
            Enrollment.objects.filter(course=course, worker_id__in=worker_ids).values_list(
                "worker_id", flat=True
            )
        )
        created, skipped = [], []
        with transaction.atomic():
            for wid in worker_ids:
                if wid not in active:
                    skipped.append(
                        {"worker_id": str(wid), "reason": _("Not an active worker in your organization.")}
                    )
                    continue
                if wid in existing:
                    skipped.append({"worker_id": str(wid), "reason": _("Already applied or enrolled.")})
                    continue
                created.append(
                    Enrollment.objects.create(
                        course=course, worker=active[wid], status="applied", sponsored_by_org=self.org
                    )
                )
        if not active:
            raise APIError(
                "validation_error", fields={"worker_ids": [_("Not an active worker in your organization.")]}
            )
        log(
            request,
            "org.enrollment.sponsor",
            course,
            organization=self.org,
            object_type="course",
            changes={"workers": [str(e.worker_id) for e in created], "fee_noted": f"{course.fee:.2f}"},
        )
        ctx = {"request": request}
        return Response(
            {
                "created": EnrollmentSerializer(created, many=True, context=ctx).data,
                "skipped": skipped,
                "fee_total": f"{course.fee * len(created):.2f}",
            },
            status=201 if created else 200,
        )


# --- ops --------------------------------------------------------------------------------------


class OpsProviderViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = OPS_PERMS
    serializer_class = ProviderSerializer
    http_method_names = ["get", "post", "patch", "delete"]
    audit_prefix = "ops.training_provider"

    def get_queryset(self):
        qs = TrainingProvider.objects.select_related("district", "partner", "verified_by").annotate(
            courses_count=Count("courses")
        )
        p = self.request.query_params
        if p.get("q"):
            qs = qs.filter(Q(name__icontains=p["q"]) | Q(name_ne__icontains=p["q"]))
        if p.get("kind"):
            qs = qs.filter(kind=p["kind"])
        if p.get("district"):
            qs = qs.filter(district_id=p["district"])
        if p.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=p["is_active"] == "true")
        if p.get("verification_status"):
            qs = qs.filter(verification_status__in=p["verification_status"].split(","))
        return qs.order_by("name")

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        """T002 — ``{status: verified|rejected|pending, note?}``. Verifying a CTEVT-affiliated
        provider needs its affiliation number on record (ops check the affiliation documents)."""
        provider = self.get_object()
        s = ProviderVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        status = s.validated_data["status"]
        if status == "verified" and provider.kind == "ctevt_affiliated" and not provider.ctevt_affiliation_no:
            raise APIError(
                "validation_error",
                fields={
                    "ctevt_affiliation_no": [
                        pgettext("complete1", "Record the CTEVT affiliation number before verifying.")
                    ]
                },
            )
        if status == "rejected" and not s.validated_data.get("note"):
            raise APIError(
                "validation_error",
                fields={"note": [pgettext("complete1", "Give a reason for the rejection.")]},
            )
        old = provider.verification_status
        provider.verification_status = status
        provider.verification_note = s.validated_data.get("note") or None
        provider.verified_by = request.user if status != "pending" else None
        provider.verified_at = timezone.now() if status != "pending" else None
        provider.save(
            update_fields=["verification_status", "verification_note", "verified_by", "verified_at"]
        )
        log(
            request,
            "ops.training_provider.verify",
            provider,
            organization=None,
            changes={"verification_status": {"from": old, "to": status}, "note": provider.verification_note},
        )
        return Response(self.get_serializer(self.get_queryset().get(pk=provider.pk)).data)

    def perform_destroy(self, instance):
        if Enrollment.objects.filter(course__provider=instance).exists():
            raise InvalidState(message=_("This provider has enrolments. Mark it inactive instead."))
        super().perform_destroy(instance)


class OpsCourseViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = OPS_PERMS
    serializer_class = CourseSerializer
    http_method_names = ["get", "post", "patch", "delete"]
    audit_prefix = "ops.course"

    def get_queryset(self):
        qs = course_queryset()
        p = self.request.query_params
        for param, field in (("provider", "provider_id"), ("trade", "trade_id"), ("district", "district_id")):
            if p.get(param):
                qs = qs.filter(**{field: p[param]})
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("q"):
            qs = qs.filter(Q(title__icontains=p["q"]) | Q(provider__name__icontains=p["q"]))
        return qs.order_by("-starts_on", "title")

    def perform_destroy(self, instance):
        if instance.enrollments.exists():
            raise InvalidState(message=_("This course has enrolments. Close it instead."))
        super().perform_destroy(instance)

    @action(detail=True, methods=["get", "post"])
    def sessions(self, request, pk=None):
        """T006 — ``GET|POST /ops/training/courses/{id}/sessions {date, start_time?, end_time?, topic?}``."""
        course = self.get_object()
        if request.method == "GET":
            qs = course.sessions.annotate(
                present_count=Count("attendance", filter=Q(attendance__present=True))
            ).order_by("date", "start_time")
            return Response(SessionSerializer(qs, many=True).data)
        s = SessionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        session = s.save(course=course)
        log(
            request,
            "ops.training_session.create",
            session,
            organization=None,
            changes={"after": snapshot(session)},
        )
        return Response(SessionSerializer(session).data, status=201)


class OpsEnrollmentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = OPS_PERMS
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        qs = enrollment_queryset()
        p = self.request.query_params
        if p.get("course"):
            qs = qs.filter(course_id=p["course"])
        if p.get("worker"):
            qs = qs.filter(worker_id=p["worker"])
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("q"):
            qs = qs.filter(Q(worker__full_name__icontains=p["q"]) | Q(worker__phone__contains=p["q"]))
        return qs

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "include_phone": True}

    @action(detail=True, methods=["post"], url_path="status")
    def set_status(self, request, pk=None):
        enrollment = self.get_object()
        s = EnrollmentStatusSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        before = snapshot(enrollment)
        services.set_enrollment_status(
            enrollment,
            s.validated_data["status"],
            user=request.user,
            completed_on=s.validated_data.get("completed_on"),
        )
        log(
            request,
            "ops.enrollment.status",
            enrollment,
            organization=None,
            changes={"status": {"from": before["status"], "to": enrollment.status}},
        )
        return Response(self.get_serializer(enrollment_queryset().get(pk=enrollment.pk)).data)


class OpsShortagesView(APIView):
    permission_classes = OPS_PERMS

    def get(self, request):
        p = request.query_params
        try:
            days = int(p.get("days", 90))
            if not 1 <= days <= 730:
                raise ValueError
        except ValueError as exc:
            raise APIError(
                "validation_error", fields={"days": [_("Enter a number of days from 1 to 730.")]}
            ) from exc
        district = p.get("district") or None
        return Response({"district": district, "days": days, "results": services.shortages(district, days)})


class OpsSessionViewSet(
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """``GET|PATCH|DELETE /ops/training/sessions/{id}`` and ``GET|PUT …/{id}/attendance`` (T006)."""

    permission_classes = OPS_PERMS
    serializer_class = SessionSerializer
    http_method_names = ["get", "patch", "put", "delete"]

    def get_queryset(self):
        from .models import TrainingSession

        return TrainingSession.objects.select_related("course")

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        session = serializer.save()
        from apps.audit.services import diff

        log(
            self.request,
            "ops.training_session.update",
            session,
            organization=None,
            changes=diff(before, snapshot(session)),
        )

    def perform_destroy(self, instance):
        log(
            self.request,
            "ops.training_session.delete",
            instance,
            organization=None,
            changes={"before": snapshot(instance)},
        )
        instance.delete()

    @action(detail=True, methods=["get", "put"])
    def attendance(self, request, pk=None):
        from .models import SessionAttendance

        session = self.get_object()
        enrollments = list(
            session.course.enrollments.filter(status__in=["enrolled", "completed"]).select_related("worker")
        )
        if request.method == "PUT":
            raw = request.data.get("records") if isinstance(request.data, dict) else None
            s = SessionAttendanceInputSerializer(data=raw if isinstance(raw, list) else [], many=True)
            s.is_valid(raise_exception=True)
            if not isinstance(raw, list):
                raise APIError("validation_error", fields={"records": ["Expected a list of records."]})
            allowed = {e.pk: e for e in enrollments}
            bad = [str(r["enrollment_id"]) for r in s.validated_data if r["enrollment_id"] not in allowed]
            if bad:
                raise APIError(
                    "validation_error", fields={"records": [f"Not enrolled in this course: {', '.join(bad)}"]}
                )
            for r in s.validated_data:
                SessionAttendance.objects.update_or_create(
                    session=session,
                    enrollment=allowed[r["enrollment_id"]],
                    defaults={"present": r["present"], "marked_by": request.user},
                )
            log(
                request,
                "ops.training_session.attendance",
                session,
                organization=None,
                changes={
                    "present": sum(1 for r in s.validated_data if r["present"]),
                    "marked": len(s.validated_data),
                },
            )
        marks = dict(
            SessionAttendance.objects.filter(session=session).values_list("enrollment_id", "present")
        )
        return Response(
            {
                "session": SessionSerializer(session).data,
                "rows": [
                    {
                        "enrollment_id": str(e.pk),
                        "worker": {"id": str(e.worker_id), "full_name": e.worker.full_name},
                        "status": e.status,
                        "present": marks.get(e.pk),
                    }
                    for e in enrollments
                ],
            }
        )


class OpsOutcomesView(APIView):
    """``GET /ops/training/outcomes?provider=&course=&trade=`` (T010, k-anonymity 5)."""

    permission_classes = OPS_PERMS

    def get(self, request):
        p = request.query_params
        return Response(
            services.outcomes(
                provider=p.get("provider") or None,
                course=p.get("course") or None,
                trade=p.get("trade") or None,
            )
        )
