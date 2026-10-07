"""Partner API authentication: ``Authorization: Partner ks_<prefix>_<secret>``.

Only a SHA-256 hash of the full key is stored. Lookup is by the 8-char prefix, then the hash is
compared in constant time. Revoked keys and inactive partners are rejected with 401.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import string

from django.utils import timezone
from rest_framework import authentication, exceptions, permissions

from .models import PartnerAPIKey

KEYWORD = "Partner"
_ALPHABET = string.ascii_lowercase + string.digits


def hash_key(full_key: str) -> str:
    return hashlib.sha256(full_key.encode()).hexdigest()


def generate_key() -> tuple[str, str]:
    """Return ``(full_key, prefix)``; the prefix is unique among stored keys."""
    while True:
        prefix = "".join(secrets.choice(_ALPHABET) for _ in range(8))
        if not PartnerAPIKey.objects.filter(prefix=prefix).exists():
            break
    return f"ks_{prefix}_{secrets.token_urlsafe(32)}", prefix


def parse_key(full_key: str) -> str | None:
    """Return the prefix of a well-formed key, else None."""
    parts = full_key.split("_", 2)
    if len(parts) != 3 or parts[0] != "ks" or len(parts[1]) != 8 or not parts[2]:
        return None
    return parts[1]


class PartnerPrincipal:
    """``request.user`` for partner requests (not a Django user; no org/ops access)."""

    is_authenticated = True
    is_anonymous = False
    is_staff = False
    is_superuser = False
    is_active = True

    def __init__(self, api_key: PartnerAPIKey):
        self.api_key = api_key
        self.partner = api_key.partner
        self.pk = self.id = f"partner:{api_key.pk}"

    def __str__(self):
        return f"Partner {self.partner.name}"


class PartnerKeyAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode(errors="ignore")
        parts = header.split()
        if not parts or parts[0] != KEYWORD:
            return None
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed("Invalid partner key header.")
        full_key = parts[1]
        prefix = parse_key(full_key)
        if prefix is None:
            raise exceptions.AuthenticationFailed("Invalid partner key.")
        key = PartnerAPIKey.objects.select_related("partner").filter(prefix=prefix).first()
        # Hash compare even when the prefix is unknown, to keep timing uniform.
        expected = key.key_hash if key else "0" * 64
        if not hmac.compare_digest(expected, hash_key(full_key)) or key is None:
            raise exceptions.AuthenticationFailed("Invalid partner key.")
        if key.revoked_at is not None:
            raise exceptions.AuthenticationFailed("This partner key has been revoked.")
        if not key.partner.is_active:
            raise exceptions.AuthenticationFailed("This partner is not active.")
        now = timezone.now()
        if key.last_used_at is None or (now - key.last_used_at).total_seconds() > 60:
            PartnerAPIKey.objects.filter(pk=key.pk).update(last_used_at=now)
        return PartnerPrincipal(key), key

    def authenticate_header(self, request):
        return KEYWORD


class HasPartnerScope(permissions.BasePermission):
    """Requires a partner key holding ``view.required_scope`` (if the view sets one)."""

    def has_permission(self, request, view):
        key = request.auth
        if not isinstance(key, PartnerAPIKey):
            return False
        scope = getattr(view, "required_scope", None)
        if scope and scope not in (key.scopes or []):
            raise exceptions.PermissionDenied(f"This key lacks the '{scope}' scope.")
        return True
