from django.db.models import ProtectedError, Q
from django.http import HttpResponse
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import diff, log, snapshot
from apps.core.bs import MONTHS_EN, BSDateError
from apps.core.exceptions import APIError, InvalidState
from apps.core.idempotency import idempotent
from apps.core.permissions import ADMINS, MANAGERS, OrgScopedMixin
from apps.notifications.services import enqueue

from . import exports, services
from .models import PayGroup, PayPolicy, PayrollRun, Payslip
from .serializers import (
    MarkPaidSerializer,
    PayGroupSerializer,
    PayPolicySerializer,
    PayrollRunCreateSerializer,
    PayrollRunSerializer,
    PayslipSerializer,
)


def file_response(content, content_type, filename, inline=False):
    resp = HttpResponse(content, content_type=content_type)
    disposition = "inline" if inline else "attachment"
    resp["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    return resp


def payslip_filename(slip):
    run = slip.run
    safe = "".join(c if c.isalnum() else "-" for c in slip.worker.full_name).strip("-").lower()
    return f"payslip-{safe}-{run.bs_year}-{run.bs_month:02d}.pdf"


class PayrollRunViewSet(
    OrgScopedMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PayrollRunSerializer
    ordering_fields = ["bs_year", "bs_month", "created_at"]

    def get_queryset(self):
        return (
            PayrollRun.objects.filter(organization=self.org)
            .select_related("organization", "approved_by", "pay_group")
            .order_by("-bs_year", "-bs_month")
        )

    @idempotent
    def create(self, request, *args, **kwargs):
        s = PayrollRunCreateSerializer(data=request.data, context={"org": self.org})
        s.is_valid(raise_exception=True)
        try:
            run = services.create_run(self.org, **s.validated_data)
        except BSDateError as exc:
            raise APIError("validation_error", fields={"bs_month": [str(exc)]}) from exc
        log(
            request,
            "payroll.create",
            run,
            organization=self.org,
            changes={
                "bs_year": run.bs_year,
                "bs_month": run.bs_month,
                "include_festival_allowance": run.include_festival_allowance,
                "pay_group": str(run.pay_group_id) if run.pay_group_id else None,
            },
        )
        return Response(PayrollRunSerializer(run).data, status=201)

    @action(detail=True, methods=["get"])
    def payslips(self, request, pk=None):
        run = self.get_object()
        qs = run.payslips.select_related("worker", "employment", "run__organization").order_by(
            "worker__full_name"
        )
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(Q(worker__full_name__icontains=q) | Q(employment__designation__icontains=q))
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(PayslipSerializer(page, many=True).data)

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        run = self.get_object()
        services.compute_run(run)
        log(request, "payroll.recalculate", run, organization=self.org)
        return Response(PayrollRunSerializer(run).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        run = services.approve_run(self.get_object(), request.user)
        log(request, "payroll.approve", run, organization=self.org)
        return Response(PayrollRunSerializer(run).data)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        s = MarkPaidSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        run = services.mark_paid(
            self.get_object(), s.validated_data["paid_on"], s.validated_data.get("method")
        )
        log(request, "payroll.mark_paid", run, organization=self.org, changes=s.data)
        from apps.notifications.tasks import payslip_ready

        enqueue(payslip_ready, str(run.id))
        return Response(PayrollRunSerializer(run).data)

    @action(detail=True, methods=["get"], url_path=r"wage-sheet\.xlsx")
    def wage_sheet(self, request, pk=None):
        run = self.get_object()
        log(request, "payroll.export.wage_sheet", run, organization=self.org)
        return file_response(
            exports.wage_sheet_xlsx(run),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"wage-sheet-{run.bs_year}-{run.bs_month:02d}-{MONTHS_EN[run.bs_month].lower()}.xlsx",
        )

    @action(detail=True, methods=["get"], url_path=r"bank-transfer\.csv")
    def bank_transfer(self, request, pk=None):
        run = self.get_object()
        log(request, "payroll.export.bank_file", run, organization=self.org)
        return file_response(
            exports.bank_transfer_csv(run),
            "text/csv; charset=utf-8",
            f"bank-transfer-{run.bs_year}-{run.bs_month:02d}.csv",
        )

    @action(detail=True, methods=["get"], url_path=r"ssf\.csv")
    def ssf(self, request, pk=None):
        run = self.get_object()
        log(request, "payroll.export.ssf_file", run, organization=self.org)
        return file_response(
            exports.ssf_csv(run), "text/csv; charset=utf-8", f"ssf-{run.bs_year}-{run.bs_month:02d}.csv"
        )


class PayslipViewSet(
    OrgScopedMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    serializer_class = PayslipSerializer
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        return Payslip.objects.filter(run__organization=self.org).select_related(
            "worker", "employment", "run__organization"
        )

    def perform_update(self, serializer):
        slip = serializer.instance
        if slip.run.status != "draft":
            raise InvalidState(message="Payslips can only be edited while the payroll run is a draft.")
        before = snapshot(slip)
        slip = serializer.save()
        services.recompute_payslip(slip)
        log(self.request, "payslip.update", slip, organization=self.org, changes=diff(before, snapshot(slip)))

    @action(detail=True, methods=["get"], url_path=r"payslip\.pdf")
    def pdf(self, request, pk=None):
        slip = self.get_object()
        return file_response(
            exports.payslip_pdf(slip), "application/pdf", payslip_filename(slip), inline=True
        )


class PayGroupViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    """/org/pay-groups CRUD (R001). Read: owner/admin/hr · write: owner/admin/hr."""

    serializer_class = PayGroupSerializer
    default_roles = MANAGERS
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return PayGroup.objects.filter(organization=self.org).order_by("created_at", "id")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["member_counts"] = self._member_counts  # lazy: evaluated once, after any save
        return ctx

    def _member_counts(self) -> dict:
        from collections import Counter

        from apps.workforce.models import Employment

        emps = list(Employment.objects.filter(organization=self.org, status="active"))
        assigned = services.assign_groups(self.org, emps)
        return Counter(g.id for g in assigned.values() if g is not None)

    def perform_create(self, serializer):
        group = serializer.save(organization=self.org)
        log(
            self.request,
            "payroll.pay_group.create",
            group,
            organization=self.org,
            changes={"after": snapshot(group)},
        )

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        group = serializer.save()
        log(
            self.request,
            "payroll.pay_group.update",
            group,
            organization=self.org,
            changes=diff(before, snapshot(group)),
        )

    def perform_destroy(self, instance):
        try:
            snap = snapshot(instance)
            instance.delete()
        except ProtectedError as exc:
            raise InvalidState(
                message="This pay group already has payroll runs. Deactivate it instead."
            ) from exc
        log(
            self.request,
            "payroll.pay_group.delete",
            None,
            organization=self.org,
            object_type="paygroup",
            changes={"before": snap},
        )


class PayPolicyView(OrgScopedMixin, APIView):
    """GET /org/pay-policy (owner/admin/hr) · PATCH (owner/admin) — R003 configurable pay rules."""

    role_rules = {"get": MANAGERS, "patch": ADMINS}

    def _policy(self) -> PayPolicy:
        return PayPolicy.objects.filter(organization=self.org).first() or PayPolicy(organization=self.org)

    def get(self, request):
        return Response(PayPolicySerializer(self._policy()).data)

    def patch(self, request):
        policy = self._policy()
        before = snapshot(policy) if not policy._state.adding else {}
        s = PayPolicySerializer(policy, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        policy = s.save(organization=self.org, updated_by=request.user)
        log(
            request,
            "payroll.pay_policy.update",
            policy,
            organization=self.org,
            changes=diff(before, snapshot(policy)),
        )
        return Response(PayPolicySerializer(policy).data)
