"""External work history endpoints (docs/CONTRACT-EXTENSIONS.md §3)."""

from __future__ import annotations

from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.services import log, snapshot
from apps.core.permissions import IsOpsStaff, OrgScopedMixin
from apps.workers.me_views import current_worker

from . import services
from .models import WorkHistoryEntry
from .serializers import (
    EmployerDecisionSerializer,
    OpsVerifySerializer,
    OpsWorkHistorySerializer,
    OrgWorkHistorySerializer,
    WorkHistorySerializer,
)

OPS_PERMS = [IsAuthenticated, IsOpsStaff]
REDACT = {"reference_phone"}


def _redacted(entry) -> dict:
    data = snapshot(entry)
    for k in REDACT:
        if data.get(k):
            data[k] = "•••"
    return data


# --------------------------------------------------------------------------- worker
class MeWorkHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = WorkHistorySerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return (
            WorkHistoryEntry.objects.filter(worker=current_worker(self.request))
            .select_related("trade", "district", "employer_org")
            .order_by("-start_date", "-created_at")
        )

    def perform_create(self, serializer):
        d = serializer.validated_data
        status = services.initial_status(
            reference_phone=d.get("reference_phone"), employer_org=d.get("employer_org")
        )
        entry = serializer.save(worker=current_worker(self.request), status=status)
        log(
            self.request, "work_history.create", entry, organization=None, changes={"after": _redacted(entry)}
        )

    def perform_update(self, serializer):
        entry = serializer.instance
        services.ensure_editable(entry)
        before = _redacted(entry)
        entry = serializer.save()
        # Any edit sends the entry back for checking (a rejected entry can be corrected and resubmitted).
        entry.status = services.initial_status(
            reference_phone=entry.reference_phone, employer_org=entry.employer_org
        )
        entry.verification_method = None
        entry.verified_by = None
        entry.verified_at = None
        entry.save(
            update_fields=["status", "verification_method", "verified_by", "verified_at", "updated_at"]
        )
        log(
            self.request,
            "work_history.update",
            entry,
            organization=None,
            changes={"before": before, "after": _redacted(entry)},
        )

    def perform_destroy(self, instance):
        services.ensure_editable(instance)
        log(
            self.request,
            "work_history.delete",
            instance,
            organization=None,
            changes={"before": _redacted(instance)},
        )
        if instance.document:
            instance.document.delete(save=False)
        instance.delete()


# --------------------------------------------------------------------------- ops
class OpsWorkHistoryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = OPS_PERMS
    serializer_class = OpsWorkHistorySerializer

    def get_queryset(self):
        qs = WorkHistoryEntry.objects.select_related(
            "worker", "trade", "district", "employer_org", "verified_by"
        )
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("worker"):
            qs = qs.filter(worker_id=p["worker"])
        if p.get("q"):
            q = p["q"]
            qs = qs.filter(
                Q(worker__full_name__icontains=q)
                | Q(worker__phone__contains=q)
                | Q(employer_name__icontains=q)
                | Q(role_title__icontains=q)
            )
        # A queue: oldest waiting first.
        if p.get("status") in ("reference_pending", "self_reported"):
            return qs.order_by("created_at")
        return qs.order_by("-created_at")

    def retrieve(self, request, *args, **kwargs):
        entry = self.get_object()
        log(request, "ops.work_history.view", entry, organization=None)
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        entry = self.get_object()
        s = OpsVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        old = entry.status
        services.ops_verify(
            entry,
            status=d["status"],
            method=d.get("method"),
            note=d.get("note", "").strip(),
            user=request.user,
        )
        log(
            request,
            "ops.work_history.verify",
            entry,
            organization=None,
            changes={
                "status": {"from": old, "to": entry.status},
                "method": entry.verification_method,
                "note": entry.note,
            },
        )
        return Response(self.get_serializer(entry).data)


# --------------------------------------------------------------------------- employer
class OrgWorkHistoryViewSet(OrgScopedMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """Confirmation requests for entries naming this organization as the employer."""

    serializer_class = OrgWorkHistorySerializer

    def get_queryset(self):
        qs = WorkHistoryEntry.objects.filter(employer_org=self.org).select_related(
            "worker", "trade", "district"
        )
        if self.action != "list":  # confirm/reject look the entry up whatever its status
            return qs
        status = self.request.query_params.get("status") or "pending"
        if status == "pending":
            qs = qs.filter(status__in=WorkHistoryEntry.OPEN)
        elif status != "all":
            qs = qs.filter(status__in=status.split(","))
        return qs.order_by("created_at")

    def _decide(self, request, confirm: bool):
        entry = self.get_object()
        s = EmployerDecisionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        old = entry.status
        services.employer_decide(
            entry, confirm=confirm, note=s.validated_data["note"].strip(), user=request.user
        )
        log(
            request,
            "work_history.employer_confirm" if confirm else "work_history.employer_reject",
            entry,
            organization=self.org,
            changes={"status": {"from": old, "to": entry.status}},
        )
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        return self._decide(request, True)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._decide(request, False)
