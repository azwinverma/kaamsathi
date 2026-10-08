"""Employer billing (``/org/billing/*``, owner/admin) and the ops billing console (``/ops/billing/*``).

Every invoice / payment / credit-note / plan / subscription action by ops is audited.
"""

from __future__ import annotations

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import diff, log, snapshot
from apps.core.exceptions import APIError
from apps.core.pagination import StandardPagination
from apps.core.permissions import ADMINS, IsOpsStaff, OrgScopedMixin

from . import services
from .models import Charge, Invoice, Plan
from .pdf import invoice_pdf
from .serializers import (
    ChargeInput,
    ChargeSerializer,
    CreditNoteInput,
    GenerateInput,
    PaymentInput,
    PlanInput,
    SubscriptionInput,
    VoidInput,
    credit_note_dict,
    invoice_dict,
    payment_dict,
    plan_dict,
    subscription_dict,
)

OPS_PERMS = [IsAuthenticated, IsOpsStaff]
ORG_VISIBLE = ("issued", "paid", "void")


def paginate(view, request, items, fn):
    paginator = StandardPagination()
    page = paginator.paginate_queryset(items, request, view=view)
    return paginator.get_paginated_response([fn(x) for x in page])


def pdf_response(invoice: Invoice) -> HttpResponse:
    if invoice.status != "draft" and invoice.pdf:
        try:
            with invoice.pdf.open("rb") as fh:
                content = fh.read()
        except Exception:  # noqa: BLE001 - storage hiccup → render fresh
            content = invoice_pdf(invoice)
    else:
        content = invoice_pdf(invoice)
    name = (invoice.number or f"draft-{str(invoice.id)[:8]}").replace("/", "-")
    resp = HttpResponse(content, content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="invoice-{name}.pdf"'
    return resp


# =============================================================================== org
class BillingSummaryView(OrgScopedMixin, APIView):
    default_roles = ADMINS

    @extend_schema(responses=dict)
    def get(self, request):
        org = self.org
        plan = services.plan_for(org)
        return Response(
            {
                "plan": plan.code,
                "plan_name": plan.name,
                "active_workers": services.active_worker_count(org),
                "monthly_estimate": f"{services.monthly_estimate(org):.2f}",
                "unpaid_total": f"{services.unpaid_total(org):.2f}",
                "outstanding_invoices": Invoice.objects.filter(organization=org, status="issued").count(),
            }
        )


class ChargeViewSet(OrgScopedMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = ChargeSerializer
    queryset = Charge.objects.none()  # schema generation; real rows come from get_queryset
    default_roles = ADMINS
    filterset_fields = ["kind", "status"]

    def get_queryset(self):
        return Charge.objects.filter(organization=self.org).order_by("-created_at")


class OrgSubscriptionView(OrgScopedMixin, APIView):
    default_roles = ADMINS

    @extend_schema(responses=dict)
    def get(self, request):
        return Response(subscription_dict(self.org))


class OrgInvoiceListView(OrgScopedMixin, APIView):
    default_roles = ADMINS

    @extend_schema(responses=dict, operation_id="org_billing_invoices_list")
    def get(self, request):
        qs = Invoice.objects.filter(organization=self.org, status__in=ORG_VISIBLE)
        status = request.query_params.get("status")
        if status in ORG_VISIBLE:
            qs = qs.filter(status=status)
        return paginate(self, request, qs.order_by("-issue_date", "-created_at"), invoice_dict)


class OrgInvoiceMixin(OrgScopedMixin):
    default_roles = ADMINS

    def get_invoice(self, pk) -> Invoice:
        return get_object_or_404(Invoice, pk=pk, organization=self.org, status__in=ORG_VISIBLE)


class OrgInvoiceDetailView(OrgInvoiceMixin, APIView):
    @extend_schema(responses=dict)
    def get(self, request, pk):
        return Response(invoice_dict(self.get_invoice(pk), detail=True))


class OrgInvoicePdfView(OrgInvoiceMixin, APIView):
    @extend_schema(responses={(200, "application/pdf"): bytes})
    def get(self, request, pk):
        invoice = self.get_invoice(pk)
        log(request, "billing.invoice.download", invoice, organization=self.org)
        return pdf_response(invoice)


# =============================================================================== ops
class OpsPlansView(APIView):
    permission_classes = OPS_PERMS

    @extend_schema(responses=dict)
    def get(self, request):
        return Response([plan_dict(p) for p in Plan.objects.all()])

    @extend_schema(request=PlanInput, responses=dict)
    def post(self, request):
        s = PlanInput(data=request.data)
        s.is_valid(raise_exception=True)
        if Plan.objects.filter(code=s.validated_data["code"]).exists():
            raise APIError("duplicate", fields={"code": ["A plan with this code exists."]})
        plan = Plan.objects.create(**s.validated_data)
        log(request, "billing.plan.create", plan, organization=None, changes=snapshot(plan))
        return Response(plan_dict(plan), status=201)


class OpsPlanDetailView(APIView):
    permission_classes = OPS_PERMS

    @extend_schema(request=PlanInput, responses=dict)
    def patch(self, request, code):
        plan = get_object_or_404(Plan, code=code)
        s = PlanInput(plan, data={**request.data, "code": code}, partial=True)
        s.is_valid(raise_exception=True)
        before = snapshot(plan)
        for key, value in s.validated_data.items():
            if key != "code" and key in request.data:
                setattr(plan, key, value)
        plan.save()
        log(request, "billing.plan.update", plan, organization=None, changes=diff(before, snapshot(plan)))
        return Response(plan_dict(plan))


class OpsSubscriptionView(APIView):
    permission_classes = OPS_PERMS

    @extend_schema(responses=dict)
    def get(self, request, org_id):
        from apps.orgs.models import Organization

        return Response(subscription_dict(get_object_or_404(Organization, pk=org_id)))

    @extend_schema(request=SubscriptionInput, responses=dict)
    def patch(self, request, org_id):
        from apps.orgs.models import Organization

        org = get_object_or_404(Organization, pk=org_id)
        s = SubscriptionInput(data=request.data)
        s.is_valid(raise_exception=True)
        plan = Plan.objects.filter(code=s.validated_data["plan"]).first()
        if plan is None:
            raise APIError("validation_error", fields={"plan": ["Unknown plan."]})
        if not plan.is_active:
            raise APIError("validation_error", fields={"plan": ["This plan is not active."]})
        before = services.subscription_for(org)
        sub = services.set_plan(org, plan, status=s.validated_data["status"])
        log(
            request,
            "billing.subscription.update",
            sub,
            organization=org,
            changes={
                "plan": {"from": before.plan.code if before else None, "to": plan.code},
                "status": {"from": before.status if before else None, "to": sub.status},
            },
        )
        return Response(subscription_dict(org))


class OpsChargesView(APIView):
    """Ops-raised charges: verification fees (employer) and partner/training revenue (partner)."""

    permission_classes = OPS_PERMS

    @extend_schema(responses=dict)
    def get(self, request):
        qs = Charge.objects.select_related("organization", "payer_partner").order_by("-created_at")
        params = request.query_params
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("kind"):
            qs = qs.filter(kind=params["kind"])
        if params.get("payer") == "partner":
            qs = qs.filter(payer_partner__isnull=False)
        elif params.get("payer") == "organization":
            qs = qs.filter(organization__isnull=False)

        def row(c):
            data = ChargeSerializer(c).data
            data["payer_type"] = "organization" if c.organization_id else "partner"
            data["payer_name"] = str(c.payer)
            return data

        return paginate(self, request, qs, row)

    @extend_schema(request=ChargeInput, responses=dict)
    def post(self, request):
        from apps.orgs.models import Organization
        from apps.partners.models import Partner

        s = ChargeInput(data=request.data)
        s.is_valid(raise_exception=True)
        v = s.validated_data
        extra = {"bs_year": v.get("bs_year"), "bs_month": v.get("bs_month")}
        if v.get("organization_id"):
            org = get_object_or_404(Organization, pk=v["organization_id"])
            charge = services.create_org_charge(org, v["kind"], v["amount"], v["description"], **extra)
        else:
            partner = get_object_or_404(Partner, pk=v["partner_id"])
            charge = services.create_partner_charge(
                partner, v["kind"], v["amount"], v["description"], **extra
            )
        log(
            request,
            "billing.charge.create",
            charge,
            organization=charge.organization,
            changes=snapshot(charge),
        )
        data = ChargeSerializer(charge).data
        data["payer_type"] = "organization" if charge.organization_id else "partner"
        data["payer_name"] = str(charge.payer)
        return Response(data, status=201)


class OpsInvoiceListView(APIView):
    permission_classes = OPS_PERMS

    @extend_schema(responses=dict, operation_id="ops_billing_invoices_list")
    def get(self, request):
        qs = Invoice.objects.select_related("organization", "partner").order_by("-created_at")
        params = request.query_params
        if params.get("status"):
            qs = qs.filter(status__in=params["status"].split(","))
        if params.get("organization"):
            qs = qs.filter(organization_id=params["organization"])
        if params.get("partner"):
            qs = qs.filter(partner_id=params["partner"])
        if params.get("fiscal_year"):
            qs = qs.filter(fiscal_year=params["fiscal_year"])
        return paginate(self, request, qs, lambda inv: invoice_dict(inv, ops=True))


class OpsInvoiceGenerateView(APIView):
    permission_classes = OPS_PERMS

    @extend_schema(request=GenerateInput, responses=dict)
    def post(self, request):
        s = GenerateInput(data=request.data)
        s.is_valid(raise_exception=True)
        invoices = services.generate_invoices(s.validated_data["bs_year"], s.validated_data["bs_month"])
        for inv in invoices:
            log(
                request,
                "billing.invoice.generate",
                inv,
                organization=inv.organization,
                changes={"total": str(inv.total)},
            )
        return Response({"count": len(invoices), "invoices": [invoice_dict(i) for i in invoices]}, status=201)


class OpsInvoiceMixin:
    permission_classes = OPS_PERMS

    def get_invoice(self, pk) -> Invoice:
        return get_object_or_404(Invoice, pk=pk)


class OpsInvoiceDetailView(OpsInvoiceMixin, APIView):
    @extend_schema(responses=dict)
    def get(self, request, pk):
        return Response(invoice_dict(self.get_invoice(pk), detail=True, ops=True))


class OpsInvoicePdfView(OpsInvoiceMixin, APIView):
    @extend_schema(responses={(200, "application/pdf"): bytes})
    def get(self, request, pk):
        return pdf_response(self.get_invoice(pk))


class OpsInvoiceIssueView(OpsInvoiceMixin, APIView):
    @extend_schema(request=None, responses=dict)
    def post(self, request, pk):
        invoice = services.issue_invoice(self.get_invoice(pk), request.user)
        log(
            request,
            "billing.invoice.issue",
            invoice,
            organization=invoice.organization,
            changes={"number": invoice.number, "total": str(invoice.total)},
        )
        return Response(invoice_dict(invoice, detail=True, ops=True))


class OpsInvoiceVoidView(OpsInvoiceMixin, APIView):
    @extend_schema(request=VoidInput, responses=dict)
    def post(self, request, pk):
        s = VoidInput(data=request.data)
        s.is_valid(raise_exception=True)
        invoice = services.void_invoice(self.get_invoice(pk), s.validated_data["reason"])
        log(
            request,
            "billing.invoice.void",
            invoice,
            organization=invoice.organization,
            changes={"reason": invoice.void_reason},
        )
        return Response(invoice_dict(invoice, detail=True, ops=True))


class OpsInvoicePaymentsView(OpsInvoiceMixin, APIView):
    @extend_schema(responses=dict)
    def get(self, request, pk):
        return Response(
            [payment_dict(p) for p in self.get_invoice(pk).payments.select_related("recorded_by")]
        )

    @extend_schema(request=PaymentInput, responses=dict)
    def post(self, request, pk):
        s = PaymentInput(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            payment = services.record_payment(self.get_invoice(pk), user=request.user, **s.validated_data)
            invoice = Invoice.objects.get(pk=pk)
            log(
                request,
                "billing.payment.record",
                payment,
                organization=invoice.organization,
                changes=snapshot(payment),
            )
        return Response(
            {"payment": payment_dict(payment), "invoice": invoice_dict(invoice, detail=True, ops=True)},
            status=201,
        )


class OpsInvoiceCreditNotesView(OpsInvoiceMixin, APIView):
    @extend_schema(request=CreditNoteInput, responses=dict)
    def post(self, request, pk):
        s = CreditNoteInput(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            note = services.create_credit_note(self.get_invoice(pk), user=request.user, **s.validated_data)
            invoice = Invoice.objects.get(pk=pk)
            log(
                request,
                "billing.credit_note.create",
                note,
                organization=invoice.organization,
                changes=snapshot(note),
            )
        return Response(
            {"credit_note": credit_note_dict(note), "invoice": invoice_dict(invoice, detail=True, ops=True)},
            status=201,
        )
