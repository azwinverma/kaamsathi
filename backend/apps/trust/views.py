"""Trust endpoints: /me/trust, /me/profile-views, worker→employer rating, disputes (worker/org/ops)."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.bs import today_ad
from apps.core.exceptions import Duplicate, InvalidState
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsOpsStaff, OrgScopedMixin
from apps.workers.me_views import current_worker

from . import disputes as dispute_services
from . import labels
from .models import Dispute, ProfileView
from .serializers import (
    AppealDecisionSerializer,
    AppealSerializer,
    DisputeCreateSerializer,
    DisputeSerializer,
    EvidenceUploadSerializer,
    ProfileViewSerializer,
    ResolveSerializer,
    RespondSerializer,
    WorkerRateSerializer,
    evidence_payload,
)
from .services import get_trust, trust_payload

RATE_AFTER_DAYS = 30


def dispute_queryset():
    from django.db.models import Count

    return (
        Dispute.objects.select_related(
            "worker",
            "organization",
            "employment",
            "payslip__run",
            "resolved_by",
            "appeal_resolved_by",
            "booking",
        )
        .annotate(evidence_count=Count("evidence"))
        .order_by("-raised_at")
    )


class EvidenceMixin:
    """``GET|POST …/disputes/{id}/evidence`` (multipart ``file`` + ``note``) — N006."""

    evidence_party: str = "worker"

    @action(detail=True, methods=["get", "post"])
    def evidence(self, request, pk=None):
        dispute = self.get_object()
        if request.method == "GET":
            rows = dispute.evidence.select_related("uploaded_by")
            return Response([evidence_payload(e, request) for e in rows])
        s = EvidenceUploadSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ev = dispute_services.add_evidence(
            dispute,
            s.validated_data["file"],
            user=request.user,
            party=self.evidence_party,
            note=s.validated_data.get("note"),
        )
        log(
            request,
            "dispute.evidence.add",
            dispute,
            organization=dispute.organization,
            changes={"evidence_id": str(ev.id), "party": ev.party, "file_type": ev.file_type},
        )
        return Response(evidence_payload(ev, request), status=201)


class AppealMixin:
    """``POST …/disputes/{id}/appeal {reason}`` — once, within 14 days of the decision (N008)."""

    appeal_party: str = "worker"

    @action(detail=True, methods=["post"])
    def appeal(self, request, pk=None):
        dispute = self.get_object()
        s = AppealSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        dispute = dispute_services.appeal(
            dispute, user=request.user, party=self.appeal_party, reason=s.validated_data["reason"]
        )
        log(
            request,
            "dispute.appeal",
            dispute,
            organization=dispute.organization,
            changes={"party": self.appeal_party, "reason": dispute.appeal_reason},
        )
        return Response(DisputeSerializer(dispute_queryset().get(pk=dispute.pk)).data)


def _filter_status(qs, request):
    status = request.query_params.get("status")
    if status:
        qs = qs.filter(status__in=status.split(","))
    return qs


# --------------------------------------------------------------------------- worker (/me)
class MeTrustView(APIView):
    def get(self, request):
        worker = current_worker(request)
        return Response(trust_payload(worker, get_trust(worker)))


class MeProfileViewsView(APIView):
    def get(self, request):
        worker = current_worker(request)
        qs = ProfileView.objects.filter(worker=worker).select_related("organization", "partner")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(ProfileViewSerializer(page, many=True).data)


class MeRateEmployerView(APIView):
    """POST /me/employments/{id}/rate — the worker rates the employer (pay on time, conditions)."""

    def post(self, request, employment_id):
        from apps.workers.models import Rating
        from apps.workforce.models import Employment

        worker = current_worker(request)
        emp = (
            Employment.objects.select_related("organization").filter(pk=employment_id, worker=worker).first()
        )
        if emp is None:
            raise NotFound()
        s = WorkerRateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        worked = (today_ad() - emp.start_date).days
        if emp.status != "ended" and worked < RATE_AFTER_DAYS:
            raise InvalidState(message=str(labels.MESSAGES["rate_too_early"]))
        try:
            with transaction.atomic():
                rating = Rating.objects.create(
                    employment=emp,
                    rater="worker",
                    score_a=s.validated_data["score_a"],
                    score_b=s.validated_data["score_b"],
                    comment=s.validated_data.get("comment") or None,
                )
        except IntegrityError as exc:
            raise Duplicate(message=str(labels.MESSAGES["already_rated"])) from exc
        log(request, "employment.worker_rate", emp, organization=emp.organization, changes=s.data)
        return Response(
            {
                "id": str(rating.id),
                "rater": "worker",
                "score_a": rating.score_a,
                "score_b": rating.score_b,
                "comment": rating.comment,
                "created_at": timezone.localtime(rating.created_at).isoformat(),
            },
            status=201,
        )


class MeDisputeViewSet(
    EvidenceMixin,
    AppealMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = DisputeSerializer

    def get_queryset(self):
        return _filter_status(dispute_queryset().filter(worker=current_worker(self.request)), self.request)

    def create(self, request, *args, **kwargs):
        worker = current_worker(request)
        s = DisputeCreateSerializer(data=request.data, context={"worker": worker})
        s.is_valid(raise_exception=True)
        d = s.validated_data
        dispute = Dispute.objects.create(
            worker=worker,
            organization=d["organization"],
            employment=d["employment"],
            payslip=d["payslip"],
            attendance_date=d.get("attendance_date"),
            kind=d["kind"],
            description=d["description"],
        )
        log(
            request,
            "dispute.raise",
            dispute,
            organization=dispute.organization,
            changes={"kind": dispute.kind},
        )
        _notify_org(dispute)
        return Response(DisputeSerializer(dispute_queryset().get(pk=dispute.pk)).data, status=201)


def _notify_org(dispute: Dispute):
    """SMS the org's owner/HR that a worker raised a dispute (no personal details in the SMS)."""
    if dispute.organization_id is None:
        return
    from apps.notifications.services import send_sms
    from apps.orgs.models import Membership

    phones = (
        Membership.objects.filter(
            organization_id=dispute.organization_id, is_active=True, role__in=["owner", "hr"]
        )
        .values_list("user__phone", flat=True)
        .distinct()
    )
    for phone in phones:
        send_sms(
            phone,
            f"KaamSathi: A worker raised a {dispute.kind} dispute. Please respond in KaamSathi → Disputes.",
            kind="dispute_raised",
        )
    # Enterprise webhook (docs/CONTRACT-EXTENSIONS.md §4). No worker personal details in the payload.
    try:
        from apps.integrations.services import emit
    except ImportError:  # pragma: no cover
        return
    emit(
        dispute.organization,
        "dispute.raised",
        {
            "dispute_id": str(dispute.id),
            "kind": dispute.kind,
            "status": dispute.status,
            "raised_at": dispute.raised_at.isoformat(),
        },
    )


# --------------------------------------------------------------------------- employer (/org)
class OrgDisputeViewSet(
    EvidenceMixin,
    AppealMixin,
    OrgScopedMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = DisputeSerializer
    evidence_party = "employer"
    appeal_party = "employer"

    def get_queryset(self):
        qs = dispute_queryset().filter(organization=self.org)
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(worker__full_name__icontains=q) | Q(description__icontains=q))
        return _filter_status(qs, self.request)

    @action(detail=True, methods=["post"])
    def respond(self, request, pk=None):
        dispute = self.get_object()
        if dispute.status not in ("open", "employer_responded"):
            raise InvalidState(message=str(labels.MESSAGES["dispute_not_open"]))
        s = RespondSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        dispute.employer_note = s.validated_data["note"]
        dispute.status = "employer_responded"
        dispute.responded_at = timezone.now()
        dispute.save(update_fields=["employer_note", "status", "responded_at"])
        log(
            request,
            "dispute.respond",
            dispute,
            organization=self.org,
            changes={"note": dispute.employer_note},
        )
        return Response(DisputeSerializer(dispute_queryset().get(pk=dispute.pk)).data)


# --------------------------------------------------------------------------- ops
class OpsDisputeViewSet(
    EvidenceMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated, IsOpsStaff]
    serializer_class = DisputeSerializer
    evidence_party = "ops"

    @action(detail=True, methods=["post"], url_path="appeal-decision")
    def appeal_decision(self, request, pk=None):
        dispute = self.get_object()
        s = AppealDecisionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        dispute = dispute_services.decide_appeal(
            dispute, user=request.user, outcome=s.validated_data["outcome"], note=s.validated_data["note"]
        )
        log(
            request,
            "ops.dispute.appeal_decision",
            dispute,
            organization=dispute.organization,
            changes={"outcome": dispute.appeal_outcome, "note": dispute.appeal_resolution_note},
        )
        outcome = str(labels.label(labels.APPEAL_OUTCOME, dispute.appeal_outcome))
        dispute_services.notify_parties(
            dispute,
            "Dispute appeal decided",
            f"KaamSathi decided the appeal: decision {dispute.appeal_outcome}. Open the app to see the note.",
            title_ne="विवादको पुनरावेदनमा निर्णय भयो",
            body_ne=f"KaamSathi ले पुनरावेदनमा निर्णय गर्यो: {outcome}। टिप्पणी हेर्न एप खोल्नुहोस्।",
        )
        return Response(DisputeSerializer(dispute_queryset().get(pk=dispute.pk)).data)

    def get_queryset(self):
        qs = dispute_queryset()
        p = self.request.query_params
        if p.get("organization"):
            qs = qs.filter(organization_id=p["organization"])
        if p.get("kind"):
            qs = qs.filter(kind__in=p["kind"].split(","))
        if p.get("q"):
            qs = qs.filter(
                Q(worker__full_name__icontains=p["q"])
                | Q(worker__phone__contains=p["q"])
                | Q(organization__name__icontains=p["q"])
            )
        return _filter_status(qs, self.request)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        dispute = self.get_object()
        if dispute.status in Dispute.CLOSED:
            raise InvalidState(message=str(labels.MESSAGES["dispute_closed"]))
        s = ResolveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        old = dispute.status
        dispute.status = s.validated_data["status"]
        dispute.resolution_note = s.validated_data["note"]
        dispute.resolved_by = request.user
        dispute.resolved_at = timezone.now()
        dispute.save(update_fields=["status", "resolution_note", "resolved_by", "resolved_at"])
        # Records (attendance/payslips) are never auto-edited: ops corrects them via existing endpoints.
        log(
            request,
            "ops.dispute.resolve",
            dispute,
            organization=dispute.organization,
            changes={"status": {"from": old, "to": dispute.status}, "note": dispute.resolution_note},
        )
        from apps.notifications.services import send_sms

        send_sms(
            dispute.worker.phone,
            f"KaamSathi: Your dispute has been {dispute.status}. Open the app to see the note.",
            kind="dispute_resolved",
        )
        return Response(DisputeSerializer(dispute_queryset().get(pk=dispute.pk)).data)
