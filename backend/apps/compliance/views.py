"""Compliance endpoints (docs/CONTRACT-ECOSYSTEM.md §5)."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import AuditedViewSetMixin, log
from apps.core.bs import BSDateError, BSMonth, today_ad
from apps.core.exceptions import APIError
from apps.core.permissions import OrgScopedMixin
from apps.payroll.models import PayrollRun
from apps.workers.me_views import current_worker
from apps.workforce.models import Employment

from . import services
from .models import Contractor, ContractorAssignment, SSFFiling
from .pdf import contract_pdf
from .serializers import (
    AssignSerializer,
    ContractorSerializer,
    ContractSerializer,
    GenerateContractSerializer,
    OrgAcceptSerializer,
    SSFFilingSerializer,
    SSFFilingUpdateSerializer,
)

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def file_response(content, content_type, filename, inline=False):
    resp = HttpResponse(content, content_type=content_type)
    resp["Content-Disposition"] = f'{"inline" if inline else "attachment"}; filename="{filename}"'
    return resp


def contract_filename(contract) -> str:
    name = contract.terms.get("worker_name") or "worker"
    safe = "".join(c if c.isalnum() else "-" for c in name).strip("-").lower()
    return f"appointment-letter-{safe}-v{contract.version}.pdf"


def contract_payload(emp) -> dict:
    versions = list(emp.contracts.select_related("generated_by").order_by("-version"))
    return {
        "employment_id": str(emp.id),
        "latest": ContractSerializer(versions[0]).data if versions else None,
        "versions": ContractSerializer(versions, many=True).data,
        "needs_new_version": bool(versions)
        and services.terms_changed(versions[0], services.contract_terms(emp)),
    }


# ---------------------------------------------------------------------------
# Contracts (employer)
# ---------------------------------------------------------------------------


class OrgEmploymentMixin(OrgScopedMixin):
    def get_employment(self, pk) -> Employment:
        return get_object_or_404(
            Employment.objects.select_related("organization__district", "worker", "site", "trade", "shift"),
            pk=pk,
            organization=self.org,
        )


class EmploymentContractView(OrgEmploymentMixin, APIView):
    def get(self, request, pk):
        return Response(contract_payload(self.get_employment(pk)))

    def post(self, request, pk):
        emp = self.get_employment(pk)
        s = GenerateContractSerializer(data=request.data or {})
        s.is_valid(raise_exception=True)
        contract, created = services.generate_contract(emp, request.user, **s.validated_data)
        if created:
            log(
                request,
                "contract.generate",
                contract,
                organization=self.org,
                changes={"version": contract.version, "employment": str(emp.id)},
            )
        return Response(contract_payload(emp), status=201 if created else 200)


class EmploymentContractPdfView(OrgEmploymentMixin, APIView):
    def get(self, request, pk):
        emp = self.get_employment(pk)
        version = request.query_params.get("version")
        qs = emp.contracts.order_by("-version")
        contract = qs.filter(version=version).first() if version and version.isdigit() else qs.first()
        if contract is None:
            raise NotFound()
        return file_response(
            contract_pdf(contract), "application/pdf", contract_filename(contract), inline=True
        )


class EmploymentContractOrgAcceptView(OrgEmploymentMixin, APIView):
    """Record acceptance given on paper/SMS (worker signed the printed letter)."""

    def post(self, request, pk):
        emp = self.get_employment(pk)
        contract = services.latest_contract(emp)
        if contract is None:
            raise NotFound()
        s = OrgAcceptSerializer(data=request.data or {})
        s.is_valid(raise_exception=True)
        services.accept_contract(contract, s.validated_data["channel"])
        log(request, "contract.accept", contract, organization=self.org, changes=s.data)
        return Response(contract_payload(emp))


# ---------------------------------------------------------------------------
# Contracts (worker)
# ---------------------------------------------------------------------------


def _my_employment(request, pk) -> Employment:
    worker = current_worker(request)
    return get_object_or_404(
        Employment.objects.select_related("organization__district", "worker", "site", "trade", "shift"),
        pk=pk,
        worker=worker,
    )


class MeContractView(APIView):
    def get(self, request, pk):
        emp = _my_employment(request, pk)
        contract = services.latest_contract(emp)
        if contract is None:
            raise NotFound()
        data = ContractSerializer(contract).data
        data["organization"] = {"id": str(emp.organization_id), "name": emp.organization.name}
        return Response(data)


class MeContractPdfView(APIView):
    def get(self, request, pk):
        contract = services.latest_contract(_my_employment(request, pk))
        if contract is None:
            raise NotFound()
        return file_response(
            contract_pdf(contract), "application/pdf", contract_filename(contract), inline=True
        )


class MeContractAcceptView(APIView):
    def post(self, request, pk):
        emp = _my_employment(request, pk)
        contract = services.latest_contract(emp)
        if contract is None:
            raise NotFound()
        services.accept_contract(contract, "app")
        log(request, "contract.accept", contract, organization=emp.organization, changes={"channel": "app"})
        return Response(ContractSerializer(contract).data)


# ---------------------------------------------------------------------------
# SSF filing
# ---------------------------------------------------------------------------


class RunSSFFilingView(OrgScopedMixin, APIView):
    def post(self, request, pk):
        run = get_object_or_404(
            PayrollRun.objects.select_related("organization"), pk=pk, organization=self.org
        )
        filing, created = services.prepare_ssf_filing(run, request.user)
        log(request, "ssf_filing.prepare", filing, organization=self.org, changes=filing.summary)
        return Response(SSFFilingSerializer(filing).data, status=201 if created else 200)


class SSFFilingViewSet(
    OrgScopedMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = SSFFilingSerializer
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        qs = SSFFiling.objects.filter(run__organization=self.org).select_related("run", "prepared_by")
        if self.request.query_params.get("status"):
            qs = qs.filter(status=self.request.query_params["status"])
        return qs.order_by("-run__bs_year", "-run__bs_month")

    def partial_update(self, request, *args, **kwargs):
        filing = self.get_object()
        s = SSFFilingUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        before = {"status": filing.status, "receipt_no": filing.receipt_no}
        services.update_filing(filing, dict(s.validated_data))
        log(
            request,
            "ssf_filing.update",
            filing,
            organization=self.org,
            changes={"before": before, "after": {"status": filing.status, "receipt_no": filing.receipt_no}},
        )
        return Response(SSFFilingSerializer(filing).data)

    @action(detail=True, methods=["get"], url_path=r"file\.xlsx")
    def file_xlsx(self, request, pk=None):
        filing = self.get_object()
        run = filing.run
        content = None
        if filing.file:
            try:
                with filing.file.open("rb") as fh:
                    content = fh.read()
            except (FileNotFoundError, OSError):
                content = None
        if content is None:
            content = services.ssf_xlsx(run)
        return file_response(content, XLSX, services.ssf_filename(run, "xlsx"))

    @action(detail=True, methods=["get"], url_path=r"file\.csv")
    def file_csv(self, request, pk=None):
        filing = self.get_object()
        return file_response(
            services.ssf_filing_csv(filing.run),
            "text/csv; charset=utf-8",
            services.ssf_filename(filing.run, "csv"),
        )


# ---------------------------------------------------------------------------
# Compliance status
# ---------------------------------------------------------------------------


class ComplianceView(OrgScopedMixin, APIView):
    def get(self, request):
        return Response(services.compliance_status(self.org))


# ---------------------------------------------------------------------------
# Contractors
# ---------------------------------------------------------------------------


class ContractorViewSet(OrgScopedMixin, AuditedViewSetMixin, viewsets.ModelViewSet):
    serializer_class = ContractorSerializer
    http_method_names = ["get", "post", "patch", "delete"]
    audit_prefix = "contractor"

    def get_queryset(self):
        qs = (
            Contractor.objects.filter(organization=self.org)
            .select_related("lead_worker")
            .prefetch_related("trades")
            .annotate(active_workers=Count("assignments", filter=Q(assignments__employment__status="active")))
        )
        p = self.request.query_params
        if p.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=p["is_active"] == "true")
        if p.get("q"):
            qs = qs.filter(Q(name__icontains=p["q"]) | Q(phone__contains=p["q"]))
        return qs.order_by("name")

    def get_create_kwargs(self):
        return {"organization": self.org}

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        contractor = self.get_object()
        s = AssignSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ids = set(s.validated_data["employment_ids"])
        emps = list(Employment.objects.filter(organization=self.org, pk__in=ids))
        if len(emps) != len(ids):
            raise APIError(
                "validation_error", fields={"employment_ids": ["Unknown employment for this organization."]}
            )
        with transaction.atomic():
            for emp in emps:
                ContractorAssignment.objects.update_or_create(
                    employment=emp, defaults={"contractor": contractor, "assigned_on": today_ad()}
                )
        log(
            request,
            "contractor.assign",
            contractor,
            organization=self.org,
            changes={"employment_ids": sorted(map(str, ids))},
        )
        return Response(ContractorSerializer(self.get_queryset().get(pk=contractor.pk)).data)

    @action(detail=True, methods=["post"])
    def unassign(self, request, pk=None):
        contractor = self.get_object()
        s = AssignSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ids = s.validated_data["employment_ids"]
        ContractorAssignment.objects.filter(contractor=contractor, employment_id__in=ids).delete()
        log(
            request,
            "contractor.unassign",
            contractor,
            organization=self.org,
            changes={"employment_ids": [str(i) for i in ids]},
        )
        return Response(ContractorSerializer(self.get_queryset().get(pk=contractor.pk)).data)

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        contractor = self.get_object()
        p = request.query_params
        try:
            month = (
                BSMonth(int(p["bs_year"]), int(p["bs_month"]))
                if p.get("bs_year") and p.get("bs_month")
                else BSMonth.of(today_ad())
            )
            _ = month.days
        except (ValueError, BSDateError) as exc:
            raise APIError("validation_error", fields={"bs_month": ["Invalid BS year/month."]}) from exc
        return Response(services.contractor_summary(contractor, month))
