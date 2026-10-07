from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services import AuditedViewSetMixin, log
from apps.core.exceptions import APIError, InvalidState
from apps.core.permissions import OrgScopedMixin
from apps.orgs.models import Site
from apps.workers.serializers import WORKER_CARD_PREFETCH

from . import services
from .models import Application, JobOpening
from .serializers import (
    ApplicationDetailSerializer,
    ApplicationSerializer,
    JobSerializer,
    MoveSerializer,
    annotate_counts,
)


class JobViewSet(OrgScopedMixin, AuditedViewSetMixin, viewsets.ModelViewSet):
    serializer_class = JobSerializer
    http_method_names = ["get", "post", "patch", "delete"]
    ordering_fields = ["created_at", "published_at", "title", "start_date", "status"]
    audit_prefix = "job"

    def get_queryset(self):
        qs = annotate_counts(
            JobOpening.objects.filter(organization=self.org).select_related("trade", "site", "shift")
        )
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("trade"):
            qs = qs.filter(trade_id=p["trade"])
        if p.get("q"):
            qs = qs.filter(Q(title__icontains=p["q"]) | Q(description__icontains=p["q"]))
        return qs.order_by("-created_at")

    def get_create_kwargs(self):
        return {"organization": self.org, "created_by": self.request.user}

    def perform_destroy(self, instance):
        if instance.status != "draft":
            raise InvalidState(message="Only draft jobs can be deleted.")
        super().perform_destroy(instance)

    def _transition(self, request, allowed_from, to, **extra):
        job = self.get_object()
        if job.status not in allowed_from:
            raise InvalidState()
        old = job.status
        job.status = to
        for k, v in extra.items():
            setattr(job, k, v)
        job.save()
        log(request, f"job.{to}", job, organization=self.org, changes={"status": {"from": old, "to": to}})
        return Response(self.get_serializer(self.get_queryset().get(pk=job.pk)).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        return self._transition(request, {"draft"}, "open", published_at=timezone.now())

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        return self._transition(request, {"draft", "open", "filled"}, "closed")


class ApplicationViewSet(
    OrgScopedMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = ApplicationSerializer
    ordering_fields = ["stage_changed_at", "created_at", "interview_at"]

    def get_queryset(self):
        qs = (
            Application.objects.filter(job__organization=self.org)
            .select_related("job__organization", "worker__current_district", "worker__permanent_district")
            .prefetch_related(*[f"worker__{p}" for p in WORKER_CARD_PREFETCH], "employments")
        )
        p = self.request.query_params
        if p.get("job"):
            qs = qs.filter(job_id=p["job"])
        if p.get("stage"):
            qs = qs.filter(stage__in=p["stage"].split(","))
        if p.get("q"):
            qs = qs.filter(Q(worker__full_name__icontains=p["q"]) | Q(worker__phone__contains=p["q"]))
        return qs.order_by("-stage_changed_at")

    def get_serializer_class(self):
        return ApplicationDetailSerializer if self.action == "retrieve" else ApplicationSerializer

    def retrieve(self, request, *args, **kwargs):
        application = self.get_object()
        data = self.get_serializer(application).data
        if data.get("profile_visible"):
            from apps.trust.services import log_profile_view

            log_profile_view(
                application.worker,
                context="application",
                organization=self.org,
                viewer=request.user,
                object_id=application.id,
            )
        return Response(data)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        application = self.get_object()
        s = MoveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        emp_data = None
        if d.get("employment"):
            emp_data = dict(d["employment"])
            site_id = emp_data.pop("site_id", None)
            if site_id:
                site = Site.objects.filter(organization=self.org, pk=site_id).first()
                if site is None:
                    raise APIError("validation_error", fields={"employment.site_id": ["Unknown site."]})
                emp_data["site"] = site
        application, employment = services.move_application(
            application,
            d["stage"],
            request.user,
            note=d.get("note") or "",
            interview_at=d.get("interview_at"),
            rejection_reason=d.get("rejection_reason"),
            employment_data=emp_data,
        )
        log(
            request,
            "application.move",
            application,
            organization=self.org,
            changes={"to_stage": d["stage"], "employment_id": str(employment.id) if employment else None},
        )
        if employment:
            log(
                request,
                "employment.create",
                employment,
                organization=self.org,
                changes={"via_application": str(application.id)},
            )
        application = self.get_queryset().get(pk=application.pk)
        return Response(
            {
                "application": ApplicationSerializer(application, context={"request": request}).data,
                "employment_id": str(employment.id) if employment else None,
            }
        )
