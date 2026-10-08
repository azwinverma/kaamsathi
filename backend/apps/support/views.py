"""Support case endpoints: /me (any signed-in user), /org (members, org-scoped), /ops (staff)."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.exceptions import InvalidState
from apps.core.labels import ERROR_MESSAGES
from apps.core.permissions import ALL_ROLES, MANAGERS, IsOpsStaff, OrgScopedMixin

from . import labels, services
from .models import CaseMessage, HelpArticle, SupportCase
from .serializers import (
    CaseCreateSerializer,
    CaseUpdateSerializer,
    HelpArticleSerializer,
    IdentityCheckSerializer,
    MessageCreateSerializer,
    StaffMessageCreateSerializer,
    WorkerSensitiveUpdateSerializer,
    case_payload,
    message_payload,
)


def case_queryset():
    return (
        SupportCase.objects.select_related("requester", "worker", "organization", "assignee")
        .annotate(
            messages_count=Count("messages", filter=Q(messages__internal=False), distinct=True),
            last_message_at=Max("messages__created_at", filter=Q(messages__internal=False)),
        )
        .order_by("-created_at")
    )


def _filter(qs, params):
    if params.get("status"):
        qs = qs.filter(status__in=params["status"].split(","))
    if params.get("priority"):
        qs = qs.filter(priority__in=params["priority"].split(","))
    if params.get("category"):
        qs = qs.filter(category__in=params["category"].split(","))
    if params.get("q"):
        q = params["q"].strip()
        qs = qs.filter(Q(number__iexact=q) | Q(subject__icontains=q) | Q(requester__full_name__icontains=q))
    return qs


class _CaseViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    staff = False

    def payload(self, case):
        return case_payload(case, staff=self.staff, viewer=self.request.user)

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response([self.payload(c) for c in page])

    def retrieve(self, request, *args, **kwargs):
        return Response(self.payload(self.get_object()))

    def _messages_qs(self, case):
        qs = CaseMessage.objects.filter(case=case).select_related("author")
        return qs if self.staff else qs.filter(internal=False)

    def _reload(self, case):
        return case_queryset().get(pk=case.pk)


class _RequesterCaseViewSet(mixins.CreateModelMixin, _CaseViewSet):
    """Shared by /me and /org: create a case, read the public thread, reply."""

    def create_kwargs(self, request) -> dict:
        raise NotImplementedError

    def create(self, request, *args, **kwargs):
        s = CaseCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        org_id = data.pop("organization_id", None)
        kwargs = self.create_kwargs(request)
        if org_id and data.get("category") == "safety" and kwargs.get("organization") is None:
            # a worker may name the employer a safety report is about (never shown to it)
            from apps.orgs.models import Organization

            kwargs["organization"] = Organization.objects.filter(pk=org_id).first()
        case = services.create_case(requester=request.user, **data, **kwargs)
        log(
            request,
            "support_case.create",
            case,
            # confidential reports stay out of the employer's audit view
            organization=None if case.confidential else case.organization,
            changes={"number": case.number, "category": case.category, "emergency": case.emergency},
        )
        return Response(self.payload(self._reload(case)), status=201)

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        case = self.get_object()
        if request.method == "GET":
            hide = case.requester_id if case.anonymous and case.requester_id != request.user.pk else None
            return Response([message_payload(m, anonymize_user_id=hide) for m in self._messages_qs(case)])
        if case.status == "closed":
            raise InvalidState(message=str(labels.MESSAGES["case_closed"]))
        s = MessageCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        msg = services.add_message(case, request.user, s.validated_data["body"], staff=False)
        return Response(message_payload(msg), status=201)


class MeSupportCaseViewSet(_RequesterCaseViewSet):
    """Cases the user raised for themself (worker app / personal web); org cases live under /org."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # personal cases + the user's own confidential (safety) reports, wherever they were filed
        qs = case_queryset().filter(
            Q(organization__isnull=True) | Q(confidential=True), requester=self.request.user
        )
        return _filter(qs, self.request.query_params)

    def create_kwargs(self, request):
        worker = getattr(request.user, "worker", None)
        return {"worker": worker, "organization": None}


class OrgSupportCaseViewSet(OrgScopedMixin, _RequesterCaseViewSet):
    """Any member may raise and follow cases; supervisors only see the cases they raised."""

    default_roles = ALL_ROLES

    def get_queryset(self):
        qs = case_queryset().filter(organization=self.org)
        # confidential safety reports: only the reporter, unless ops shared the case
        qs = qs.filter(Q(confidential=False) | Q(shared_with_org=True) | Q(requester=self.request.user))
        if self.membership.role not in MANAGERS:
            qs = qs.filter(requester=self.request.user)
        return _filter(qs, self.request.query_params)

    def create_kwargs(self, request):
        return {"worker": None, "organization": self.org}


class OpsSupportCaseViewSet(_CaseViewSet):
    permission_classes = [IsAuthenticated, IsOpsStaff]
    staff = True
    http_method_names = ["get", "post", "patch"]

    def get_queryset(self):
        p = self.request.query_params
        qs = _filter(case_queryset(), p)
        assignee = p.get("assignee")
        if assignee == "me":
            qs = qs.filter(assignee=self.request.user)
        elif assignee == "none":
            qs = qs.filter(assignee__isnull=True)
        elif assignee:
            qs = qs.filter(assignee_id=assignee)
        if p.get("overdue") in ("1", "true"):
            qs = qs.filter(status="open", sla_due_at__lt=timezone.now())
        if p.get("organization"):
            qs = qs.filter(organization_id=p["organization"])
        if p.get("channel"):
            qs = qs.filter(channel__in=p["channel"].split(","))
        # Active work first, by SLA; closed cases newest first.
        if p.get("ordering") == "-created_at":
            return qs.order_by("-created_at")
        return qs.order_by("sla_due_at") if p.get("status") else qs.order_by("-created_at")

    def partial_update(self, request, *args, **kwargs):
        case = self.get_object()
        s = CaseUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        changes = {}
        fields = ["updated_at"]
        if "assignee_id" in d:
            new = None
            if d["assignee_id"] is not None:
                new = (
                    get_user_model()
                    .objects.filter(pk=d["assignee_id"], is_staff=True, is_active=True)
                    .first()
                )
                if new is None:
                    raise ValidationError({"assignee_id": [str(labels.MESSAGES["assignee_not_staff"])]})
            if new != case.assignee:
                changes["assignee"] = {
                    "from": str(case.assignee_id) if case.assignee_id else None,
                    "to": str(new.pk) if new else None,
                }
                case.assignee = new
                fields.append("assignee")
        if "priority" in d and d["priority"] != case.priority:
            changes["priority"] = {"from": case.priority, "to": d["priority"]}
            services.set_priority(case, d["priority"])
            fields += ["priority", "sla_due_at", "escalated"]
        if "shared_with_org" in d and d["shared_with_org"] != case.shared_with_org:
            changes["shared_with_org"] = {"from": case.shared_with_org, "to": d["shared_with_org"]}
            case.shared_with_org = d["shared_with_org"]
            fields.append("shared_with_org")
        for key, model_label in (("dispute_id", "trust.Dispute"), ("risk_flag_id", "risk.FraudFlag")):
            if key not in d:
                continue
            value = d[key]
            if value is not None:
                from django.apps import apps as registry

                if not registry.get_model(model_label).objects.filter(pk=value).exists():
                    raise ValidationError({key: [str(ERROR_MESSAGES["not_found"])]})
            current = getattr(case, key)
            if (str(current) if current else None) != (str(value) if value else None):
                changes[key] = {
                    "from": str(current) if current else None,
                    "to": str(value) if value else None,
                }
                setattr(case, key, value)
                fields.append(key)
        status_changed = "status" in d and d["status"] != case.status
        if status_changed:
            changes["status"] = {"from": case.status, "to": d["status"]}
            services.set_status(case, d["status"])
            fields += ["status", "resolved_at"]
        if changes:
            case.save(update_fields=fields)
            log(request, "ops.support_case.update", case, organization=case.organization, changes=changes)
            if status_changed:
                services.notify_status(case)
                services.emit_update(case, "status")
        return Response(self.payload(self._reload(case)))

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        case = self.get_object()
        if request.method == "GET":
            return Response([message_payload(m, staff=True) for m in self._messages_qs(case)])
        s = StaffMessageCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        call_note = s.validated_data["channel"] == "phone"
        msg = services.add_message(
            case,
            request.user,
            s.validated_data["body"],
            internal=s.validated_data["internal"] or call_note,
            staff=True,
            channel=s.validated_data["channel"],
        )
        if case.assignee_id is None and not msg.internal:
            case.assignee = request.user  # whoever answers first owns the case
            case.save(update_fields=["assignee", "updated_at"])
        log(
            request,
            "ops.support_case.message",
            case,
            organization=case.organization,
            changes={"internal": msg.internal},
        )
        return Response(message_payload(msg, staff=True), status=201)

    @action(detail=True, methods=["post"], url_path="identity-check")
    def identity_check(self, request, pk=None):
        """Record a caller identity check (OTP to the registered phone / security questions)."""
        case = self.get_object()
        s = IdentityCheckSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        passed = s.validated_data["result"] == "passed"
        services.record_identity_check(case, request.user, s.validated_data["method"], passed)
        log(
            request,
            "ops.support_case.identity_check",
            case,
            organization=None,
            changes={"method": s.validated_data["method"], "result": s.validated_data["result"]},
        )
        return Response(self.payload(self._reload(case)))

    @action(detail=True, methods=["post"], url_path="worker-update")
    def worker_update(self, request, pk=None):
        """Change the case worker's phone / payment details — needs a passed identity check ≤ 15 min."""
        case = self.get_object()
        s = WorkerSensitiveUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        audit = services.update_worker_sensitive(case, request.user, s.validated_data)
        log(
            request,
            "ops.support_case.worker_update",
            case.worker,
            organization=None,
            changes={"case": case.number, **audit},
        )
        return Response({"updated": sorted(audit), "case": self.payload(self._reload(case))})


class OpsSupportLookupView(APIView):
    """GET /ops/support/lookup?phone=|citizenship_no= — contact-center caller search (audited).

    Citizenship numbers are matched through the blind index only; nothing sensitive is returned.
    """

    permission_classes = [IsAuthenticated, IsOpsStaff]

    def get(self, request):
        from django.contrib.auth import get_user_model

        from apps.core.crypto import blind_index
        from apps.orgs.models import Membership
        from apps.workers.models import Worker

        phone = (request.query_params.get("phone") or "").strip()
        citizenship = (request.query_params.get("citizenship_no") or "").strip()
        if not phone and not citizenship:
            raise ValidationError({"phone": [str(labels.MESSAGES["lookup_needs_query"])]})
        workers = Worker.objects.select_related("user", "current_district")
        users = get_user_model().objects.none()
        if phone:
            workers = workers.filter(phone=phone)
            users = get_user_model().objects.filter(phone=phone)
        else:
            workers = workers.filter(citizenship_no_hash=blind_index(citizenship, "citizenship"))
        workers = list(workers[:10])
        user_ids = {w.user_id for w in workers if w.user_id} | set(users.values_list("pk", flat=True))
        all_users = list(get_user_model().objects.filter(pk__in=user_ids))
        memberships = Membership.objects.filter(user_id__in=user_ids, is_active=True).select_related(
            "organization"
        )
        cases = (
            case_queryset()
            .filter(Q(requester_id__in=user_ids) | Q(worker__in=workers))
            .exclude(status="closed")[:20]
        )
        log(
            request,
            "ops.support.lookup",
            None,
            organization=None,
            object_type="lookup",
            changes={"by": "phone" if phone else "citizenship_no", "matches": len(workers) + len(all_users)},
        )
        return Response(
            {
                "users": [
                    {
                        "id": str(u.pk),
                        "full_name": u.full_name,
                        "phone": u.phone,
                        "is_staff": u.is_staff,
                        "preferred_language": u.preferred_language,
                        "date_joined": u.date_joined.isoformat() if u.date_joined else None,
                    }
                    for u in all_users
                ],
                "workers": [
                    {
                        "id": str(w.pk),
                        "full_name": w.full_name,
                        "phone": w.phone,
                        "verification_status": w.verification_status,
                        "district": w.current_district.name_en if w.current_district_id else None,
                        "payment_method": w.payment_method,
                        "has_user": bool(w.user_id),
                    }
                    for w in workers
                ],
                "organizations": [
                    {
                        "id": str(m.organization_id),
                        "name": m.organization.name,
                        "role": m.role,
                        "user_id": str(m.user_id),
                        "verification_status": m.organization.verification_status,
                    }
                    for m in memberships
                ],
                "open_cases": [case_payload(c, staff=True) for c in cases],
            }
        )


# --------------------------------------------------------------------------- help center
class HelpArticlePublicViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Public help center: ``GET /help/articles?audience=&q=&category=`` and ``/help/articles/{slug}``."""

    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = HelpArticleSerializer
    lookup_field = "slug"
    pagination_class = None

    def get_queryset(self):
        qs = HelpArticle.objects.filter(is_published=True)
        p = self.request.query_params
        if p.get("audience") in ("worker", "employer"):
            qs = qs.filter(audience__in=[p["audience"], "all"])
        if p.get("category"):
            qs = qs.filter(category=p["category"])
        if p.get("q"):
            q = p["q"].strip()
            qs = qs.filter(
                Q(title_en__icontains=q)
                | Q(title_ne__icontains=q)
                | Q(body_en__icontains=q)
                | Q(body_ne__icontains=q)
            )
        return qs.order_by("order", "title_en")


class OpsHelpArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOpsStaff]
    serializer_class = HelpArticleSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = HelpArticle.objects.select_related("updated_by")
        p = self.request.query_params
        if p.get("audience"):
            qs = qs.filter(audience=p["audience"])
        if p.get("q"):
            qs = qs.filter(Q(title_en__icontains=p["q"]) | Q(slug__icontains=p["q"]))
        return qs.order_by("order", "title_en")

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "staff": True}

    def perform_create(self, serializer):
        article = serializer.save(updated_by=self.request.user)
        log(
            self.request,
            "ops.help_article.create",
            article,
            organization=None,
            changes={"slug": article.slug},
        )

    def perform_update(self, serializer):
        article = serializer.save(updated_by=self.request.user)
        log(
            self.request,
            "ops.help_article.update",
            article,
            organization=None,
            changes={"fields": sorted(serializer.validated_data)},
        )

    def perform_destroy(self, instance):
        log(
            self.request,
            "ops.help_article.delete",
            instance,
            organization=None,
            changes={"slug": instance.slug},
        )
        instance.delete()
