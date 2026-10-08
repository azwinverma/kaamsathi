"""Maintenance mode for incidents: ``off`` | ``read_only`` (GET/HEAD only) | ``full`` (503 for all).

Set instantly (all workers, via the shared cache) with ``manage.py maintenance read_only|full|off``,
or persistently with the ``MAINTENANCE_MODE`` env setting. Health, readiness, metrics and the
Django admin are never blocked; ops staff can still sign in (``/auth/*``) in ``read_only``.
"""

from __future__ import annotations

import re

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse

CACHE_KEY = "ks:maintenance_mode"
MODES = ("off", "read_only", "full")
ALWAYS_OPEN = re.compile(r"^/(api/v1/)?(health|readiness|metrics)/?$")
READ_ONLY_OPEN = re.compile(r"^/api/v1/auth/")


def current_mode() -> str:
    try:
        mode = cache.get(CACHE_KEY)
    except Exception:  # noqa: BLE001 — cache down: fall back to env
        mode = None
    mode = mode or getattr(settings, "MAINTENANCE_MODE", "off") or "off"
    return mode if mode in MODES else "off"


def set_mode(mode: str) -> None:
    if mode not in MODES:
        raise ValueError(mode)
    cache.set(CACHE_KEY, mode, None)


class MaintenanceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith("/api/") and not ALWAYS_OPEN.match(path):
            mode = current_mode()
            blocked = mode == "full" or (
                mode == "read_only"
                and request.method not in ("GET", "HEAD", "OPTIONS")
                and not READ_ONLY_OPEN.match(path)
            )
            if blocked:
                from .exceptions import envelope

                resp = JsonResponse(envelope("maintenance"), status=503)
                resp["Retry-After"] = "300"
                return resp
        return self.get_response(request)
