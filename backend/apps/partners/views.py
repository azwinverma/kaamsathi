"""Partner API (/partner/*), worker consent endpoints (/me/*) and ops console (/ops/partners)."""

from __future__ import annotations

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import client_ip, diff, log, snapshot
from apps.core.exceptions import APIError
from apps.core.idempotency import idempotent
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsOpsStaff
from apps.workers.me_views import current_worker
from apps.workers.models import Worker

from .auth import HasPartnerScope, PartnerKeyAuthentication
from .models import ConsentGrant, Partner, PartnerAccessLog, PartnerAPIKey
from .serializers import (
    GrantCreateSerializer,
    KeyCreateSerializer,
    OpsPartnerSerializer,
    ReferralStatusSerializer,
    access_log_dict,
    grant_dict,
    key_dict,
    partner_public,
)
from .services import (
    active_grant,
    create_api_key,
    create_grant,
    ensure_webhook_secret,
    log_access,
    log_profile_view,
    max_grant_days,
    passport_payload,
    revoke_grant,
)

OPS_PERMS = [IsAuthenticated, IsOpsStaff]


def paginate(view, request, items, fn):
    paginator = StandardPagination()
    page = paginator.paginate_queryset(items, request, view=view)
    return paginator.get_paginated_response([fn(x) for x in page])


# =========================================================================== partner API
class PartnerAPIView(APIView):
    """Base for /partner/*: partner-key auth, per-view scope, access log on every request."""

    authentication_classes = [PartnerKeyAuthentication]
    permission_classes = [HasPartnerScope]
    required_scope: str | None = None
    throttle_scope = None

    def initial(self, request, *args, **kwargs):
        self._log_worker = None
        super().initial(request, *args, **kwargs)

    @property
    def partner(self) -> Partner:
        return self.request.auth.partner

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        key = getattr(request, "_auth", None)
        if isinstance(key, PartnerAPIKey):
            log_access(
                api_key=key,
                worker=getattr(self, "_log_worker", None),
                endpoint=request.path,
                method=request.method,
                scope=self.required_scope or "",
                status_code=response.status_code,
            )
        return response

    def worker_with_grant(self, worker_id) -> Worker:
        worker = Worker.objects.filter(pk=worker_id).first()
        if worker is None:
            raise NotFound()
        self._log_worker = worker
        if active_grant(worker, self.partner, self.required_scope) is None:
            raise PermissionDenied("No active consent grant from this worker covers this scope.")
        return worker


class PartnerWorkerProfileView(PartnerAPIView):
    required_scope = "profile.read"

    def get(self, request, worker_id):
        worker = self.worker_with_grant(worker_id)
        data = passport_payload(worker, request)
        log_profile_view(worker, self.partner)
        return Response(data)


class PartnerWorkerEarningsView(PartnerAPIView):
    required_scope = "earnings.read"

    def get(self, request, worker_id):
        from apps.finance.serializers import profile_dict
        from apps.finance.services import build_profile

        worker = self.worker_with_grant(worker_id)
        data = profile_dict(build_profile(worker))
        log_profile_view(worker, self.partner)
        return Response(data)


class PartnerWorkerMobilityView(PartnerAPIView):
    """Masked foreign-employment document summary (verified flags, kinds, expiry dates only).

    Readable only by an *eligible* recruitment agency (verified, unexpired licence) holding an
    active grant with ``mobility.read`` — a suspended or lapsed agency loses access immediately.
    """

    required_scope = "mobility.read"

    def get(self, request, worker_id):
        from apps.mobility.services import partner_summary

        worker = self.worker_with_grant(worker_id)
        if not self.partner.is_eligible_agency():
            raise PermissionDenied("Your agency licence is not verified or has expired.")
        data = partner_summary(worker)
        log_profile_view(worker, self.partner)
        # Actor is a partner key, not a Django user: record it in ``changes`` (request=None).
        log(
            None,
            "partner.mobility.read",
            worker,
            organization=None,
            changes={
                "partner": str(self.partner.pk),
                "key_prefix": request.auth.prefix,
                "ip": client_ip(request),
            },
        )
        return Response(data)


class PartnerGrantsView(PartnerAPIView):
    def get(self, request):
        qs = (
            ConsentGrant.objects.filter(partner=self.partner).select_related("worker").order_by("-granted_at")
        )
        status = request.query_params.get("status")
        now = timezone.now()
        if status == "active":
            qs = qs.active(now)
        elif status == "revoked":
            qs = qs.filter(revoked_at__isnull=False)
        elif status == "expired":
            qs = qs.filter(revoked_at__isnull=True, expires_at__lte=now)
        return paginate(self, request, qs, lambda g: grant_dict(g, for_partner=True))


class PartnerReferralsView(PartnerAPIView):
    def get(self, request):
        from apps.finance.models import Referral
        from apps.finance.serializers import referral_dict

        qs = Referral.objects.filter(partner=self.partner).select_related(
            "offer", "worker", "grant", "partner"
        )
        if request.query_params.get("status"):
            qs = qs.filter(status__in=request.query_params["status"].split(","))
        return paginate(self, request, qs, lambda r: referral_dict(r, audience="partner"))


class PartnerReferralStatusView(PartnerAPIView):
    required_scope = "referrals.write"

    @idempotent
    def post(self, request, referral_id):
        from apps.finance.models import Referral
        from apps.finance.serializers import referral_dict
        from apps.finance.services import partner_update_status

        referral = (
            Referral.objects.select_related("worker", "offer", "partner", "grant")
            .filter(pk=referral_id, partner=self.partner)
            .first()
        )
        if referral is None:
            raise NotFound()
        self._log_worker = referral.worker
        s = ReferralStatusSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        referral = partner_update_status(
            referral,
            status=s.validated_data["status"],
            partner_ref=s.validated_data.get("partner_ref"),
            amount_approved=s.validated_data.get("amount_approved"),
            note=s.validated_data.get("note"),
        )
        return Response(referral_dict(referral, audience="partner"))


# =========================================================================== worker (/me)
class MePartnersView(APIView):
    def get(self, request):
        current_worker(request)
        partners = Partner.objects.filter(is_active=True).prefetch_related("offers").order_by("kind", "name")
        out = []
        for p in partners:
            data = partner_public(p)
            data["offers"] = [
                {"id": str(o.id), "kind": o.kind, "title": o.title, "title_ne": o.title_ne or None}
                for o in p.offers.all()
                if o.is_active
            ]
            out.append(data)
        return Response(out)


class MeGrantsView(APIView):
    def get(self, request):
        worker = current_worker(request)
        qs = ConsentGrant.objects.filter(worker=worker).select_related("partner")
        status = request.query_params.get("status")
        if status == "active":
            qs = qs.active()
        return paginate(self, request, qs, grant_dict)

    def post(self, request):
        worker = current_worker(request)
        s = GrantCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        partner = Partner.objects.filter(pk=s.validated_data["partner_id"], is_active=True).first()
        if partner is None:
            raise APIError("validation_error", fields={"partner_id": [_("Partner not found.")]})
        days = s.validated_data["days"]
        if days > max_grant_days():
            raise APIError(
                "validation_error",
                fields={"days": [_("Must be between 1 and %(max)s days.") % {"max": max_grant_days()}]},
            )
        grant = create_grant(
            worker,
            partner,
            purpose=s.validated_data["purpose"],
            scopes=s.validated_data["scopes"],
            days=days,
            channel="app",
        )
        log(request, "partner.grant.create", grant, organization=None)
        return Response(grant_dict(grant), status=201)


class MeGrantRevokeView(APIView):
    def post(self, request, grant_id):
        worker = current_worker(request)
        grant = get_object_or_404(
            ConsentGrant.objects.select_related("partner", "worker"), pk=grant_id, worker=worker
        )
        grant = revoke_grant(grant, channel="app")
        log(request, "partner.grant.revoke", grant, organization=None)
        return Response(grant_dict(grant))


class MePartnerAccessView(APIView):
    def get(self, request):
        worker = current_worker(request)
        qs = PartnerAccessLog.objects.filter(worker=worker).select_related("partner")
        return paginate(self, request, qs, access_log_dict)


# =========================================================================== ops
class OpsPartnerViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = OPS_PERMS
    serializer_class = OpsPartnerSerializer
    http_method_names = ["get", "post", "patch"]
    lookup_value_regex = "[0-9a-f-]{36}"

    def get_queryset(self):
        now = timezone.now()
        qs = Partner.objects.annotate(
            n_active_keys=Count("api_keys", filter=Q(api_keys__revoked_at__isnull=True), distinct=True),
            n_active_grants=Count(
                "grants", filter=Q(grants__revoked_at__isnull=True, grants__expires_at__gt=now), distinct=True
            ),
            n_offers=Count("offers", distinct=True),
            n_referrals=Count("referrals", distinct=True),
        )
        p = self.request.query_params
        if p.get("kind"):
            qs = qs.filter(kind__in=p["kind"].split(","))
        if p.get("q"):
            qs = qs.filter(name__icontains=p["q"])
        if p.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=p["is_active"] == "true")
        return qs.order_by("name")

    def perform_create(self, serializer):
        partner = serializer.save()
        ensure_webhook_secret(partner)
        log(
            self.request,
            "ops.partner.create",
            partner,
            organization=None,
            changes={"after": snapshot(partner)},
        )

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        partner = Partner.objects.get(pk=response.data["id"])
        response.data["webhook_secret"] = partner.webhook_secret  # shown once
        return response

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        partner = serializer.save()
        changes = diff(before, snapshot(partner))
        changes.pop("webhook_secret", None)
        log(self.request, "ops.partner.update", partner, organization=None, changes=changes)

    @action(detail=True, methods=["get", "post"])
    def keys(self, request, pk=None):
        partner = self.get_object()
        if request.method == "GET":
            return Response([key_dict(k) for k in partner.api_keys.all()])
        s = KeyCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        key, full_key = create_api_key(
            partner, s.validated_data["scopes"], s.validated_data["name"], request.user
        )
        log(
            request,
            "ops.partner.key.create",
            key,
            organization=None,
            changes={"prefix": key.prefix, "scopes": key.scopes},
        )
        return Response({**key_dict(key), "key": full_key}, status=201)

    @action(detail=True, methods=["post"], url_path=r"keys/(?P<key_id>[0-9a-f-]{36})/revoke")
    def revoke_key(self, request, pk=None, key_id=None):
        partner = self.get_object()
        key = get_object_or_404(PartnerAPIKey, pk=key_id, partner=partner)
        if key.revoked_at is None:
            key.revoked_at = timezone.now()
            key.save(update_fields=["revoked_at"])
            log(request, "ops.partner.key.revoke", key, organization=None, changes={"prefix": key.prefix})
        return Response(key_dict(key))

    @action(detail=True, methods=["get"], url_path="access-log")
    def access_log(self, request, pk=None):
        partner = self.get_object()
        qs = PartnerAccessLog.objects.filter(partner=partner).select_related("partner", "worker", "api_key")
        if request.query_params.get("worker"):
            qs = qs.filter(worker_id=request.query_params["worker"])
        return paginate(self, request, qs, lambda r: access_log_dict(r, with_worker=True))

    @action(detail=True, methods=["get"])
    def grants(self, request, pk=None):
        partner = self.get_object()
        qs = ConsentGrant.objects.filter(partner=partner).select_related("worker", "partner")
        if request.query_params.get("status") == "active":
            qs = qs.active()
        return paginate(self, request, qs, lambda g: grant_dict(g, for_partner=True))

    @action(detail=True, methods=["post"], url_path="rotate-webhook-secret")
    def rotate_webhook_secret(self, request, pk=None):
        partner = self.get_object()
        partner.webhook_secret = ""
        secret = ensure_webhook_secret(partner)
        log(request, "ops.partner.webhook_secret.rotate", partner, organization=None)
        return Response({"webhook_secret": secret})
