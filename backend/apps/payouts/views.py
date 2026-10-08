"""Payout endpoints (docs/CONTRACT-ECOSYSTEM.md §6)."""

from __future__ import annotations

from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.exceptions import APIError
from apps.core.idempotency import idempotent
from apps.core.permissions import OrgScopedMixin
from apps.payroll.models import PayrollRun

from . import services
from .models import PayoutBatch
from .providers import PROVIDERS, BankFileProvider
from .serializers import CreateBatchSerializer, MarkItemSerializer, PayoutBatchSerializer

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def file_response(content, content_type, filename):
    resp = HttpResponse(content, content_type=content_type)
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


class RunPayoutsView(OrgScopedMixin, APIView):
    """POST /org/payroll-runs/{id}/payouts {provider} · GET → eligibility per provider."""

    def get_run(self, pk):
        return get_object_or_404(PayrollRun, pk=pk, organization=self.org)

    def get(self, request, pk):
        run = self.get_run(pk)
        out = []
        for code, provider in PROVIDERS.items():
            result = services.eligibility(run, code)
            out.append(
                {
                    "provider": code,
                    "label": provider.label,
                    "enabled": provider.is_enabled(),
                    "eligible": len(result["eligible"]),
                    "amount": f"{sum((s.net_pay for s in result['eligible']), start=0):.2f}",
                    "excluded": result["excluded"],
                }
            )
        return Response({"run_id": str(run.id), "run_status": run.status, "providers": out})

    @idempotent
    def post(self, request, pk):
        run = self.get_run(pk)
        s = CreateBatchSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        batch = services.create_batch(run, s.validated_data["provider"], request.user)
        log(
            request,
            "payout.create",
            batch,
            organization=self.org,
            changes={"provider": batch.provider, **batch.totals},
        )
        return Response(PayoutBatchSerializer(batch, context={"with_items": True}).data, status=201)


class PayoutBatchViewSet(
    OrgScopedMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = PayoutBatchSerializer

    def get_queryset(self):
        qs = PayoutBatch.objects.filter(run__organization=self.org).select_related("run", "created_by")
        p = self.request.query_params
        if p.get("run"):
            qs = qs.filter(run_id=p["run"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        return qs.order_by("-created_at")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["with_items"] = self.action != "list"
        return ctx

    def _out(self, batch):
        return Response(PayoutBatchSerializer(batch, context={"with_items": True}).data)

    @action(detail=True, methods=["post"])
    @idempotent
    def submit(self, request, pk=None):
        batch = services.submit_batch(self.get_object())
        log(request, "payout.submit", batch, organization=self.org)
        return self._out(batch)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        batch = services.cancel_batch(self.get_object())
        log(request, "payout.cancel", batch, organization=self.org)
        return self._out(batch)

    @action(detail=True, methods=["post"], url_path=r"items/(?P<item_id>[0-9a-fA-F-]{36})/mark")
    def mark(self, request, pk=None, item_id=None):
        batch = self.get_object()
        item = get_object_or_404(batch.items.select_related("payslip", "batch__run"), pk=item_id)
        s = MarkItemSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.mark_item(item, **s.validated_data)
        log(
            request,
            "payout.mark_item",
            batch,
            organization=self.org,
            changes={"item": str(item.id), **s.data},
        )
        batch.refresh_from_db()
        return self._out(batch)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def reconcile(self, request, pk=None):
        batch = self.get_object()
        upload = request.FILES.get("file")
        if not upload:
            raise APIError("validation_error", fields={"file": ["This field is required."]})
        from apps.core.uploads import validate_upload

        upload = validate_upload(upload, kinds={"csv"}, max_mb=5)
        result = services.reconcile(batch, upload)
        log(request, "payout.reconcile", batch, organization=self.org, changes=result)
        batch.refresh_from_db()
        data = PayoutBatchSerializer(batch, context={"with_items": True}).data
        data["reconcile"] = result
        return Response(data)

    def _bank_file(self):
        batch = self.get_object()
        if batch.provider != "bank_file":
            raise Http404
        run = batch.run
        return (
            batch,
            BankFileProvider(),
            f"bank-transfer-{run.bs_year}-{run.bs_month:02d}-{str(batch.id)[:8]}",
        )

    @action(detail=True, methods=["get"], url_path=r"file\.csv")
    def file_csv(self, request, pk=None):
        batch, provider, stem = self._bank_file()
        log(request, "payout.export.bank_file", batch, organization=self.org, changes={"format": "csv"})
        return file_response(provider.csv_bytes(batch), "text/csv; charset=utf-8", f"{stem}.csv")

    @action(detail=True, methods=["get"], url_path=r"file\.xlsx")
    def file_xlsx(self, request, pk=None):
        batch, provider, stem = self._bank_file()
        log(request, "payout.export.bank_file", batch, organization=self.org, changes={"format": "xlsx"})
        return file_response(provider.xlsx_bytes(batch), XLSX, f"{stem}.xlsx")


class PayoutWebhookView(APIView):
    """POST /webhooks/payouts/{provider} — no auth; HMAC-SHA256 in X-Signature (of ``ts.body`` when
    X-Timestamp is sent, else the raw body); exact replays → 409 ``webhook_replayed``."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = None

    def post(self, request, provider):
        prov = PROVIDERS.get(provider)
        if prov is None or provider == "bank_file":
            raise Http404
        _ = request.body  # read the raw body before DRF parses it
        try:
            updates = prov.parse_webhook(request)
            applied = services.apply_updates(PayoutBatch.objects.filter(provider=provider), updates)
        except Exception:
            replay_key = getattr(request, "_ks_webhook_replay_key", None)
            if replay_key:  # processing failed: let the provider's retry through
                from django.core.cache import cache

                cache.delete(replay_key)
            raise
        log(
            None,
            "payout.webhook",
            None,
            object_type="payoutbatch",
            changes={"provider": provider, "applied": applied},
        )
        return Response({"received": len(updates), "applied": applied})
