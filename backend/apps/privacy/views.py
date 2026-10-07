"""§11 privacy endpoints: /me/privacy-requests and /ops/privacy-requests."""

from django.http import FileResponse
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.audit.services import log
from apps.core.exceptions import APIError
from apps.core.permissions import IsOpsStaff

from . import services
from .models import PrivacyRequest
from .serializers import OpsPrivacyRequestSerializer, PrivacyRequestSerializer, ProcessSerializer


def _download(req: PrivacyRequest):
    if req.kind != "export" or not req.file_available:
        raise APIError("not_found", message=_("No export file is available."), status_code=404)
    resp = FileResponse(
        req.file.open("rb"),
        as_attachment=True,
        filename=f"kaamsathi-data-{req.created_at:%Y%m%d}.zip",
        content_type="application/zip",
    )
    resp["Cache-Control"] = "private, no-store"
    return resp


class MePrivacyRequestViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    serializer_class = PrivacyRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "privacy"

    def get_throttles(self):
        # Only creating a request is rate-limited (exports are expensive).
        if self.request.method == "POST":
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        return PrivacyRequest.objects.filter(user=self.request.user).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        req = services.create_request(request.user, s.validated_data["kind"], s.validated_data.get("details"))
        log(request, f"privacy.{req.kind}.requested", req)
        req.refresh_from_db()
        return Response(self.get_serializer(req).data, status=201)

    @extend_schema(responses={200: bytes})
    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        return _download(self.get_object())


class OpsPrivacyRequestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = OpsPrivacyRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsOpsStaff]

    def get_queryset(self):
        qs = PrivacyRequest.objects.select_related("worker", "user", "handled_by").order_by("-created_at")
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("kind"):
            qs = qs.filter(kind__in=p["kind"].split(","))
        return qs

    @extend_schema(request=ProcessSerializer, responses=OpsPrivacyRequestSerializer)
    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        req = self.get_object()
        s = ProcessSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        req = services.process_request(
            req, action=s.validated_data["action"], note=s.validated_data.get("note"), actor=request.user
        )
        log(request, f"privacy.{req.kind}.{s.validated_data['action']}", req)
        req.refresh_from_db()
        return Response(self.get_serializer(req).data)

    @extend_schema(responses={200: bytes})
    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        req = self.get_object()
        log(request, "privacy.export.downloaded_by_ops", req)
        return _download(req)
