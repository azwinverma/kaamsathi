import datetime as dt
import io
import uuid

import qrcode
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import AuditedViewSetMixin, diff, log, snapshot
from apps.core.bs import bs_str, today_ad
from apps.core.exceptions import InvalidState
from apps.core.money import q2
from apps.core.permissions import ADMINS, ALL_ROLES, MANAGERS, OWNER, OrgScopedMixin

from .models import Membership, Organization, Shift, Site
from .serializers import MemberSerializer, OrganizationSerializer, ShiftSerializer, SiteSerializer


class MyOrganizationsView(APIView):
    """GET /orgs (mine) · POST /orgs (caller becomes owner)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orgs = Organization.objects.filter(
            memberships__user=request.user, memberships__is_active=True, is_active=True
        ).select_related("district")
        data = OrganizationSerializer(orgs, many=True, context={"request": request}).data
        from apps.core.pagination import StandardPagination

        paginator = StandardPagination()
        page = paginator.paginate_queryset(list(data), request, view=self)
        return paginator.get_paginated_response(page)

    @transaction.atomic
    def post(self, request):
        s = OrganizationSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        org = s.save()
        Membership.objects.create(user=request.user, organization=org, role=OWNER)
        log(request, "organization.create", org, organization=org, changes={"after": snapshot(org)})
        return Response(OrganizationSerializer(org, context={"request": request}).data, status=201)


class CurrentOrganizationView(OrgScopedMixin, APIView):
    """GET/PATCH /org."""

    role_rules = {"get": ALL_ROLES, "patch": ADMINS}

    def get(self, request):
        ctx = {"request": request, "membership": self.membership}
        return Response(OrganizationSerializer(self.org, context=ctx).data)

    def patch(self, request):
        org = self.org
        before = snapshot(org)
        ctx = {"request": request, "membership": self.membership}
        s = OrganizationSerializer(org, data=request.data, partial=True, context=ctx)
        s.is_valid(raise_exception=True)
        s.save()
        log(request, "organization.update", org, organization=org, changes=diff(before, snapshot(org)))
        return Response(s.data)


class DashboardView(OrgScopedMixin, APIView):
    role_rules = {"get": ALL_ROLES}

    def get(self, request):
        from apps.hiring.models import Application, JobOpening
        from apps.payroll.models import PayrollRun
        from apps.workforce.models import Attendance, Employment

        org = self.org
        today = today_ad()
        employments = Employment.objects.filter(organization=org)
        if self.is_supervisor:
            employments = employments.filter(site_id__in=self.supervisor_site_ids())
        active = employments.filter(status="active", start_date__lte=today)
        active_ids = list(active.values_list("id", flat=True))
        today_counts = dict(
            Attendance.objects.filter(employment_id__in=active_ids, date=today)
            .values_list("status")
            .annotate(n=Count("id"))
        )
        present_today = today_counts.get("present", 0) + today_counts.get("half_day", 0)
        marked = sum(today_counts.values())

        start14 = today - dt.timedelta(days=13)
        rows = (
            Attendance.objects.filter(employment__in=employments, date__range=(start14, today))
            .values("date")
            .annotate(
                present=Count("id", filter=Q(status__in=["present", "half_day"])),
                absent=Count("id", filter=Q(status="absent")),
                leave=Count("id", filter=Q(status="leave")),
            )
        )
        by_date = {r["date"]: r for r in rows}
        att14 = []
        for i in range(14):
            d = start14 + dt.timedelta(days=i)
            r = by_date.get(d, {})
            att14.append(
                {
                    "date": d.isoformat(),
                    "date_bs": bs_str(d),
                    "present": r.get("present", 0),
                    "absent": r.get("absent", 0),
                    "leave": r.get("leave", 0),
                }
            )

        since = today - dt.timedelta(days=30)
        if self.is_supervisor:
            pipeline = {k: 0 for k in ("sourced", "shortlisted", "interview", "selected")}
            open_jobs, last_payroll = 0, None
        else:
            stage_counts = dict(
                Application.objects.filter(job__organization=org, job__status__in=["open", "filled"])
                .values_list("stage")
                .annotate(n=Count("id"))
            )
            pipeline = {
                k: stage_counts.get(k, 0) for k in ("sourced", "shortlisted", "interview", "selected")
            }
            open_jobs = JobOpening.objects.filter(organization=org, status="open").count()
            run = PayrollRun.objects.filter(organization=org).order_by("-bs_year", "-bs_month").first()
            last_payroll = None
            if run:
                from apps.payroll.services import run_totals

                last_payroll = {
                    "id": str(run.id),
                    "bs_year": run.bs_year,
                    "bs_month": run.bs_month,
                    "net_total": run_totals(run)["totals"]["net"],
                    "status": run.status,
                }
        wage_bill = sum((e.monthly_gross for e in active), start=q2(0))
        return Response(
            {
                "today": today.isoformat(),
                "today_bs": bs_str(today),
                "active_workers": len(active_ids),
                "present_today": present_today,
                "absent_today": today_counts.get("absent", 0),
                "on_leave_today": today_counts.get("leave", 0),
                "not_marked_today": max(len(active_ids) - marked, 0),
                "open_jobs": open_jobs,
                "pipeline": pipeline,
                "hires_30d": employments.filter(start_date__gte=since, start_date__lte=today).count(),
                "attrition_30d": employments.filter(end_date__gte=since, end_date__lte=today).count(),
                "last_payroll": last_payroll,
                "attendance_14d": att14,
                "wage_bill_month_estimate": f"{q2(0) if self.is_supervisor else q2(wage_bill):.2f}",
            }
        )


class MemberViewSet(OrgScopedMixin, AuditedViewSetMixin, viewsets.ModelViewSet):
    serializer_class = MemberSerializer
    default_roles = ADMINS
    role_rules = {"list": MANAGERS, "retrieve": MANAGERS}
    http_method_names = ["get", "post", "patch", "delete"]
    audit_prefix = "membership"

    def get_queryset(self):
        return (
            Membership.objects.filter(organization=self.org)
            .select_related("user")
            .prefetch_related("sites")
            .order_by("created_at")
        )

    def _guard_last_owner(self, instance, new_role=None, deactivate=False):
        if instance.role != OWNER:
            return
        if new_role in (None, OWNER) and not deactivate:
            return
        others = Membership.objects.filter(organization=self.org, role=OWNER, is_active=True).exclude(
            pk=instance.pk
        )
        if not others.exists():
            raise InvalidState(message="An organization must keep at least one owner.")

    def perform_update(self, serializer):
        self._guard_last_owner(
            serializer.instance,
            serializer.validated_data.get("role"),
            serializer.validated_data.get("is_active") is False,
        )
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        self._guard_last_owner(instance, deactivate=True)
        super().perform_destroy(instance)


class SiteViewSet(OrgScopedMixin, AuditedViewSetMixin, viewsets.ModelViewSet):
    serializer_class = SiteSerializer
    role_rules = {"list": ALL_ROLES, "retrieve": ALL_ROLES, "qr_png": ALL_ROLES}
    http_method_names = ["get", "post", "patch", "put", "delete"]
    filterset_fields = ["is_active"]

    def get_queryset(self):
        qs = Site.objects.filter(organization=self.org).select_related("district")
        if self.is_supervisor:
            qs = qs.filter(id__in=self.supervisor_site_ids())
        return qs

    def get_create_kwargs(self):
        return {"organization": self.org}

    @action(detail=True, methods=["get"], url_path=r"qr\.png")
    def qr_png(self, request, pk=None):
        site = self.get_object()
        img = qrcode.make(f"kaamsathi://site/{site.qr_token}", box_size=10, border=2)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        resp = HttpResponse(buf.getvalue(), content_type="image/png")
        resp["Content-Disposition"] = f'inline; filename="site-{site.id}-qr.png"'
        return resp

    @action(detail=True, methods=["post"], url_path="rotate-qr")
    def rotate_qr(self, request, pk=None):
        site = self.get_object()
        old = str(site.qr_token)
        site.qr_token = uuid.uuid4()
        site.save(update_fields=["qr_token"])
        log(
            request,
            "site.rotate_qr",
            site,
            organization=self.org,
            changes={"qr_token": {"from": old, "to": str(site.qr_token)}},
        )
        return Response(self.get_serializer(site).data)


class ShiftViewSet(OrgScopedMixin, AuditedViewSetMixin, viewsets.ModelViewSet):
    serializer_class = ShiftSerializer
    role_rules = {"list": ALL_ROLES, "retrieve": ALL_ROLES}
    http_method_names = ["get", "post", "patch", "put", "delete"]

    def get_queryset(self):
        return Shift.objects.filter(organization=self.org)

    def get_create_kwargs(self):
        return {"organization": self.org}


__all__ = [
    "MyOrganizationsView",
    "CurrentOrganizationView",
    "DashboardView",
    "MemberViewSet",
    "SiteViewSet",
    "ShiftViewSet",
    "status",
]
