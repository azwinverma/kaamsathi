"""Error envelope: ``{"error": {"code", "message", "fields"}}`` for every failure."""

from __future__ import annotations

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404, JsonResponse
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .labels import ERROR_MESSAGES

logger = logging.getLogger("kaamsathi.errors")


class APIError(exceptions.APIException):
    """Domain error with an explicit contract code."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "validation_error"

    def __init__(self, code: str | None = None, message=None, fields=None, status_code=None):
        self.code = code or self.default_code
        if status_code is not None:
            self.status_code = status_code
        self.message = message
        self.fields = fields or {}
        super().__init__(detail=str(message or ERROR_MESSAGES.get(self.code, self.code)))


class OrgForbidden(APIError):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "org_forbidden"


class InvalidState(APIError):
    default_code = "invalid_state"


class BelowMinimumWage(APIError):
    default_code = "below_minimum_wage"


class Duplicate(APIError):
    default_code = "duplicate"


class OutsideGeofence(APIError):
    default_code = "outside_geofence"


def _message(code: str, explicit=None) -> str:
    if explicit:
        return str(explicit)
    return str(ERROR_MESSAGES.get(code, code))


def _flatten_fields(detail) -> dict:
    """DRF ValidationError detail → {"field": ["msg", ...]}."""
    if isinstance(detail, dict):
        out = {}
        for key, value in detail.items():
            if isinstance(value, dict):
                for sub_key, sub_val in _flatten_fields(value).items():
                    out[f"{key}.{sub_key}"] = sub_val
            elif isinstance(value, list) and value and isinstance(value[0], dict):
                for idx, item in enumerate(value):
                    for sub_key, sub_val in _flatten_fields(item).items():
                        out[f"{key}.{idx}.{sub_key}"] = sub_val
            elif isinstance(value, list):
                out[key] = [str(v) for v in value]
            else:
                out[key] = [str(value)]
        return out
    if isinstance(detail, list):
        return {"non_field_errors": [str(v) for v in detail]}
    return {"non_field_errors": [str(detail)]}


def _all_codes(codes):
    if isinstance(codes, dict):
        for value in codes.values():
            yield from _all_codes(value)
    elif isinstance(codes, list):
        for value in codes:
            yield from _all_codes(value)
    else:
        yield codes


def envelope(code: str, message=None, fields=None) -> dict:
    from .request_id import get_request_id

    error = {"code": code, "message": _message(code, message), "fields": fields or {}}
    rid = get_request_id()
    if rid:
        error["request_id"] = rid
    return {"error": error}


def exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
    elif isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()
    elif isinstance(exc, TokenError):
        exc = InvalidToken(str(exc))

    if isinstance(exc, APIError):
        return Response(envelope(exc.code, exc.message, exc.fields), status=exc.status_code)

    response = drf_exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(envelope("server_error"), status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    fields = {}
    message = None
    if isinstance(exc, exceptions.ValidationError):
        code = "validation_error"
        fields = _flatten_fields(exc.detail)
        # Surface domain codes raised inside serializers (e.g. below_minimum_wage).
        for c in _all_codes(exc.get_codes()):
            if c in ("below_minimum_wage", "duplicate", "invalid_state"):
                code = c
            elif c == "unique" and code == "validation_error":
                code = "duplicate"
        if fields.keys() == {"non_field_errors"} and len(fields["non_field_errors"]) == 1:
            message = fields["non_field_errors"][0]
        elif code != "validation_error":
            message = next(iter(fields.values()))[0]
    elif isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        code = "not_authenticated"
        response.status_code = status.HTTP_401_UNAUTHORIZED
    elif isinstance(exc, exceptions.PermissionDenied):
        code = "permission_denied"
    elif isinstance(exc, exceptions.NotFound):
        code = "not_found"
    elif isinstance(exc, exceptions.Throttled):
        view = context.get("view")
        code = "otp_rate_limited" if getattr(view, "throttle_scope", None) == "otp" else "throttled"
    elif isinstance(exc, exceptions.MethodNotAllowed):
        code, message = "invalid_state", str(exc.detail)
    elif isinstance(exc, (exceptions.ParseError, exceptions.UnsupportedMediaType)):
        code, message = "validation_error", str(exc.detail)
    else:
        code = getattr(exc, "default_code", "error")
        message = str(getattr(exc, "detail", ""))
    response.data = envelope(code, message, fields)
    return response


def json_404(request, exception=None):
    return JsonResponse(envelope("not_found"), status=404)


def json_500(request):
    return JsonResponse(envelope("server_error"), status=500)
