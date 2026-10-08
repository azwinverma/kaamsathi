"""Roster endpoints (docs/CONTRACT-ECOSYSTEM.md §7)."""

from __future__ import annotations

import datetime as dt

from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.exceptions import APIError
from apps.core.permissions import ALL_ROLES, OrgScopedMixin
from apps.orgs.models import Shift, Site
from apps.workers.me_views import current_worker
from apps.workforce.models import Employment

from . import services
from .models import RosterEntry

MAX_ENTRIES = 1000


class EntrySerializer(serializers.Serializer):
    employment_id = serializers.UUIDField()
    date = serializers.DateField()
    shift_id = serializers.UUIDField(required=False, allow_null=True)
    site_id = serializers.UUIDField(required=False, allow_null=True)
    is_off = serializers.BooleanField(default=False)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)


class CopyWeekSerializer(serializers.Serializer):
    from_week_start = serializers.DateField()
    to_week_start = serializers.DateField()
    site = serializers.UUIDField(required=False, allow_null=True)


class RosterScopeMixin(OrgScopedMixin):
    role_rules = {"get": ALL_ROLES, "put": ALL_ROLES, "post": ALL_ROLES}

    def employments(self, start: dt.date, end: dt.date, site=None):
        qs = (
            Employment.objects.filter(organization=self.org, start_date__lte=end)
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=start))
            .select_related("worker", "shift", "site", "organization")
        )
        if self.is_supervisor:
            qs = qs.filter(site_id__in=self.supervisor_site_ids())
        if site:
            qs = qs.filter(site_id=site)
        return qs.order_by("worker__full_name")


class RosterView(RosterScopeMixin, APIView):
    def get(self, request):
        start = services.parse_week_start(request.query_params.get("week_start"))
        end = start + dt.timedelta(days=6)
        site = request.query_params.get("site") or None
        emps = list(self.employments(start, end, site))
        entries: dict = {}
        for e in RosterEntry.objects.filter(employment__in=emps, date__range=(start, end)):
            entries.setdefault(e.employment_id, {})[e.date] = e
        days = services.week_days(start, self.org)
        conflicts = services.conflicts_for(
            (emp, day) for emp in emps for day, entry in entries.get(emp.id, {}).items() if not entry.is_off
        )
        rows = []
        for emp in emps:
            mine = entries.get(emp.id, {})
            warnings = {
                day.isoformat(): codes for (emp_id, day), codes in conflicts.items() if emp_id == emp.id
            }
            rows.append(
                {
                    "employment_id": str(emp.id),
                    "worker_name": emp.worker.full_name,
                    "designation": emp.designation,
                    "site_id": str(emp.site_id) if emp.site_id else None,
                    "default_shift_id": str(emp.shift_id) if emp.shift_id else None,
                    "start_date": emp.start_date.isoformat(),
                    "end_date": emp.end_date.isoformat() if emp.end_date else None,
                    "cells": {
                        d["date"]: services.cell(mine.get(dt.date.fromisoformat(d["date"]))) for d in days
                    },
                    # O005: {"<date>": [on_leave|holiday|weekly_off|conflict_elsewhere]} — warnings only
                    "warnings": warnings,
                }
            )
        return Response(
            {
                "week_start": start.isoformat(),
                "week_start_bs": days[0]["date_bs"],
                "week_end": end.isoformat(),
                "week_end_bs": days[-1]["date_bs"],
                "days": days,
                "shifts": [services.shift_ref(s) for s in Shift.objects.filter(organization=self.org)],
                "rows": rows,
                "warning_labels": {k: str(v) for k, v in services.conflict_labels().items()},
            }
        )

    def put(self, request):
        raw = request.data.get("entries") if isinstance(request.data, dict) else None
        if not isinstance(raw, list):
            raise APIError("validation_error", fields={"entries": ["Expected a list of entries."]})
        if len(raw) > MAX_ENTRIES:
            raise APIError(
                "validation_error", fields={"entries": [f"At most {MAX_ENTRIES} entries per request."]}
            )
        s = EntrySerializer(data=raw, many=True)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        emp_ids = {d["employment_id"] for d in data}
        emps = {
            e.id: e
            for e in Employment.objects.filter(organization=self.org, pk__in=emp_ids).select_related(
                "organization"
            )
        }
        shifts = {x.id: x for x in Shift.objects.filter(organization=self.org)}
        sites = {x.id: x for x in Site.objects.filter(organization=self.org)}
        allowed_sites = self.supervisor_site_ids() if self.is_supervisor else None
        errors, entries = {}, []
        for i, d in enumerate(data):
            emp = emps.get(d["employment_id"])
            if emp is None:
                errors[f"entries.{i}.employment_id"] = ["Unknown employment."]
                continue
            if allowed_sites is not None and emp.site_id not in allowed_sites:
                raise PermissionDenied()
            if not emp.is_active_on(d["date"]):
                errors[f"entries.{i}.date"] = ["The worker is not employed on this date."]
                continue
            shift = site = None
            if d.get("shift_id"):
                shift = shifts.get(d["shift_id"])
                if shift is None:
                    errors[f"entries.{i}.shift_id"] = ["Unknown shift."]
                    continue
            if d.get("site_id"):
                site = sites.get(d["site_id"])
                if site is None:
                    errors[f"entries.{i}.site_id"] = ["Unknown site."]
                    continue
                if allowed_sites is not None and site.id not in allowed_sites:
                    raise PermissionDenied()
            entries.append(
                {
                    "employment": emp,
                    "date": d["date"],
                    "shift": shift,
                    "site": site,
                    "is_off": d.get("is_off", False),
                    "note": d.get("note"),
                }
            )
        if errors:
            raise APIError("validation_error", fields=errors)
        result = services.upsert(entries, request.user)
        changed = result.pop("changed")
        log(request, "roster.update", None, organization=self.org, object_type="rosterentry", changes=result)
        result["warnings"] = services.warnings_list(
            services.conflicts_for(
                (e["employment"], e["date"]) for e in entries if e.get("shift") and not e.get("is_off")
            )
        )
        result["notified_workers"] = services.notify_roster_changes(changed)
        return Response(result)


class RosterCopyWeekView(RosterScopeMixin, APIView):
    def post(self, request):
        s = CopyWeekSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if d["from_week_start"] == d["to_week_start"]:
            raise APIError("validation_error", fields={"to_week_start": ["Pick a different week."]})
        site = d.get("site")
        if site and self.is_supervisor and site not in self.supervisor_site_ids():
            raise PermissionDenied()
        start, end = d["from_week_start"], d["from_week_start"] + dt.timedelta(days=6)
        emps = self.employments(start, end, site)
        changed: list = []
        copied = services.copy_week(emps, d["from_week_start"], d["to_week_start"], request.user, changed)
        log(
            request,
            "roster.copy_week",
            None,
            organization=self.org,
            object_type="rosterentry",
            changes={**s.data, "copied": copied},
        )
        notified = services.notify_roster_changes(changed)
        return Response({"copied": copied, "notified_workers": notified})


class MeRosterView(APIView):
    def get(self, request):
        worker = current_worker(request)
        start = services.parse_week_start(request.query_params.get("week_start"))
        end = start + dt.timedelta(days=6)
        entries = (
            RosterEntry.objects.filter(employment__worker=worker, date__range=(start, end))
            .select_related("employment__organization", "employment__site", "shift", "site")
            .order_by("date")
        )
        out = []
        for e in entries:
            site = e.site or e.employment.site
            out.append(
                {
                    "date": e.date.isoformat(),
                    "date_bs": services.bs_str(e.date),
                    "employment_id": str(e.employment_id),
                    "organization": {
                        "id": str(e.employment.organization_id),
                        "name": e.employment.organization.name,
                    },
                    "shift": services.shift_ref(e.shift),
                    "site": {"id": str(site.id), "name": site.name} if site else None,
                    "is_off": e.is_off,
                    "note": e.note,
                }
            )
        return Response(
            {
                "week_start": start.isoformat(),
                "week_start_bs": services.bs_str(start),
                "days": services.week_days(start),
                "entries": out,
            }
        )
