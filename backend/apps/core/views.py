"""Cross-cutting endpoints: signed private file download and readiness probe."""

from __future__ import annotations

import hmac
import logging

from django.conf import settings
from django.core import signing
from django.core.files.storage import storages
from django.db import connection
from django.http import FileResponse, HttpResponseRedirect
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import APIError
from .files import content_type_for, read_token, recheck

logger = logging.getLogger("kaamsathi.files")

INLINE_TYPES = ("image/", "application/pdf")


class FileDownloadView(APIView):
    """GET /files/<token> — serve a private file to the holder of a valid, unexpired token.

    No Authorization header is needed (tokens are capability URLs issued after an access
    check), but if one is sent it must belong to the same user the token was issued to.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "files"

    @extend_schema(responses={200: bytes})
    def get(self, request, token: str):
        try:
            payload = read_token(token)
        except signing.SignatureExpired as exc:
            raise APIError("permission_denied", message=_("This link has expired."), status_code=403) from exc
        except signing.BadSignature as exc:
            raise APIError("not_found", status_code=404) from exc

        user = None
        uid = payload.get("u")
        if uid:
            from apps.accounts.models import User

            user = User.objects.filter(pk=uid, is_active=True).first()
            if user is None:
                raise APIError("permission_denied", status_code=403)
            req_user = getattr(request, "user", None)
            if req_user is not None and req_user.is_authenticated and str(req_user.pk) != uid:
                raise APIError("permission_denied", status_code=403)
        if not recheck(payload, user):
            raise APIError("permission_denied", status_code=403)

        alias = payload.get("s") or "default"
        if alias not in settings.STORAGES or alias == "staticfiles":
            raise APIError("not_found", status_code=404)
        storage = storages[alias]
        name = payload["n"]
        if not storage.exists(name):
            raise APIError("not_found", status_code=404)

        self._audit(request, payload, user)

        if getattr(settings, "FILES_S3_REDIRECT", False) and hasattr(storage, "bucket_name"):
            # Large files on S3: hand the client a 60-second presigned URL instead of streaming.
            resp = HttpResponseRedirect(storage.url(name, expire=60))
        else:
            ctype = content_type_for(name)
            resp = FileResponse(
                storage.open(name, "rb"),
                content_type=ctype,
                as_attachment=not ctype.startswith(INLINE_TYPES),
                filename=name.rsplit("/", 1)[-1],
            )
        resp["Cache-Control"] = "private, max-age=300"
        resp["X-Content-Type-Options"] = "nosniff"
        resp["Content-Security-Policy"] = (
            "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"
        )
        resp["Referrer-Policy"] = "no-referrer"
        resp["X-Robots-Tag"] = "noindex, nofollow"
        return resp

    def _audit(self, request, payload, user):
        """Identity documents: every view is written to the audit log."""
        check = payload.get("c") or ""
        if not (check.startswith("worker:") and check.rsplit(":", 1)[-1] in {"id_front", "id_back"}):
            return
        from apps.audit.models import AuditLog
        from apps.audit.services import client_ip

        _, worker_id, field = check.split(":", 2)
        AuditLog.objects.create(
            actor=user,
            action="worker.id_document.view",
            object_type="worker",
            object_id=worker_id,
            changes={"field": field},
            ip=client_ip(request),
        )


class CronView(APIView):
    """GET|POST /internal/cron — serverless scheduler tick (``apps/core/cron.py``).

    ``Authorization: Bearer <CRON_SECRET>`` (Vercel Cron sends exactly this). 404 when unset.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def _tick(self, request):
        secret = getattr(settings, "CRON_SECRET", "")
        if not secret:
            raise APIError("not_found", status_code=404)
        presented = request.META.get("HTTP_AUTHORIZATION", "")
        if not hmac.compare_digest(presented.encode(), f"Bearer {secret}".encode()):
            raise APIError("not_authenticated", status_code=401)
        from .cron import run_due

        return Response(run_due())

    @extend_schema(exclude=True)
    def get(self, request):
        return self._tick(request)

    @extend_schema(exclude=True)
    def post(self, request):
        return self._tick(request)


class ReadinessView(APIView):
    """GET /readiness — deep check (DB + Redis) for load balancers / deploy gates.

    ``/health`` stays cheap (liveness); this one may take a few hundred ms.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    @extend_schema(responses={200: dict, 503: dict})
    def get(self, request):
        checks = {"database": "ok", "cache": "ok"}
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
        except Exception:  # noqa: BLE001
            logger.exception("readiness: database unavailable")
            checks["database"] = "unavailable"
        try:
            from django.core.cache import cache

            cache.set("readiness-probe", "1", 10)
            if cache.get("readiness-probe") != "1":
                raise RuntimeError("cache round-trip failed")
        except Exception:  # noqa: BLE001
            logger.exception("readiness: cache/redis unavailable")
            checks["cache"] = "unavailable"
        ok = all(v == "ok" for v in checks.values())
        body = {"status": "ok" if ok else "degraded", **checks}
        release = getattr(settings, "RELEASE", "")
        if release:
            body["release"] = release
        return Response(body, status=200 if ok else 503)
