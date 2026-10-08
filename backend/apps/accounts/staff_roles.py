"""Ops staff roles and the central URL-prefix → role map used by ``apps.core.permissions.IsOpsStaff``.

``user.is_staff`` still gates ``/ops/*``; on top of that each ops route prefix lists the roles that
may open it. ``superadmin`` passes everything. Keep this file the single source of truth — ops view
files never check roles themselves. The web nav mirrors this map (``web/components/shell/nav.ts``).
"""

from __future__ import annotations

from django.conf import settings

VERIFIER = "verifier"
SUPPORT = "support"
FINANCE_OPS = "finance_ops"
PARTNER_MANAGER = "partner_manager"
RISK_ANALYST = "risk_analyst"
SUPERADMIN = "superadmin"

STAFF_ROLES = (VERIFIER, SUPPORT, FINANCE_OPS, PARTNER_MANAGER, RISK_ANALYST, SUPERADMIN)
ANY_STAFF = frozenset({"*"})

# Prefixes are relative to /api/v1/ and match on whole path segments (``ops/workers`` matches
# ``ops/workers`` and ``ops/workers/<id>/verify`` but not ``ops/workersx``). Longest prefix wins.
ROUTE_ROLES: dict[str, frozenset[str]] = {
    # verification
    "ops/workers": frozenset({VERIFIER}),
    "ops/verification": frozenset({VERIFIER}),
    "ops/credentials": frozenset({VERIFIER}),
    "ops/assessments": frozenset({VERIFIER}),
    "ops/work-history": frozenset({VERIFIER}),
    "ops/employers": frozenset({VERIFIER}),
    "ops/mobility": frozenset({VERIFIER}),
    # support
    "ops/disputes": frozenset({SUPPORT}),
    "ops/support-cases": frozenset({SUPPORT}),
    "ops/privacy-requests": frozenset({SUPPORT}),
    "ops/support": frozenset({SUPPORT}),  # caller lookup, identity checks (ops/support-cases is separate)
    "ops/help": frozenset({SUPPORT}),
    "ops/notifications": frozenset({SUPPORT}),
    # finance
    "ops/finance": frozenset({FINANCE_OPS}),
    "ops/referrals": frozenset({FINANCE_OPS}),
    "ops/billing": frozenset({FINANCE_OPS}),
    # partners / risk
    "ops/partners": frozenset({PARTNER_MANAGER}),
    "ops/risk": frozenset({RISK_ANALYST}),
    # platform administration
    "ops/audit": frozenset({SUPERADMIN}),
    "ops/staff": frozenset({SUPERADMIN}),
    "ops/taxonomy": frozenset({SUPERADMIN}),
    "ops/system": frozenset({SUPERADMIN}),
    "ops/flags": frozenset({SUPERADMIN}),
    # shared queues
    "ops/jobs": frozenset({VERIFIER, SUPPORT}),
    "ops/organizations": frozenset({VERIFIER, SUPPORT}),
    "ops/crews": frozenset({VERIFIER, SUPPORT}),
    "ops/training": frozenset({VERIFIER, SUPPORT}),
    # any staff
    "ops/dashboard": ANY_STAFF,
    "ops/insights": ANY_STAFF,
    "ops/kpis": ANY_STAFF,
    "ops/analytics": ANY_STAFF,
}
# Unlisted /ops/* routes: superadmin only (fail closed for new endpoints).
DEFAULT_ROLES = frozenset({SUPERADMIN})


def api_relative_path(path: str) -> str:
    path = (path or "").split("?", 1)[0].strip("/")
    for prefix in ("api/v1/",):
        if path.startswith(prefix):
            return path[len(prefix) :]
    return path


def roles_for_path(path: str) -> frozenset[str] | None:
    """Roles allowed for an API path, or None when the path is not an /ops route."""
    rel = api_relative_path(path)
    if rel != "ops" and not rel.startswith("ops/"):
        return None
    best = None
    for prefix in ROUTE_ROLES:
        if (rel == prefix or rel.startswith(prefix + "/")) and (best is None or len(prefix) > len(best)):
            best = prefix
    return ROUTE_ROLES[best] if best else DEFAULT_ROLES


def user_roles(user) -> set[str]:
    """Effective staff roles. Staff without a profile = superadmin only in DEBUG (dev/tests)."""
    if not (user and getattr(user, "is_authenticated", False) and user.is_staff):
        return set()
    profile = getattr(user, "_ks_staff_profile", None)
    if profile is None:
        from .models import StaffProfile

        profile = StaffProfile.objects.filter(user=user).first() or False
        user._ks_staff_profile = profile
    if profile is False:
        return {SUPERADMIN} if _no_profile_is_superadmin() else set()
    return {r for r in (profile.roles or []) if r in STAFF_ROLES}


def _no_profile_is_superadmin() -> bool:
    # pytest-django forces DEBUG=False at runtime, so tests opt in via the explicit setting.
    explicit = getattr(settings, "STAFF_NO_PROFILE_SUPERADMIN", None)
    return settings.DEBUG if explicit is None else bool(explicit)


def has_roles(user, allowed: frozenset[str]) -> bool:
    if allowed == ANY_STAFF:
        return True
    roles = user_roles(user)
    return SUPERADMIN in roles or bool(roles & allowed)


def can_access(user, path: str) -> bool:
    allowed = roles_for_path(path)
    if allowed is None:
        return True
    return has_roles(user, allowed)
