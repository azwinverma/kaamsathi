from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import AuditedViewSetMixin, log, snapshot
from apps.core.exceptions import APIError, InvalidState
from apps.core.permissions import OrgScopedMixin
from apps.orgs.models import Site
from apps.workers.serializers import WORKER_CARD_PREFETCH

from . import services
from .models import Application, JobOffer, JobOpening
from .serializers import (
    ApplicationDetailSerializer,
    ApplicationSerializer,
    JobSerializer,
    MoveSerializer,
    OfferInputSerializer,
    annotate_counts,
    offer_payload,
)


class JobViewSet(OrgScopedMixin, AuditedViewSetMixin, viewsets.ModelViewSet):
    serializer_class = JobSerializer
    http_method_names = ["get", "post", "patch", "delete"]
    ordering_fields = ["created_at", "published_at", "title", "start_date", "status"]
    audit_prefix = "job"

    def get_queryset(self):
        qs = annotate_counts(
            JobOpening.objects.filter(organization=self.org)
            .select_related("trade", "site", "shift")
            .prefetch_related("requirements__trade")
        )
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("trade"):
            qs = qs.filter(trade_id=p["trade"])
        if p.get("q"):
            from apps.workers.services import matching_trade_codes

            qs = qs.filter(
                Q(title__icontains=p["q"])
                | Q(description__icontains=p["q"])
                | Q(trade_id__in=matching_trade_codes(p["q"]))
            )
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
        return self._transition(request, {"draft", "open", "filled", "paused"}, "closed")

    # J006: a paused job keeps its pipeline but is hidden from recommendations/alerts and gets no
    # new shortlists or invitations.
    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return self._transition(request, {"open"}, "paused", paused_at=timezone.now())

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        return self._transition(request, {"paused"}, "open", paused_at=None)

    # L004: invite a past worker (ended employment) or a worker who shared their Skill Passport.
    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        from apps.workers.models import Worker

        from . import labels as hiring_labels
        from .pipeline import invite_worker, past_worker_ids, worker_from_share

        job = self.get_object()
        data = request.data if isinstance(request.data, dict) else {}
        worker = None
        via = None
        if data.get("share_token"):
            worker = worker_from_share(str(data["share_token"]))
            if worker is None:
                raise APIError(
                    "validation_error", fields={"share_token": [str(hiring_labels.MESSAGES["share_invalid"])]}
                )
            if data.get("worker_id") and str(worker.pk) != str(data["worker_id"]):
                raise APIError(
                    "validation_error", fields={"worker_id": ["Does not match the shared passport."]}
                )
            via = "passport_share"
        elif data.get("worker_id"):
            try:
                worker = Worker.objects.filter(pk=data["worker_id"]).first()
            except Exception as exc:  # noqa: BLE001 - malformed uuid
                raise APIError("validation_error", fields={"worker_id": ["Invalid worker id."]}) from exc
            if worker is None or worker.pk not in past_worker_ids(self.org):
                raise APIError(
                    "permission_denied",
                    message=str(hiring_labels.MESSAGES["invite_not_eligible"]),
                    status_code=403,
                )
            via = "past_employment"
        else:
            raise APIError("validation_error", fields={"worker_id": ["Provide worker_id or share_token."]})
        app = invite_worker(job, worker, request.user)
        log(
            request,
            "application.invite",
            app,
            organization=self.org,
            changes={"job": str(job.id), "worker": str(worker.id), "via": via},
        )
        app = Application.objects.select_related("job__organization", "worker").get(pk=app.pk)
        return Response(ApplicationSerializer(app, context={"request": request}).data, status=201)

    @action(detail=True, methods=["get"], url_path="invite-candidates")
    def invite_candidates(self, request, pk=None):
        """Past workers of this org not already in this job's pipeline (WorkerCard list)."""
        from apps.workers.models import Worker
        from apps.workers.serializers import card_queryset, worker_card

        from .pipeline import past_worker_ids

        job = self.get_object()
        in_job = set(job.applications.values_list("worker_id", flat=True))
        ids = past_worker_ids(self.org) - in_job
        qs = card_queryset(Worker.objects.filter(pk__in=ids)).order_by("full_name")
        page = self.paginate_queryset(qs)
        return self.get_paginated_response([worker_card(w, request) for w in page])


class ApplicationViewSet(
    OrgScopedMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = ApplicationSerializer
    ordering_fields = ["stage_changed_at", "created_at", "interview_at"]

    def partial_update(self, request, *args, **kwargs):
        """``PATCH /org/applications/{id} {tags?: [str], assignee_id?: uuid|null}`` (managers)."""
        from .pipeline import clean_tags, resolve_assignee

        application = self.get_object()
        data = request.data if isinstance(request.data, dict) else {}
        changes, fields = {}, []
        if "tags" in data:
            tags = clean_tags(data["tags"])
            changes["tags"] = {"from": application.tags, "to": tags}
            application.tags = tags
            fields.append("tags")
        if "assignee_id" in data:
            assignee = resolve_assignee(self.org, data["assignee_id"])
            changes["assignee"] = {
                "from": str(application.assignee_id) if application.assignee_id else None,
                "to": str(assignee.pk) if assignee else None,
            }
            application.assignee = assignee
            fields.append("assignee")
        if not fields:
            raise APIError("validation_error", fields={"tags": ["Provide tags and/or assignee_id."]})
        application.save(update_fields=fields)
        log(request, "application.update", application, organization=self.org, changes=changes)
        return Response(
            ApplicationSerializer(
                self.get_queryset().get(pk=application.pk), context={"request": request}
            ).data
        )

    @action(detail=True, methods=["get", "post"])
    def interviews(self, request, pk=None):
        """``GET|POST /org/applications/{id}/interviews`` — interview rounds (L010)."""
        from .pipeline import interview_payload, schedule_interview
        from .serializers import InterviewSerializer

        application = self.get_object()
        if request.method == "GET":
            return Response([interview_payload(iv) for iv in application.interviews.all()])
        s = InterviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        iv = schedule_interview(application, dict(s.validated_data), request.user)
        log(
            request,
            "interview.create",
            iv,
            organization=self.org,
            changes={
                "application": str(application.id),
                "scheduled_at": iv.scheduled_at.isoformat(),
                "mode": iv.mode,
            },
        )
        return Response(interview_payload(iv), status=201)

    def get_queryset(self):
        qs = (
            Application.employer_visible()
            .filter(job__organization=self.org)
            .select_related(
                "job__organization", "worker__current_district", "worker__permanent_district", "assignee"
            )
            .prefetch_related(*[f"worker__{p}" for p in WORKER_CARD_PREFETCH], "employments", "offers__site")
        )
        if self.action in ("list", "retrieve"):  # lazy offer expiry (no beat task)
            services.expire_offers(JobOffer.objects.filter(application__job__organization=self.org))
        p = self.request.query_params
        if p.get("job"):
            qs = qs.filter(job_id=p["job"])
        if p.get("stage"):
            qs = qs.filter(stage__in=p["stage"].split(","))
        if p.get("q"):
            qs = qs.filter(Q(worker__full_name__icontains=p["q"]) | Q(worker__phone__contains=p["q"]))
        if p.get("tag"):
            qs = qs.filter(tags__contains=[p["tag"].strip().lower()])
        assignee = p.get("assignee")
        if assignee == "me":
            qs = qs.filter(assignee=self.request.user)
        elif assignee == "none":
            qs = qs.filter(assignee__isnull=True)
        elif assignee:
            qs = qs.filter(assignee_id=assignee)
        if p.get("source"):
            qs = qs.filter(source__in=p["source"].split(","))
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
        payload = request.data
        if isinstance(payload, dict) and payload.get("stage") == "joined" and not payload.get("employment"):
            offer = services.accepted_offer(application)
            if offer is not None:  # join on the accepted offer's terms (EMP-07)
                terms = services.employment_from_offer(offer)
                payload = {
                    **payload,
                    "employment": {
                        **{k: v for k, v in terms.items() if v is not None and k != "site"},
                        "start_date": terms["start_date"].isoformat(),
                        "site_id": str(terms["site"].pk) if terms["site"] else None,
                    },
                }
        s = MoveSerializer(data=payload)
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

    @action(detail=True, methods=["post"])
    def offer(self, request, pk=None):
        """Send a written offer to a ``selected`` candidate (EMP-07)."""
        application = self.get_object()
        s = OfferInputSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        site_id = data.pop("site_id", None)
        if site_id:
            data["site"] = Site.objects.filter(organization=self.org, pk=site_id).first()
            if data["site"] is None:
                raise APIError("validation_error", fields={"site_id": ["Unknown site."]})
        offer = services.send_offer(application, data, request.user)
        log(
            request,
            "offer.send",
            offer,
            organization=self.org,
            changes={"application": str(application.id), "after": snapshot(offer)},
        )
        return Response(offer_payload(offer), status=201)


class OfferViewSet(OrgScopedMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """/org/offers — offers this organization has sent."""

    def get_queryset(self):
        services.expire_offers(JobOffer.objects.filter(application__job__organization=self.org))
        qs = JobOffer.objects.filter(application__job__organization=self.org).select_related(
            "site", "application__worker", "application__job"
        )
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("job"):
            qs = qs.filter(application__job_id=p["job"])
        if p.get("application"):
            qs = qs.filter(application_id=p["application"])
        return qs.order_by("-created_at")

    @staticmethod
    def _row(offer):
        data = offer_payload(offer)
        data["worker"] = {
            "id": str(offer.application.worker_id),
            "full_name": offer.application.worker.full_name,
        }
        data["job"] = {"id": str(offer.application.job_id), "title": offer.application.job.title}
        return data

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response([self._row(o) for o in page])

    def retrieve(self, request, *args, **kwargs):
        return Response(self._row(self.get_object()))

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        offer = services.withdraw_offer(self.get_object())
        log(request, "offer.withdraw", offer, organization=self.org, changes={"status": "withdrawn"})
        return Response(self._row(offer))


class InterviewViewSet(OrgScopedMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """``GET|PATCH|DELETE /org/interviews/{id}`` — reschedule, record the outcome, remove a pending round."""

    http_method_names = ["get", "patch", "delete"]

    def get_queryset(self):
        from .models import Interview

        return Interview.objects.filter(application__job__organization=self.org).select_related(
            "application__job"
        )

    def retrieve(self, request, *args, **kwargs):
        from .pipeline import interview_payload

        return Response(interview_payload(self.get_object()))

    def partial_update(self, request, *args, **kwargs):
        from .pipeline import interview_payload, update_interview
        from .serializers import InterviewSerializer

        iv = self.get_object()
        s = InterviewSerializer(iv, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        before = snapshot(iv)
        iv = update_interview(iv, dict(s.validated_data))
        from apps.audit.services import diff

        log(request, "interview.update", iv, organization=self.org, changes=diff(before, snapshot(iv)))
        return Response(interview_payload(iv))

    def destroy(self, request, *args, **kwargs):
        from .pipeline import sync_interview_at

        iv = self.get_object()
        if iv.outcome != "pending":
            raise InvalidState(message="Only a scheduled (pending) interview can be removed.")
        application = iv.application
        log(request, "interview.delete", iv, organization=self.org, changes={"before": snapshot(iv)})
        iv.delete()
        sync_interview_at(application)
        return Response(status=204)


class ApplicationTagsView(OrgScopedMixin, APIView):
    """``GET /org/application-tags`` → ``[{tag, count}]`` used in this org (autocomplete/filter)."""

    def get(self, request):
        from collections import Counter

        counter: Counter = Counter()
        for tags in (
            Application.objects.filter(job__organization=self.org)
            .exclude(tags=[])
            .values_list("tags", flat=True)
        ):
            counter.update(tags or [])
        return Response(
            [{"tag": t, "count": n} for t, n in sorted(counter.items(), key=lambda x: (-x[1], x[0]))]
        )
