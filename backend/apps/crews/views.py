"""Crew endpoints: naike self-service (/me/crew*) and ops (/ops/crews, /ops/referrals)."""

from __future__ import annotations

from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsOpsStaff
from apps.workers.me_views import current_worker
from apps.workers.models import Worker
from apps.workers.serializers import card_queryset

from . import labels, services
from .models import Crew, Referral
from .serializers import (
    CrewCreateSerializer,
    MarkPaidSerializer,
    MemberCreateSerializer,
    VoidSerializer,
    crew_detail,
    crew_summary,
    member_data,
    referral_data,
    referral_queryset,
)

OPS_PERMS = [IsAuthenticated, IsOpsStaff]


def my_crew(request) -> Crew:
    worker = current_worker(request)
    crew = Crew.objects.select_related("lead").filter(lead=worker).first()
    if crew is None:
        raise NotFound(str(labels.MESSAGES["no_crew"]))
    return crew


def _paginate(view, request, items, fn):
    paginator = StandardPagination()
    page = paginator.paginate_queryset(items, request, view=view)
    return paginator.get_paginated_response([fn(x) for x in page])


# --------------------------------------------------------------------------- naike (/me)
class MeCrewView(APIView):
    def get(self, request):
        return Response(crew_detail(my_crew(request), request))

    def post(self, request):
        worker = current_worker(request)
        s = CrewCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        crew, created = services.become_lead(worker, s.validated_data["name"])
        log(request, "crew.create" if created else "crew.reactivate", crew, organization=None)
        return Response(crew_detail(crew, request), status=201 if created else 200)


class MeCrewMembersView(APIView):
    def post(self, request):
        crew = my_crew(request)
        s = MemberCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        worker, created = services.add_member(
            crew,
            phone=d["phone"],
            full_name=d["full_name"],
            trade=d["trade"],
            years_experience=d.get("years_experience") or 0,
        )
        log(request, "crew.member_add", crew, organization=None, changes={"worker_id": str(worker.id)})
        worker = card_queryset(Worker.objects.filter(pk=worker.pk)).get()
        return Response(member_data(worker, request), status=201)


class MeCrewMemberDetailView(APIView):
    def delete(self, request, worker_id):
        crew = my_crew(request)
        worker = Worker.objects.filter(pk=worker_id).first()
        if worker is None:
            raise NotFound()
        services.remove_member(crew, worker)
        log(request, "crew.member_remove", crew, organization=None, changes={"worker_id": str(worker.id)})
        return Response(status=204)


class MeCrewReferralsView(APIView):
    def get(self, request):
        crew = my_crew(request)
        qs = referral_queryset().filter(crew=crew)
        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status__in=status.split(","))
        return _paginate(self, request, qs, referral_data)


# --------------------------------------------------------------------------- ops
class OpsCrewViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = OPS_PERMS

    def get_queryset(self):
        qs = Crew.objects.select_related(
            "lead__current_district", "lead__permanent_district"
        ).prefetch_related(
            "lead__skills__trade",
            "lead__employments__ratings",
            "lead__employments__organization",
            "lead__trust",
        )
        p = self.request.query_params
        if p.get("q"):
            qs = qs.filter(
                Q(name__icontains=p["q"])
                | Q(lead__full_name__icontains=p["q"])
                | Q(lead__phone__contains=p["q"])
            )
        if p.get("is_active") in ("true", "false", "1", "0"):
            qs = qs.filter(is_active=p["is_active"] in ("true", "1"))
        return qs.order_by("name")

    def list(self, request, *args, **kwargs):
        return _paginate(self, request, self.get_queryset(), lambda c: crew_summary(c, request))

    def retrieve(self, request, *args, **kwargs):
        crew = self.get_object()
        data = crew_detail(crew, request)
        data["referrals"] = [referral_data(r) for r in referral_queryset().filter(crew=crew)[:100]]
        return Response(data)


class OpsReferralViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = OPS_PERMS

    def get_queryset(self):
        qs = referral_queryset()
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("crew"):
            qs = qs.filter(crew_id=p["crew"])
        if p.get("q"):
            qs = qs.filter(Q(worker__full_name__icontains=p["q"]) | Q(crew__name__icontains=p["q"]))
        return qs

    def list(self, request, *args, **kwargs):
        return _paginate(self, request, self.get_queryset(), referral_data)

    def retrieve(self, request, *args, **kwargs):
        return Response(referral_data(self.get_object()))

    def _done(self, request, referral: Referral, action_name: str, changes: dict):
        log(request, f"ops.referral.{action_name}", referral, organization=None, changes=changes)
        return Response(referral_data(referral_queryset().get(pk=referral.pk)))

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        s = MarkPaidSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        referral = services.mark_paid(self.get_object(), s.validated_data["payout_ref"])
        return self._done(request, referral, "mark_paid", {"payout_ref": referral.payout_ref})

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        s = VoidSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        referral = services.void(self.get_object(), s.validated_data["reason"])
        return self._done(request, referral, "void", {"reason": referral.void_reason})
