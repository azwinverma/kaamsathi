"""Login sessions / devices: one ``SessionDevice`` per refresh-token family.

The session id travels as the ``sid`` claim in both refresh and access tokens (SimpleJWT copies
custom claims to the access token and keeps them across refresh rotation). Revoking a session
blacklists its current refresh token and marks the ``sid`` revoked in the cache for the lifetime of
an access token, so ``SessionJWTAuthentication`` rejects its access tokens immediately as well.
"""

from __future__ import annotations

import re

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SessionDevice

REVOKED_KEY = "ks-sid-revoked:{}"


def _platform(request) -> str:
    explicit = (request.headers.get("X-Client-Platform") or "").strip().lower() if request else ""
    if explicit in {"web", "android", "ios"}:
        return explicit
    ua = (request.META.get("HTTP_USER_AGENT") or "") if request else ""
    if re.search(r"iphone|ipad|ios", ua, re.I):
        return "ios"
    if re.search(r"android|okhttp", ua, re.I):
        return "android"
    if ua.startswith("Mozilla/"):
        return "web"
    return "other"


def _ip(request):
    from apps.audit.services import client_ip

    return client_ip(request)


def issue_tokens(user, request=None) -> dict:
    """Create a session and return ``{access, refresh}`` carrying its ``sid``."""
    device = SessionDevice.objects.create(
        user=user,
        jti="",
        user_agent=((request.META.get("HTTP_USER_AGENT") or "") if request else "")[:300],
        ip=_ip(request),
        platform=_platform(request),
    )
    refresh = RefreshToken.for_user(user)
    refresh["sid"] = str(device.pk)
    device.jti = refresh["jti"]
    device.save(update_fields=["jti"])
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def is_revoked(sid) -> bool:
    return bool(sid) and bool(cache.get(REVOKED_KEY.format(sid)))


def touch_after_refresh(refresh_str: str, request=None) -> None:
    """Record the rotated refresh jti + last seen on the session (called by the refresh view)."""
    try:
        token = RefreshToken(refresh_str)  # just minted by the refresh view
    except Exception:  # noqa: BLE001
        return
    sid = token.get("sid")
    if not sid:
        return
    SessionDevice.objects.filter(pk=sid, revoked_at__isnull=True).update(
        jti=token["jti"], last_seen_at=timezone.now(), ip=_ip(request)
    )


def session_for_token(token):
    """Session of an already-validated token object (refresh or access)."""
    sid = token.get("sid")
    return SessionDevice.objects.filter(pk=sid).first() if sid else None


def _blacklist_jti(jti: str) -> None:
    if not jti:
        return
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    for outstanding in OutstandingToken.objects.filter(jti=jti):
        BlacklistedToken.objects.get_or_create(token=outstanding)


def revoke(device: SessionDevice) -> None:
    if device.revoked_at is None:
        device.revoked_at = timezone.now()
        device.save(update_fields=["revoked_at"])
    _blacklist_jti(device.jti)
    ttl = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()) + 60
    cache.set(REVOKED_KEY.format(device.pk), 1, ttl)


def revoke_all(user, except_id=None) -> int:
    qs = SessionDevice.objects.filter(user=user, revoked_at__isnull=True)
    if except_id:
        qs = qs.exclude(pk=except_id)
    n = 0
    for device in qs:
        revoke(device)
        n += 1
    return n


def current_sid(request):
    auth = getattr(request, "auth", None)
    try:
        return auth.get("sid") if auth is not None else None
    except AttributeError:
        return None


class SessionJWTAuthentication(JWTAuthentication):
    """JWT auth that also refuses access tokens of revoked sessions."""

    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        if is_revoked(token.get("sid")):
            raise AuthenticationFailed("Session has been signed out.", code="session_revoked")
        return token
