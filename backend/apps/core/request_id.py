"""Request IDs: accept ``X-Request-ID`` (≤ 64 safe chars) or generate a uuid4.

The id is echoed on every response, attached to log records (``request_id``), set as a Sentry tag
and added to the error envelope (``error.request_id``). The web BFF forwards the browser's id.
Also records request metrics (``apps.core.metrics``).
"""

from __future__ import annotations

import contextvars
import logging
import re
import time
import uuid

HEADER = "X-Request-ID"
_SAFE = re.compile(r"^[A-Za-z0-9._\-]{1,64}$")
_current: contextvars.ContextVar[str | None] = contextvars.ContextVar("ks_request_id", default=None)


def get_request_id() -> str | None:
    return _current.get()


def set_request_id(value: str | None):
    return _current.set(value)


def clean(value: str | None) -> str:
    value = (value or "").strip()
    return value if _SAFE.match(value) else uuid.uuid4().hex


class RequestIDFilter(logging.Filter):
    """Adds ``record.request_id`` (or None) so formatters can include it."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not getattr(record, "request_id", None):
            record.request_id = get_request_id()
        return True


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        rid = clean(request.META.get("HTTP_X_REQUEST_ID"))
        request.request_id = rid
        token = set_request_id(rid)
        _sentry_tag(rid)
        started = time.perf_counter()
        try:
            response = self.get_response(request)
        finally:
            _current.reset(token)
        response[HEADER] = rid
        _record_metrics(request, response, time.perf_counter() - started)
        return response


def _sentry_tag(rid: str) -> None:
    try:
        import sentry_sdk

        sentry_sdk.set_tag("request_id", rid)
    except Exception:  # noqa: BLE001 — sentry optional
        pass


def _record_metrics(request, response, seconds: float) -> None:
    try:
        from . import metrics

        metrics.observe_request(request, response.status_code, seconds)
    except Exception:  # noqa: BLE001 — metrics must never break a request
        logging.getLogger("kaamsathi.metrics").debug("metrics failed", exc_info=True)
