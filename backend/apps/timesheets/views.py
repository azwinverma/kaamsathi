"""/org/timesheets*, /org/timesheet-policy and worker /me/timesheets (CONTRACT-EXTENSIONS §4)."""

from __future__ import annotations

import datetime as dt

from django.db import transaction
from django.utils import timezone
from django.utils.translation import pgettext
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.bs import bs_str
from apps.core.pagination import StandardPagination
from apps.core.permissions import ALL_ROLES, MANAGERS, OrgScopedMixin
from apps.workforce.views import SupervisorScopeMixin

from . import services
from .models import Timesheet, TimesheetPolicy


def _iso(value):
    return timezone.localtime(value).isoformat() if value else None


def _user_ref(user):
    return {"id": str(user.pk), "full_name": user.full_name or user.phone} if user else None


def timesheet_dict(ts: Timesheet, policy: TimesheetPolicy) -> dict:
    emp = ts.employment
    capped = services.over_cap(ts, policy)
    return {
        "id": str(ts.id),
        "employment_id": str(emp.id),
        "worker": {"id": str(emp.worker_id), "full_name": emp.worker.full_name},
        "designation": emp.designation,
        "site": {"id": str(emp.site_id), "name": emp.site.name} if emp.site_id else None,
        "week_start": ts.week_start.isoformat(),
        "week_end": (ts.week_start + dt.timedelta(days=6)).isoformat(),
        "week_start_bs": bs_str(ts.week_start),
        "status": ts.status,
        "days": ts.days,
        "regular_minutes": ts.regular_minutes,
        "overtime_minutes_claimed": ts.overtime_minutes_claimed,
        "overtime_minutes_approved": ts.overtime_minutes_approved,
        "over_cap": capped,
        "warning": pgettext(
            "enterprise", "Overtime is above the weekly limit of %(hours)s hours (Labour Act)."
        )
        % {"hours": round(policy.weekly_ot_cap_minutes / 60, 1)}
        if capped
        else None,
        "submitted_by": _user_ref(ts.submitted_by),
        "submitted_at": _iso(ts.submitted_at),
        "approved_by": _user_ref(ts.approved_by),
        "approved_at": _iso(ts.approved_at),
        "note": ts.note,
        "updated_at": _iso(ts.updated_at),
    }


def policy_dict(p: TimesheetPolicy) -> dict:
    return {
        "ot_requires_approval": p.ot_requires_approval,
        "weekly_ot_cap_minutes": p.weekly_ot_cap_minutes,
        "daily_regular_minutes": p.daily_regular_minutes,
    }


def timesheet_queryset():
    return Timesheet.objects.select_related(
        "employment__worker", "employment__site", "employment__organization", "submitted_by", "approved_by"
    )


class GenerateSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    site = serializers.UUIDField(required=False, allow_null=True)


class ApproveSerializer(serializers.Serializer):
    overtime_minutes_approved = serializers.IntegerField(required=False, allow_null=True, min_value=0)


class RejectSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=1000)


class BulkSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=500)


class PolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimesheetPolicy
        fields = ["ot_requires_approval", "weekly_ot_cap_minutes", "daily_regular_minutes"]

    def validate_daily_regular_minutes(self, value):
        if not 60 <= value <= 720:
            raise serializers.ValidationError(pgettext("enterprise", "Must be between 60 and 720 minutes."))
        return value

    def validate_weekly_ot_cap_minutes(self, value):
        if value > 4320:
            raise serializers.ValidationError(pgettext("enterprise", "Must be at most 4320 minutes."))
        return value


class TimesheetViewSet(
    OrgScopedMixin,
    SupervisorScopeMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    role_rules = {"list": ALL_ROLES, "retrieve": ALL_ROLES, "generate": ALL_ROLES, "submit": ALL_ROLES}
    default_roles = MANAGERS
    serializer_class = GenerateSerializer  # schema only; responses are built by timesheet_dict

    def get_queryset(self):
        qs = self.scope_employments(
            timesheet_queryset().filter(employment__organization=self.org), "employment__site_id"
        )
        p = self.request.query_params
        if p.get("week_start"):
            qs = qs.filter(week_start=services.parse_week_start(p["week_start"]))
        if p.get("site"):
            qs = qs.filter(employment__site_id=p["site"])
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("employment"):
            qs = qs.filter(employment_id=p["employment"])
        return qs.order_by("-week_start", "employment__worker__full_name")

    @property
    def policy(self):
        if not hasattr(self, "_policy"):
            self._policy = services.policy_or_default(self.org)
        return self._policy

    def _out(self, ts):
        return timesheet_dict(timesheet_queryset().get(pk=ts.pk), self.policy)

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response([timesheet_dict(t, self.policy) for t in page])

    def retrieve(self, request, *args, **kwargs):
        return Response(timesheet_dict(self.get_object(), self.policy))

    @action(detail=False, methods=["post"])
    def generate(self, request):
        s = GenerateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        week = services.parse_week_start(s.validated_data["week_start"])
        site = s.validated_data.get("site")
        site_ids = self.supervisor_site_ids() if self.is_supervisor else None
        result = services.generate(self.org, week, site=site, site_ids=site_ids)
        log(
            request,
            "timesheet.generate",
            None,
            organization=self.org,
            object_type="timesheet",
            changes={"week_start": week.isoformat(), "site": str(site) if site else None, **result},
        )
        return Response({"week_start": week.isoformat(), **result})

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        ts = services.submit(self.get_object(), request.user)
        log(request, "timesheet.submit", ts, organization=self.org)
        return Response(self._out(ts))

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        s = ApproveSerializer(data=request.data or {})
        s.is_valid(raise_exception=True)
        ts = services.approve(
            self.get_object(), request.user, s.validated_data.get("overtime_minutes_approved")
        )
        log(
            request,
            "timesheet.approve",
            ts,
            organization=self.org,
            changes={"overtime_minutes_approved": ts.overtime_minutes_approved},
        )
        return Response(self._out(ts))

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        s = RejectSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ts = services.reject(self.get_object(), request.user, s.validated_data["note"])
        log(request, "timesheet.reject", ts, organization=self.org, changes={"note": ts.note})
        return Response(self._out(ts))

    @action(detail=False, methods=["post"], url_path="bulk-approve")
    def bulk_approve(self, request):
        s = BulkSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        approved, skipped = [], []
        with transaction.atomic():
            sheets = {t.pk: t for t in self.get_queryset().filter(pk__in=s.validated_data["ids"])}
            for tid in s.validated_data["ids"]:
                ts = sheets.get(tid)
                if ts is None:
                    skipped.append({"id": str(tid), "code": "not_found"})
                elif ts.status not in {"draft", "submitted"}:
                    skipped.append({"id": str(tid), "code": "invalid_state"})
                else:
                    services.approve(ts, request.user)
                    approved.append(str(tid))
        if approved:
            log(
                request,
                "timesheet.bulk_approve",
                None,
                organization=self.org,
                object_type="timesheet",
                changes={"approved": approved, "skipped": len(skipped)},
            )
        return Response({"approved": approved, "skipped": skipped})


class TimesheetPolicyView(OrgScopedMixin, APIView):
    role_rules = {"get": ALL_ROLES, "patch": MANAGERS}

    def get(self, request):
        return Response(policy_dict(services.policy_or_default(self.org)))

    def patch(self, request):
        policy = services.get_policy(self.org)
        before = policy_dict(policy)
        s = PolicySerializer(policy, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        log(
            request,
            "timesheet_policy.update",
            policy,
            organization=self.org,
            changes={"before": before, "after": policy_dict(policy)},
        )
        return Response(policy_dict(policy))


class MeTimesheetsView(APIView):
    """Worker self-service: own timesheets across employers (newest week first)."""

    def get(self, request):
        from apps.workers.me_views import current_worker

        worker = current_worker(request)
        qs = timesheet_queryset().filter(employment__worker=worker).order_by("-week_start")
        if request.query_params.get("status"):
            qs = qs.filter(status__in=request.query_params["status"].split(","))
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        policies: dict = {}
        out = []
        for ts in page:
            org = ts.employment.organization
            if org.pk not in policies:
                policies[org.pk] = services.policy_or_default(org)
            row = timesheet_dict(ts, policies[org.pk])
            row["organization"] = {
                "id": str(org.pk),
                "name": org.name,
                "name_ne": getattr(org, "name_ne", None),
            }
            row.pop("submitted_by", None)
            row.pop("approved_by", None)
            out.append(row)
        return paginator.get_paginated_response(out)
