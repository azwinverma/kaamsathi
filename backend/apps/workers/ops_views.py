"""KaamSathi ops console (/ops/*), restricted to user.is_staff."""

from __future__ import annotations

import datetime as dt

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import diff, log, snapshot
from apps.core.bs import today_ad
from apps.core.crypto import blind_index
from apps.core.exceptions import APIError, InvalidState
from apps.core.idempotency import idempotent
from apps.core.permissions import IsOpsStaff
from apps.hiring.models import JobOpening
from apps.hiring.serializers import OpsJobSerializer, annotate_counts
from apps.hiring.services import job_matches, shortlist_workers
from apps.orgs.models import Organization
from apps.orgs.serializers import OrganizationSerializer

from .models import Worker
from .serializers import WorkerDetailSerializer, card_queryset

OPS_PERMS = [IsAuthenticated, IsOpsStaff]


class OpsDashboardView(APIView):
    permission_classes = OPS_PERMS

    def get(self, request):
        from apps.workforce.models import Employment

        since = today_ad() - dt.timedelta(days=30)
        shortlist = (
            JobOpening.objects.filter(first_shortlist_at__isnull=False, published_at__isnull=False)
            .annotate(
                delta=ExpressionWrapper(
                    F("first_shortlist_at") - F("published_at"), output_field=DurationField()
                )
            )
            .aggregate(avg=Avg("delta"))["avg"]
        )
        return Response(
            {
                "organizations": Organization.objects.filter(is_active=True).count(),
                "workers": Worker.objects.count(),
                "verified_workers": Worker.objects.filter(verification_status="verified").count(),
                "pending_verification": Worker.objects.filter(verification_status="pending").count(),
                "open_jobs": JobOpening.objects.filter(status="open").count(),
                "avg_hours_to_shortlist": round(shortlist.total_seconds() / 3600, 1) if shortlist else None,
                "hires_30d": Employment.objects.filter(
                    start_date__gte=since, start_date__lte=today_ad()
                ).count(),
            }
        )


class VerifySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["verified", "rejected"])
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class OpsWorkerViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = OPS_PERMS
    serializer_class = WorkerDetailSerializer
    http_method_names = ["get", "post", "patch"]
    ordering_fields = ["full_name", "created_at", "updated_at"]

    def get_queryset(self):
        qs = card_queryset(Worker.objects.all()).select_related("verified_by")
        p = self.request.query_params
        if p.get("q"):
            q = p["q"]
            qs = qs.filter(
                Q(full_name__icontains=q)
                | Q(full_name_ne__icontains=q)
                | Q(phone__contains=q)
                # Identifiers are encrypted: exact match through the blind index only.
                | Q(citizenship_no_hash=blind_index(q, "citizenship"))
                | Q(nid_no_hash=blind_index(q, "nid"))
            )
        if p.get("trade"):
            qs = qs.filter(skills__trade_id=p["trade"])
        if p.get("trade_q"):  # free-text trade search incl. aliases (F004)
            from .services import matching_trade_codes

            qs = qs.filter(skills__trade_id__in=matching_trade_codes(p["trade_q"]))
        if p.get("language"):
            qs = qs.filter(languages__language__in=p["language"].split(","))
        if p.get("district"):
            qs = qs.filter(Q(current_district_id=p["district"]) | Q(permanent_district_id=p["district"]))
        if p.get("verification_status"):
            qs = qs.filter(verification_status__in=p["verification_status"].split(","))
        if p.get("is_available") in ("true", "false", "1", "0"):
            qs = qs.filter(is_available=p["is_available"] in ("true", "1"))
        return qs.distinct().order_by("full_name")

    def retrieve(self, request, *args, **kwargs):
        worker = self.get_object()
        from apps.trust.services import log_profile_view

        log_profile_view(worker, context="ops", viewer=request.user, object_id=worker.id)
        data = self.get_serializer(worker).data
        from apps.risk.services import open_flag_count

        data["open_risk_flags"] = open_flag_count(worker)
        return Response(data)

    def perform_create(self, serializer):
        worker = serializer.save()
        log(self.request, "ops.worker.create", worker, organization=None, changes={"after": snapshot(worker)})

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        worker = serializer.save()
        log(
            self.request,
            "ops.worker.update",
            worker,
            organization=None,
            changes=diff(before, snapshot(worker)),
        )

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):  # docs/ops/kyc-identity-verification.md
        worker = self.get_object()
        s = VerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if s.validated_data["status"] == "verified":
            _check_verifiable(worker)
        old = worker.verification_status
        # Four-eyes (flag ``kyc_four_eyes``): a first "verified" leaves the worker pending.
        worker.verification_status = _kyc_decision(worker, request.user, s.validated_data)
        worker.verification_note = s.validated_data.get("note") or None
        worker.verified_by = request.user
        worker.verified_at = timezone.now()
        worker.save(
            update_fields=[
                "verification_status",
                "verification_note",
                "verified_by",
                "verified_at",
                "updated_at",
            ]
        )
        log(
            request,
            "ops.worker.verify",
            worker,
            organization=None,
            changes={
                "verification_status": {"from": old, "to": worker.verification_status},
                "note": worker.verification_note,
            },
        )
        data = self.get_serializer(worker).data
        data["kyc_review"] = _kyc_review_state(worker)
        return Response(data)


class OpsJobViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = OPS_PERMS
    serializer_class = OpsJobSerializer

    def get_queryset(self):
        qs = annotate_counts(
            JobOpening.objects.select_related("organization__district", "trade", "site__district", "shift")
        )
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("trade"):
            qs = qs.filter(trade_id=p["trade"])
        if p.get("organization"):
            qs = qs.filter(organization_id=p["organization"])
        if p.get("q"):
            from .services import matching_trade_codes

            qs = qs.filter(
                Q(title__icontains=p["q"])
                | Q(organization__name__icontains=p["q"])
                | Q(trade_id__in=matching_trade_codes(p["q"]))
            )
        owner = p.get("owner")
        if owner == "me":
            qs = qs.filter(ops_owner=self.request.user)
        elif owner == "none":
            qs = qs.filter(ops_owner__isnull=True)
        elif owner:
            qs = qs.filter(ops_owner_id=owner)
        return qs.order_by("published_at", "created_at")

    @action(detail=True, methods=["get"])
    def matches(self, request, pk=None):
        job = self.get_object()
        try:
            limit = min(max(int(request.query_params.get("limit", 20)), 1), 100)
        except ValueError as exc:
            raise APIError("validation_error", fields={"limit": ["Must be an integer."]}) from exc
        # matching v2 (docs/CONTRACT-EXTENSIONS.md §3): rows carry ``explain`` and ``interested``
        return Response(job_matches(job, limit, request))

    @action(detail=True, methods=["post"])
    @idempotent
    def shortlist(self, request, pk=None):
        job = self.get_object()
        from apps.orgs.kyb import MESSAGES as KYB_MESSAGES
        from apps.orgs.kyb import is_verified, kyb_required_for_shortlist

        if kyb_required_for_shortlist() and not is_verified(job.organization):
            raise InvalidState(message=str(KYB_MESSAGES["not_verified_shortlist"]))
        ids = request.data.get("worker_ids") if isinstance(request.data, dict) else None
        if not isinstance(ids, list) or not ids:
            raise APIError(
                "validation_error", fields={"worker_ids": ["Provide a non-empty list of worker ids."]}
            )
        try:
            workers = list(Worker.objects.filter(id__in=ids))
        except Exception as exc:  # noqa: BLE001 - invalid uuid
            raise APIError("validation_error", fields={"worker_ids": ["Invalid worker id."]}) from exc
        if len(workers) != len(set(map(str, ids))):
            raise APIError("validation_error", fields={"worker_ids": ["One or more workers not found."]})
        created = shortlist_workers(job, workers, request.user)
        log(
            request,
            "ops.job.shortlist",
            job,
            organization=job.organization,
            changes={"worker_ids": [str(w.id) for w in workers], "created": len(created)},
        )
        from apps.hiring.serializers import ApplicationSerializer

        return Response(
            {
                "created": len(created),
                "applications": ApplicationSerializer(created, many=True, context={"request": request}).data,
            },
            status=201 if created else 200,
        )


class OpsOrganizationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = OPS_PERMS
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        qs = Organization.objects.select_related("district").annotate(
            active_workers=Count("employments", filter=Q(employments__status="active"), distinct=True),
            open_jobs=Count("jobs", filter=Q(jobs__status="open"), distinct=True),
            members_count=Count("memberships", filter=Q(memberships__is_active=True), distinct=True),
        )
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(pan_hash=blind_index(q, "pan")))
        return qs.order_by("name")

    def _with_stats(self, org, data):
        data["active_workers"] = org.active_workers
        data["open_jobs"] = org.open_jobs
        data["members_count"] = org.members_count
        return data

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        return self.get_paginated_response(
            [self._with_stats(o, OrganizationSerializer(o, context={"request": request}).data) for o in page]
        )

    def retrieve(self, request, *args, **kwargs):
        org = self.get_object()
        data = self._with_stats(org, OrganizationSerializer(org, context={"request": request}).data)
        from apps.billing.services import unpaid_total

        data["unpaid_total"] = f"{unpaid_total(org):.2f}"
        from apps.trust.services import employer_reputation

        data["employer_reputation"] = employer_reputation(org)
        data["members"] = [
            {
                "id": str(m.id),
                "role": m.role,
                "user": {"id": str(m.user_id), "phone": m.user.phone, "full_name": m.user.full_name},
            }
            for m in org.memberships.filter(is_active=True).select_related("user")
        ]
        return Response(data)


def _kyc_decision(worker, user, validated) -> str:
    """Status after an ops KYC decision (apps.risk four-eyes); the decision itself when risk is absent."""
    try:
        from apps.risk.services import record_kyc_decision
    except ImportError:  # pragma: no cover - risk app always installed
        return validated["status"]
    return record_kyc_decision(worker, user, validated["status"], validated.get("note") or None)


def _kyc_review_state(worker):
    try:
        from apps.risk.services import kyc_review_state
    except ImportError:  # pragma: no cover
        return None
    return kyc_review_state(worker)


def _check_verifiable(worker) -> None:
    """KYC minimum before "verified": an ID number, the ID image, and no open duplicate-identity flag."""
    missing = {}
    if not (worker.citizenship_no or worker.nid_no):
        missing["citizenship_no"] = ["Record the citizenship or national ID number before verifying."]
    if not worker.id_front:
        missing["id_front"] = ["Upload the front of the ID document before verifying."]
    if missing:
        raise APIError("validation_error", fields=missing)
    try:
        from apps.risk.models import FraudFlag
    except ImportError:  # pragma: no cover - risk app always installed
        return
    if FraudFlag.objects.filter(
        subject_type="worker", subject_id=str(worker.pk), kind="duplicate_identity", status="open"
    ).exists():
        raise InvalidState(message="Resolve the open duplicate-identity flag before verifying this worker.")
