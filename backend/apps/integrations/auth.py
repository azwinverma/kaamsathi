"""Enterprise API authentication: ``Authorization: Org ks_org_<prefix>_<secret>``.

Mirrors ``apps.partners.auth``: only a SHA-256 hash of the full key is stored, lookup is by the
8-char prefix and the hash is compared in constant time. Revoked keys and inactive orgs → 401.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import string

from django.utils import timezone
from rest_framework import authentication, exceptions, permissions

from .models import OrgAPIKey

KEYWORD = "Org"
_ALPHABET = string.ascii_lowercase + string.digits


def hash_key(full_key: str) -> str:
    return hashlib.sha256(full_key.encode()).hexdigest()


def generate_key() -> tuple[str, str]:
    """Return ``(full_key, prefix)``; the prefix is unique among stored keys."""
    while True:
        prefix = "".join(secrets.choice(_ALPHABET) for _ in range(8))
        if not OrgAPIKey.objects.filter(prefix=prefix).exists():
            break
    return f"ks_org_{prefix}_{secrets.token_urlsafe(32)}", prefix


def parse_key(full_key: str) -> str | None:
    """Return the prefix of a well-formed key, else None."""
    parts = full_key.split("_", 3)
    if len(parts) != 4 or parts[0] != "ks" or parts[1] != "org" or len(parts[2]) != 8 or not parts[3]:
        return None
    return parts[2]


class OrgKeyPrincipal:
    """``request.user`` for enterprise requests (not a Django user; no /org or /ops access)."""

    is_authenticated = True
    is_anonymous = False
    is_staff = False
    is_superuser = False
    is_active = True
    full_name = ""
    phone = ""

    def __init__(self, api_key: OrgAPIKey):
        self.api_key = api_key
        self.organization = api_key.organization
        self.pk = self.id = f"orgkey:{api_key.pk}"

    def __str__(self):
        return f"API key {self.api_key.name} ({self.organization.name})"


class OrgKeyAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode(errors="ignore")
        parts = header.split()
        if not parts or parts[0] != KEYWORD:
            return None
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed("Invalid API key header.")
        full_key = parts[1]
        prefix = parse_key(full_key)
        if prefix is None:
            raise exceptions.AuthenticationFailed("Invalid API key.")
        key = OrgAPIKey.objects.select_related("organization").filter(prefix=prefix).first()
        expected = key.key_hash if key else "0" * 64
        if not hmac.compare_digest(expected, hash_key(full_key)) or key is None:
            raise exceptions.AuthenticationFailed("Invalid API key.")
        if key.revoked_at is not None:
            raise exceptions.AuthenticationFailed("This API key has been revoked.")
        if not key.organization.is_active:
            raise exceptions.AuthenticationFailed("This organization is not active.")
        now = timezone.now()
        if key.last_used_at is None or (now - key.last_used_at).total_seconds() > 60:
            OrgAPIKey.objects.filter(pk=key.pk).update(last_used_at=now)
        return OrgKeyPrincipal(key), key

    def authenticate_header(self, request):
        return KEYWORD


class HasOrgScope(permissions.BasePermission):
    """Requires an org key holding the scope for the method (``view.required_scopes[method]``)."""

    def has_permission(self, request, view):
        key = request.auth
        if not isinstance(key, OrgAPIKey):
            return False
        scopes = getattr(view, "required_scopes", {}) or {}
        scope = scopes.get(request.method.lower())
        if scope is None and request.method not in permissions.SAFE_METHODS:
            raise exceptions.PermissionDenied("This endpoint is read-only.")
        if scope and scope not in (key.scopes or []):
            raise exceptions.PermissionDenied(f"This key lacks the '{scope}' scope.")
        return True
