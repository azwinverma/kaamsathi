"""``Idempotency-Key`` support for retried POSTs (flaky mobile networks, double clicks).

Decorate a DRF view method (APIView ``post`` or a viewset ``create``/``@action``)::

    @idempotent
    def create(self, request, *args, **kwargs): ...

When the request carries ``Idempotency-Key`` (≤ 100 chars), the first response (status < 500) is
stored for ``IDEMPOTENCY_TTL_HOURS`` under (principal, method, path, key). A retry with the same key
and the same body gets the stored response back with ``Idempotent-Replayed: true``; the same key
with a different body → 409 ``idempotency_conflict`` (also while the first request is still running).
Requests without the header behave exactly as before.
"""

from __future__ import annotations

import datetime as dt
import functools
import hashlib
import json

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.response import Response

from .exceptions import APIError

HEADER = "Idempotency-Key"
REPLAY_HEADER = "Idempotent-Replayed"
MAX_KEY_LEN = 100


def _ttl() -> dt.timedelta:
    return dt.timedelta(hours=getattr(settings, "IDEMPOTENCY_TTL_HOURS", 24))


def _principal(request) -> str:
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False) and getattr(user, "pk", None):
        kind = "partner" if type(user).__name__.lower().startswith("partner") else "user"
        return f"{kind}:{user.pk}"
    for attr in ("partner", "org_api_key", "api_key"):
        obj = getattr(request, attr, None) or getattr(getattr(request, "_request", None), attr, None)
        if obj is not None and getattr(obj, "pk", None):
            return f"{attr}:{obj.pk}"
    auth = getattr(request, "auth", None)
    if auth is not None and getattr(auth, "pk", None):
        return f"{type(auth).__name__.lower()}:{auth.pk}"
    from apps.audit.services import client_ip

    return f"anon:{client_ip(request) or '-'}"


def _jsonable_data(data):
    if hasattr(data, "lists"):  # QueryDict / MultiValueDict (multipart)
        out = {}
        for k, values in data.lists():
            out[k] = [
                {"file": getattr(v, "name", ""), "size": getattr(v, "size", None)}
                if hasattr(v, "read")
                else v
                for v in values
            ]
        return out
    return data


def body_hash(request) -> str:
    try:
        data = _jsonable_data(request.data)
        files = getattr(request, "FILES", None)
        if files:
            data = {"data": data, "files": _jsonable_data(files)}
        raw = json.dumps(data, sort_keys=True, default=str, separators=(",", ":"))
    except Exception:  # noqa: BLE001
        raw = ""
    return hashlib.sha256(raw.encode()).hexdigest()


def _replay(record) -> Response:
    resp = Response(record.response_body, status=record.status_code)
    resp[REPLAY_HEADER] = "true"
    return resp


def idempotent(view_method):
    @functools.wraps(view_method)
    def wrapper(self, request, *args, **kwargs):
        key = (request.headers.get(HEADER) or "").strip()
        if not key:
            return view_method(self, request, *args, **kwargs)
        if len(key) > MAX_KEY_LEN:
            raise APIError("validation_error", fields={HEADER: [f"At most {MAX_KEY_LEN} characters."]})
        from .models import IdempotencyRecord

        ident = {
            "principal": _principal(request),
            "method": request.method.upper(),
            "path": request.path[:300],
            "key": key,
        }
        digest = body_hash(request)
        IdempotencyRecord.objects.filter(**ident, created_at__lt=timezone.now() - _ttl()).delete()
        try:
            with transaction.atomic():
                record = IdempotencyRecord.objects.create(**ident, body_hash=digest)
        except IntegrityError:
            existing = IdempotencyRecord.objects.filter(**ident).first()
            if existing is None:  # raced with a purge — just run
                return view_method(self, request, *args, **kwargs)
            if existing.body_hash != digest:
                raise APIError(
                    "idempotency_conflict",
                    message="This Idempotency-Key was already used with a different request.",
                    status_code=409,
                ) from None
            if existing.status_code is None and existing.created_at < timezone.now() - dt.timedelta(
                minutes=5
            ):
                existing.delete()  # abandoned (worker killed mid-request) — run again
                return wrapper(self, request, *args, **kwargs)
            if existing.status_code is None:
                raise APIError(
                    "idempotency_conflict",
                    message="A request with this Idempotency-Key is still being processed.",
                    status_code=409,
                ) from None
            return _replay(existing)

        try:
            response = view_method(self, request, *args, **kwargs)
        except BaseException:
            try:
                IdempotencyRecord.objects.filter(pk=record.pk).delete()
            except Exception:  # noqa: BLE001 — broken transaction; the TTL purge cleans up
                pass
            raise
        status = getattr(response, "status_code", 500)
        if status >= 500 or not isinstance(response, Response):
            IdempotencyRecord.objects.filter(pk=record.pk).delete()
            return response
        try:
            body = json.loads(json.dumps(response.data, default=str))
        except (TypeError, ValueError):
            IdempotencyRecord.objects.filter(pk=record.pk).delete()
            return response
        IdempotencyRecord.objects.filter(pk=record.pk).update(status_code=status, response_body=body)
        return response

    wrapper.idempotent = True
    return wrapper


def purge_expired() -> int:
    from .models import IdempotencyRecord

    deleted, _ = IdempotencyRecord.objects.filter(created_at__lt=timezone.now() - _ttl()).delete()
    return deleted
