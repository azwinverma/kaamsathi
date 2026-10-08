"""Attendance correction requests (P008).

Worker: ``GET|POST /me/attendance/corrections`` ``{employment_id, date, requested_status,
requested_check_in_at?, requested_check_out_at?, reason}``.
Employer: ``GET /org/attendance-corrections?status=&employment=`` (supervisors see their sites) ·
``POST /org/attendance-corrections/{id}/approve {note?}`` — applies the change through
``upsert_attendance`` (payroll-locked months → 400 ``invalid_state``) · ``POST …/{id}/reject {note}``.
Every request and decision is audited; the worker is notified of the decision and the site
supervisor(s) / managers of a new request.
"""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import pgettext
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core import labels
from apps.core.bs import bs_str, today_ad
from apps.core.exceptions import APIError, Duplicate, InvalidState
from apps.core.pagination import StandardPagination
from apps.core.permissions import ALL_ROLES, MANAGERS, OrgScopedMixin
from apps.workers.me_views import current_worker

from .models import AttendanceCorrection

CORRECTION_STATUS = labels.LEAVE_STATUS  # pending / approved / rejected (bilingual)


def _dt(v):
    return timezone.localtime(v).isoformat() if v else None


def correction_payload(c: AttendanceCorrection) -> dict:
    emp = c.employment
    return {
        "id": str(c.id),
        "employment_id": str(emp.id),
        "worker": {"id": str(emp.worker_id), "full_name": emp.worker.full_name},
        "organization": {"id": str(emp.organization_id), "name": emp.organization.name},
        "designation": emp.designation,
        "site_id": str(emp.site_id) if emp.site_id else None,
        "date": c.date.isoformat(),
        "date_bs": bs_str(c.date),
        "current_status": c.current_status,
        "current_status_label": labels.label(labels.ATTENDANCE_STATUS, c.current_status),
        "requested_status": c.requested_status,
        "requested_status_label": labels.label(labels.ATTENDANCE_STATUS, c.requested_status),
        "requested_check_in_at": _dt(c.requested_check_in_at),
        "requested_check_out_at": _dt(c.requested_check_out_at),
        "reason": c.reason,
        "status": c.status,
        "status_label": labels.label(CORRECTION_STATUS, c.status),
        "decided_by": {"id": str(c.decided_by_id), "full_name": c.decided_by.full_name}
        if c.decided_by_id
        else None,
        "decided_at": _dt(c.decided_at),
        "decision_note": c.decision_note,
        "created_at": _dt(c.created_at),
    }


def _qs():
    return AttendanceCorrection.objects.select_related(
        "employment__worker", "employment__organization", "decided_by"
    ).order_by("-created_at")


class CorrectionCreateSerializer(serializers.Serializer):
    employment_id = serializers.UUIDField()
    date = serializers.DateField()
    requested_status = serializers.ChoiceField(
        choices=[k for k, _ in AttendanceCorrection.ATTENDANCE_STATUSES]
    )
    requested_check_in_at = serializers.DateTimeField(required=False, allow_null=True)
    requested_check_out_at = serializers.DateTimeField(required=False, allow_null=True)
    reason = serializers.CharField(max_length=1000)

    def validate(self, attrs):
        if attrs["date"] > today_ad():
            raise serializers.ValidationError(
                {"date": [pgettext("complete1", "Date cannot be in the future.")]}
            )
        cin, cout = attrs.get("requested_check_in_at"), attrs.get("requested_check_out_at")
        if cin and cout and cout <= cin:
            raise serializers.ValidationError(
                {"requested_check_out_at": [pgettext("complete1", "Check-out must be after check-in.")]}
            )
        return attrs


class NoteSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


def _notify(user, kind, title, body, *, title_ne=None, body_ne=None, link=None, data=None):
    if user is None:
        return
    try:
        from apps.notifications.services import notify
    except ImportError:  # pragma: no cover
        return
    notify(user, kind, title, body, title_ne=title_ne, body_ne=body_ne, link=link, data=data)


def _notify_reviewers(c: AttendanceCorrection) -> None:
    from apps.orgs.models import Membership

    emp = c.employment
    members = Membership.objects.filter(organization_id=emp.organization_id, is_active=True).filter(
        Q(role__in=MANAGERS) | Q(role="supervisor", sites=emp.site_id)
    )
    for m in members.select_related("user").distinct():
        _notify(
            m.user,
            "attendance_correction",
            f"Hajiri correction request: {emp.worker.full_name}",
            f"{emp.worker.full_name} asked to correct {c.date.isoformat()} to {c.requested_status}.",
            title_ne=f"हाजिरी सच्याउने अनुरोध: {emp.worker.full_name}",
            link="/app/attendance",
            data={"correction_id": str(c.id)},
        )


# --------------------------------------------------------------------------- worker
class MeCorrectionsView(APIView):
    def get(self, request):
        worker = current_worker(request)
        qs = _qs().filter(employment__worker=worker)
        if request.query_params.get("status"):
            qs = qs.filter(status__in=request.query_params["status"].split(","))
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([correction_payload(c) for c in page])

    def post(self, request):
        from apps.payroll.services import is_month_locked
        from apps.workforce.models import Attendance, Employment

        worker = current_worker(request)
        s = CorrectionCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        emp = (
            Employment.objects.select_related("organization", "worker")
            .filter(pk=d["employment_id"], worker=worker)
            .first()
        )
        if emp is None:
            raise APIError("validation_error", fields={"employment_id": ["This employment is not yours."]})
        if not emp.is_active_on(d["date"]):
            raise InvalidState(message=pgettext("complete1", "You were not employed here on this date."))
        if is_month_locked(emp.organization, d["date"]):
            raise InvalidState(
                message=pgettext("complete1", "Payroll for this month is approved; ask your employer.")
            )
        current = (
            Attendance.objects.filter(employment=emp, date=d["date"]).values_list("status", flat=True).first()
        )
        try:
            with transaction.atomic():
                c = AttendanceCorrection.objects.create(
                    employment=emp,
                    date=d["date"],
                    requested_status=d["requested_status"],
                    requested_check_in_at=d.get("requested_check_in_at"),
                    requested_check_out_at=d.get("requested_check_out_at"),
                    reason=d["reason"],
                    current_status=current,
                    requested_by=request.user,
                )
        except IntegrityError as exc:
            raise Duplicate(
                message=pgettext("complete1", "You already have a pending correction for this day.")
            ) from exc
        log(
            request,
            "attendance_correction.request",
            c,
            organization=emp.organization,
            changes={"date": c.date.isoformat(), "from": current, "to": c.requested_status},
        )
        _notify_reviewers(c)
        return Response(correction_payload(_qs().get(pk=c.pk)), status=201)


# --------------------------------------------------------------------------- employer
class OrgCorrectionViewSet(
    OrgScopedMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    default_roles = ALL_ROLES  # supervisors limited to their sites below

    def get_queryset(self):
        qs = _qs().filter(employment__organization=self.org)
        if self.is_supervisor:
            qs = qs.filter(employment__site_id__in=self.supervisor_site_ids())
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("employment"):
            qs = qs.filter(employment_id=p["employment"])
        return qs

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response([correction_payload(c) for c in page])

    def retrieve(self, request, *args, **kwargs):
        return Response(correction_payload(self.get_object()))

    def _decide(self, request, approve: bool):
        from apps.workforce.services import upsert_attendance

        c = self.get_object()
        if self.is_supervisor and c.employment.site_id not in self.supervisor_site_ids():
            raise PermissionDenied()
        s = NoteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        note = s.validated_data.get("note") or None
        if not approve and not note:
            raise APIError("validation_error", fields={"note": ["Give the worker a reason."]})
        with transaction.atomic():
            c = AttendanceCorrection.objects.select_for_update().get(pk=c.pk)
            if c.status != "pending":
                raise InvalidState()
            if approve:
                values = {"status": c.requested_status, "method": "supervisor", "note": "correction"}
                if c.requested_check_in_at:
                    values["check_in_at"] = c.requested_check_in_at
                if c.requested_check_out_at:
                    values["check_out_at"] = c.requested_check_out_at
                upsert_attendance(c.employment, c.date, values, user=request.user)  # raises when locked
            c.status = "approved" if approve else "rejected"
            c.decided_by = request.user
            c.decided_at = timezone.now()
            c.decision_note = note
            c.save(update_fields=["status", "decided_by", "decided_at", "decision_note"])
        log(
            request,
            f"attendance_correction.{c.status}",
            c,
            organization=self.org,
            changes={"date": c.date.isoformat(), "to": c.requested_status, "note": note},
        )
        worker = c.employment.worker
        verb = "approved" if approve else "rejected"
        verb_ne = "स्वीकृत" if approve else "अस्वीकृत"
        _notify(
            worker.user if worker.user_id else None,
            "attendance_correction_decided",
            f"Hajiri correction {verb}",
            f"Your correction for {c.date.isoformat()} was {verb}." + (f" Note: {note}" if note else ""),
            title_ne=f"हाजिरी सच्याउने अनुरोध {verb_ne}",
            link="/me/attendance",
            data={"correction_id": str(c.id)},
        )
        return Response(correction_payload(_qs().get(pk=c.pk)))

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._decide(request, True)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._decide(request, False)
