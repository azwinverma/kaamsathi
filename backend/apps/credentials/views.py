"""Credentials & Skill Passport endpoints (docs/CONTRACT-ECOSYSTEM.md §3)."""

from __future__ import annotations

import re

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.audit.services import log, snapshot
from apps.core.exceptions import APIError, InvalidState
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsOpsStaff, OrgScopedMixin
from apps.workers.me_views import current_worker
from apps.workers.models import Worker

from . import services
from .models import Credential, PassportShare, SkillAssessment
from .pdf import passport_pdf
from .serializers import (
    AssessmentSerializer,
    CredentialSerializer,
    ExpiringCredentialSerializer,
    OpsCredentialSerializer,
    PassportSerializer,
    PassportShareSerializer,
    VerifyCredentialSerializer,
)
from .verifiers import NotConfigured

OPS_PERMS = [IsAuthenticated, IsOpsStaff]
CODE_RE = re.compile(r"^[a-z0-9]{10}$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{32}$")


# --- worker (/me) -----------------------------------------------------------------------------


class MeCredentialViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CredentialSerializer

    def get_queryset(self):
        return Credential.objects.filter(worker=current_worker(self.request)).order_by("-created_at")

    def perform_create(self, serializer):
        cred = serializer.save(worker=current_worker(self.request), status="pending")
        log(self.request, "credential.create", cred, organization=None, changes={"after": snapshot(cred)})

    def perform_destroy(self, instance):
        if instance.status != "pending":
            raise InvalidState(message=_("Only credentials waiting for verification can be deleted."))
        log(
            self.request,
            "credential.delete",
            instance,
            organization=None,
            changes={"before": snapshot(instance)},
        )
        if instance.document:
            instance.document.delete(save=False)
        instance.delete()


class MePassportView(APIView):
    def _response(self, request, passport):
        data = PassportSerializer(passport).data
        data["payload"] = services.passport_payload(
            passport.worker,
            include_contact=passport.show_contact,
            verify_url=services.public_url(passport),
            request=request,
        )
        return Response(data)

    def get(self, request):
        return self._response(request, services.get_passport(current_worker(request)))

    def patch(self, request):
        passport = services.get_passport(current_worker(request))
        s = PassportSerializer(passport, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        log(request, "passport.update", passport, organization=None, changes=dict(s.validated_data))
        return self._response(request, passport)


class MePassportPDFView(APIView):
    def get(self, request):
        worker = current_worker(request)
        passport = services.get_passport(worker)
        payload = services.passport_payload(
            worker,
            include_contact=passport.show_contact,
            verify_url=services.public_url(passport),
            request=request,
        )
        pdf = passport_pdf(payload)
        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="kaamsathi-passport-{passport.public_code}.pdf"'
        return resp


class MePassportShareViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = PassportShareSerializer

    def get_queryset(self):
        return PassportShare.objects.filter(worker=current_worker(self.request)).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        share = services.create_share(
            current_worker(request),
            audience_label=d["audience_label"],
            purpose=d.get("purpose", "job"),
            days=d.get("days", 30),
            include_contact=d.get("include_contact", False),
        )
        log(request, "passport.share.create", share, organization=None, changes={"after": snapshot(share)})
        return Response(self.get_serializer(share).data, status=201)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        share = self.get_object()
        if share.revoked_at is None:
            share.revoked_at = timezone.now()
            share.save(update_fields=["revoked_at"])
            log(request, "passport.share.revoke", share, organization=None)
        return Response(self.get_serializer(share).data)


# --- public (no auth) -------------------------------------------------------------------------


class _PublicView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    @staticmethod
    def respond(payload):
        resp = Response(payload)
        resp["X-Robots-Tag"] = "noindex, nofollow"
        resp["Cache-Control"] = "no-store"
        return resp


class PublicPassportView(_PublicView):
    def get(self, request, code):
        from .models import Passport

        if not CODE_RE.match(code or ""):
            raise NotFound()
        passport = Passport.objects.select_related("worker").filter(public_code=code, is_public=True).first()
        if passport is None:
            raise NotFound()
        services.log_profile_view(passport.worker, context="passport")
        return self.respond(
            services.passport_payload(
                passport.worker,
                include_contact=passport.show_contact,
                verify_url=services.public_url(passport),
                request=request,
            )
        )


class PublicShareView(_PublicView):
    def get(self, request, token):
        if not TOKEN_RE.match(token or ""):
            raise NotFound()
        share = services.active_share(token)
        if share is None:
            raise NotFound()
        services.register_share_view(share)
        services.log_profile_view(share.worker, context="passport", object_id=str(share.id))
        payload = services.passport_payload(
            share.worker,
            include_contact=share.include_contact,
            verify_url=services.share_url(share),
            request=request,
        )
        payload["share"] = {
            "audience_label": share.audience_label,
            "purpose": share.purpose,
            "expires_at": timezone.localtime(share.expires_at).isoformat(),
        }
        return self.respond(payload)


def qr_svg_response(url: str) -> HttpResponse:
    import qrcode
    import qrcode.image.svg

    img = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2)
    resp = HttpResponse(img.to_string(encoding="unicode"), content_type="image/svg+xml")
    resp["X-Robots-Tag"] = "noindex, nofollow"
    resp["Cache-Control"] = "no-store"
    return resp


class PublicPassportQRView(_PublicView):
    """QR (SVG) pointing at the public passport URL. Same 404 rules; not counted as a view."""

    def get(self, request, code):
        from .models import Passport

        if not CODE_RE.match(code or ""):
            raise NotFound()
        passport = Passport.objects.filter(public_code=code, is_public=True).first()
        if passport is None:
            raise NotFound()
        return qr_svg_response(services.public_url(passport))


class PublicShareQRView(_PublicView):
    def get(self, request, token):
        if not TOKEN_RE.match(token or ""):
            raise NotFound()
        share = services.active_share(token)
        if share is None:
            raise NotFound()
        return qr_svg_response(services.share_url(share))


# --- employer (/org) --------------------------------------------------------------------------


class OrgExpiringCredentialsView(OrgScopedMixin, APIView):
    def get(self, request):
        raw = request.query_params.get("days", "30")
        try:
            days = int(raw)
            if not 1 <= days <= 365:
                raise ValueError
        except ValueError as exc:
            raise APIError(
                "validation_error", fields={"days": [_("Enter a number of days from 1 to 365.")]}
            ) from exc
        qs = services.expiring_for_org(self.org, days)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        data = ExpiringCredentialSerializer(page, many=True, context={"request": request}).data
        return paginator.get_paginated_response(data)


# --- ops --------------------------------------------------------------------------------------


class OpsCredentialViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = OPS_PERMS
    serializer_class = OpsCredentialSerializer
    ordering_fields = ["created_at", "expires_on", "issued_on"]

    def get_queryset(self):
        qs = Credential.objects.select_related("worker", "verified_by")
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("kind"):
            qs = qs.filter(kind__in=p["kind"].split(","))
        if p.get("worker"):
            qs = qs.filter(worker_id=p["worker"])
        if p.get("q"):
            q = p["q"]
            qs = qs.filter(
                Q(worker__full_name__icontains=q)
                | Q(worker__phone__contains=q)
                | Q(title__icontains=q)
                | Q(certificate_no__icontains=q)
                | Q(issuer__icontains=q)
            )
        # Oldest pending first: it is a queue.
        return qs.order_by("created_at") if p.get("status") == "pending" else qs.order_by("-created_at")

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        cred = self.get_object()
        s = VerifyCredentialSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        old = cred.status
        try:
            services.verify_credential(
                cred,
                status=s.validated_data["status"],
                method=s.validated_data["method"],
                note=s.validated_data.get("note") or "",
                user=request.user,
            )
        except NotConfigured as exc:
            raise InvalidState(
                message=_(
                    "Registry verification is not available yet. Verify by document or a call to the issuer."
                )
            ) from exc
        log(
            request,
            "ops.credential.verify",
            cred,
            organization=None,
            changes={"status": {"from": old, "to": cred.status}, "method": cred.verification_method},
        )
        return Response(self.get_serializer(cred).data)


class OpsAssessmentViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    permission_classes = OPS_PERMS
    serializer_class = AssessmentSerializer

    def get_queryset(self):
        qs = SkillAssessment.objects.select_related("worker", "trade", "assessor_user", "assessor_partner")
        p = self.request.query_params
        if p.get("worker"):
            qs = qs.filter(worker_id=p["worker"])
        if p.get("trade"):
            qs = qs.filter(trade_id=p["trade"])
        if p.get("result"):
            qs = qs.filter(result=p["result"])
        return qs.order_by("-assessed_on", "-created_at")

    def perform_create(self, serializer):
        a = serializer.save(assessor_user=self.request.user)
        log(self.request, "ops.assessment.create", a, organization=None, changes={"after": snapshot(a)})
        services.recompute_trust(a.worker)


class OpsWorkerCredentialsView(APIView):
    permission_classes = OPS_PERMS

    def get(self, request, worker_id):
        worker = get_object_or_404(Worker, pk=worker_id)
        ctx = {"request": request}
        creds = Credential.objects.filter(worker=worker).select_related("worker", "verified_by")
        assessments = SkillAssessment.objects.filter(worker=worker).select_related(
            "worker", "trade", "assessor_user", "assessor_partner"
        )
        from .models import Passport

        passport = Passport.objects.filter(worker=worker).first()
        active_shares = PassportShare.objects.filter(
            worker=worker, revoked_at__isnull=True, expires_at__gt=timezone.now()
        ).count()
        return Response(
            {
                "credentials": OpsCredentialSerializer(creds, many=True, context=ctx).data,
                "assessments": AssessmentSerializer(assessments, many=True, context=ctx).data,
                "passport": PassportSerializer(passport).data if passport else None,
                "active_shares": active_shares,
            }
        )
