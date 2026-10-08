"""Worker-side hiring (docs/CONTRACT-EXTENSIONS.md §3): recommended jobs, interest, my applications.

Routed from ``apps/experience/urls.py`` (worker growth)."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core import labels
from apps.core.bs import bs_str
from apps.core.money import money_str
from apps.core.pagination import StandardPagination
from apps.core.serializers import district_ref, ref, trade_ref
from apps.workers.me_views import current_worker

from . import labels as hiring_labels
from . import services
from .models import Application, JobOpening


def job_summary(job: JobOpening) -> dict:
    """Worker-facing job card (no internal counts)."""
    district = job.site.district if job.site and job.site.district_id else job.organization.district
    return {
        "id": str(job.id),
        "title": job.title,
        "description": job.description,
        "trade": trade_ref(job.trade),
        "wage_type": job.wage_type,
        "wage_amount": money_str(job.wage_amount),
        "district": district_ref(district),
        "food_provided": job.food_provided,
        "accommodation_provided": job.accommodation_provided,
        "start_date": job.start_date.isoformat() if job.start_date else None,
        "start_date_bs": bs_str(job.start_date),
        "openings_count": job.openings_count,
        "shift": ref(job.shift, "id", "name"),
        "status": job.status,
        "published_at": job.published_at.isoformat() if job.published_at else None,
        "organization": {"id": str(job.organization_id), "name": job.organization.name},
        "employer_verified": services.employer_verified(job.organization),
    }


def _my_interview(iv) -> dict:
    """Worker view of an interview round (no interviewer notes)."""
    from django.utils import timezone

    from . import labels as hl

    local = timezone.localtime(iv.scheduled_at)
    return {
        "id": str(iv.id),
        "scheduled_at": local.isoformat(),
        "scheduled_at_bs": bs_str(local.date()),
        "mode": iv.mode,
        "mode_label": labels.label(hl.INTERVIEW_MODE, iv.mode),
        "location": iv.location,
        "outcome": iv.outcome,
        "outcome_label": labels.label(hl.INTERVIEW_OUTCOME, iv.outcome),
    }


def my_application(app: Application) -> dict:
    return {
        "id": str(app.id),
        "stage": app.stage,
        "stage_label": labels.label(labels.STAGE, app.stage),
        "source": app.source,
        "source_label": labels.label(hiring_labels.SOURCE, app.source),
        "worker_response": app.worker_response,
        "worker_response_label": labels.label(hiring_labels.WORKER_RESPONSE, app.worker_response),
        "responded_at": app.responded_at.isoformat() if app.responded_at else None,
        "interview_at": app.interview_at.isoformat() if app.interview_at else None,
        "interviews": [_my_interview(iv) for iv in app.interviews.all()],
        "created_at": app.created_at.isoformat(),
        "stage_changed_at": app.stage_changed_at.isoformat(),
        "can_respond": app.stage not in Application.TERMINAL and app.stage != "sourced",
        "job": job_summary(app.job),
        "organization": {"id": str(app.job.organization_id), "name": app.job.organization.name},
        "employer_verified": services.employer_verified(app.job.organization),
    }


def _paginate(view, request, items, fn):
    paginator = StandardPagination()
    page = paginator.paginate_queryset(items, request, view=view)
    return paginator.get_paginated_response([fn(x) for x in page])


class RecommendedJobsView(APIView):
    def get(self, request):
        worker = current_worker(request)
        return _paginate(self, request, services.recommended_jobs(worker), job_summary)


class JobInterestView(APIView):
    def post(self, request, job_id):
        worker = current_worker(request)
        job = get_object_or_404(JobOpening.objects.select_related("organization", "trade", "site"), pk=job_id)
        app, created = services.express_interest(worker, job, request.user)
        if created:
            log(request, "application.worker_interest", app, organization=job.organization)
        app = _my_queryset(worker).get(pk=app.pk)
        return Response(my_application(app), status=201 if created else 200)


def _my_queryset(worker):
    return Application.objects.filter(worker=worker).select_related(
        "job__organization__district", "job__trade", "job__site__district", "job__shift"
    )


class RespondSerializer(serializers.Serializer):
    response = serializers.ChoiceField(choices=["interested", "declined"])
    note = serializers.CharField(required=False, allow_blank=True, default="", max_length=500)


class MeApplicationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    def get_queryset(self):
        qs = _my_queryset(current_worker(self.request))
        p = self.request.query_params
        if p.get("stage"):
            qs = qs.filter(stage__in=p["stage"].split(","))
        if p.get("active") in ("1", "true"):
            qs = qs.exclude(stage__in=Application.TERMINAL)
        return qs.order_by("-stage_changed_at")

    def list(self, request, *args, **kwargs):
        return _paginate(self, request, self.get_queryset(), my_application)

    def retrieve(self, request, *args, **kwargs):
        return Response(my_application(self.get_object()))

    @action(detail=True, methods=["post"])
    def respond(self, request, pk=None):
        app = self.get_object()
        s = RespondSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        old = app.stage
        services.respond_to_application(app, d["response"], request.user, note=d["note"].strip())
        app = self.get_queryset().get(pk=app.pk)
        log(
            request,
            "application.worker_respond",
            app,
            organization=app.job.organization,
            changes={"response": d["response"], "stage": {"from": old, "to": app.stage}},
        )
        return Response(my_application(app))


# --------------------------------------------------------------------------- offers received (EMP-07)
class DeclineOfferSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="", max_length=500)


def my_offer(offer) -> dict:
    from .serializers import offer_payload

    data = offer_payload(offer)
    app = offer.application
    data["job"] = job_summary(app.job)
    data["organization"] = {"id": str(app.job.organization_id), "name": app.job.organization.name}
    data["employer_verified"] = services.employer_verified(app.job.organization)
    data["monthly_amount"] = money_str(services.offer_monthly_amount(offer))
    return data


class MeJobOfferViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """/me/job-offers (named apart from finance's /me/offers)."""

    def get_queryset(self):
        from .models import JobOffer

        worker = current_worker(self.request)
        qs = JobOffer.objects.filter(application__worker=worker)
        services.expire_offers(qs)
        qs = qs.select_related(
            "site",
            "application__job__organization__district",
            "application__job__trade",
            "application__job__site__district",
            "application__job__shift",
        )
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status__in=status.split(","))
        return qs.exclude(status="withdrawn").order_by("-created_at")

    def list(self, request, *args, **kwargs):
        return _paginate(self, request, self.get_queryset(), my_offer)

    def retrieve(self, request, *args, **kwargs):
        return Response(my_offer(self.get_object()))

    def _respond(self, request, accept: bool):
        offer = self.get_object()
        reason = ""
        if not accept:
            s = DeclineOfferSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            reason = s.validated_data["reason"].strip()
        offer = services.respond_to_offer(offer, accept, reason)
        log(
            request,
            "offer.accept" if accept else "offer.decline",
            offer,
            organization=offer.application.job.organization,
            changes={"status": offer.status, "reason": reason or None},
        )
        return Response(my_offer(self.get_queryset().get(pk=offer.pk)))

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        return self._respond(request, True)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        return self._respond(request, False)


# --------------------------------------------------------------------------- job alerts (SEARCH-02)
MAX_ALERTS = 10


class MeJobAlertViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete"]

    def get_serializer_class(self):
        from .serializers import JobAlertSerializer

        return JobAlertSerializer

    def get_queryset(self):
        from .models import JobAlert

        return (
            JobAlert.objects.filter(worker=current_worker(self.request))
            .select_related("trade")
            .prefetch_related("districts")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        from django.utils.translation import pgettext

        from apps.core.exceptions import InvalidState

        worker = current_worker(self.request)
        if worker.job_alerts.count() >= MAX_ALERTS:
            raise InvalidState(message=pgettext("growth", "You can keep up to 10 job alerts."))
        serializer.save(worker=worker)
