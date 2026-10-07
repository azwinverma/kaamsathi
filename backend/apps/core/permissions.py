"""Org scoping (``X-Org-Id``) and role-based permissions."""

from __future__ import annotations

import uuid

from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from .exceptions import OrgForbidden

OWNER, ADMIN, HR, SUPERVISOR = "owner", "admin", "hr", "supervisor"
ALL_ROLES = frozenset({OWNER, ADMIN, HR, SUPERVISOR})
MANAGERS = frozenset({OWNER, ADMIN, HR})
ADMINS = frozenset({OWNER, ADMIN})


def resolve_membership(request):
    """Return the active Membership for ``X-Org-Id`` or raise 403 org_forbidden."""
    cached = getattr(request, "_ks_membership", None)
    if cached is not None:
        return cached
    from apps.orgs.models import Membership

    raw = request.headers.get("X-Org-Id", "").strip()
    try:
        org_id = uuid.UUID(raw)
    except (ValueError, TypeError) as exc:
        raise OrgForbidden() from exc
    membership = (
        Membership.objects.select_related("organization")
        .filter(
            user=request.user,
            organization_id=org_id,
            is_active=True,
            organization__is_active=True,
        )
        .first()
    )
    if membership is None:
        raise OrgForbidden()
    request._ks_membership = membership
    return membership


class OrgPermission(permissions.BasePermission):
    """Requires X-Org-Id membership and a role allowed for the current action."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        membership = resolve_membership(request)
        allowed = view.get_allowed_roles() if hasattr(view, "get_allowed_roles") else MANAGERS
        if membership.role not in allowed:
            raise PermissionDenied()
        return True


class IsOpsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if not request.user.is_staff:
            raise PermissionDenied()
        return True


class OrgScopedMixin:
    """Mixin for /org/* views.

    ``role_rules`` maps a viewset action (or lower-case HTTP method for APIViews)
    to the set of roles allowed; anything unlisted falls back to ``default_roles``.
    """

    permission_classes = [permissions.IsAuthenticated, OrgPermission]
    default_roles = MANAGERS
    role_rules: dict = {}

    def get_allowed_roles(self):
        action = getattr(self, "action", None) or self.request.method.lower()
        return self.role_rules.get(action, self.default_roles)

    @property
    def membership(self):
        return resolve_membership(self.request)

    @property
    def org(self):
        return self.membership.organization

    @property
    def is_supervisor(self) -> bool:
        return self.membership.role == SUPERVISOR

    def supervisor_site_ids(self) -> set:
        cache = getattr(self.request, "_ks_site_ids", None)
        if cache is None:
            cache = set(self.membership.sites.values_list("id", flat=True))
            self.request._ks_site_ids = cache
        return cache

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["org"] = self.org
        ctx["membership"] = self.membership
        return ctx
