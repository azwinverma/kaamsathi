"""Feature flags with settings fallback (checklist C015 / X012).

``is_enabled(key, organization=None, user=None)`` answers "is this feature on here?":

1. A ``FeatureFlag`` row for ``key`` decides when present: ``enabled=False`` → off; otherwise the
   rollout applies — ``all`` (everyone), ``orgs`` (``org_ids`` list) or ``percent`` (a stable
   hash of ``key`` + organization id, or user id when there is no organization, into 0–99).
2. With no row, the matching settings value is used (``SETTINGS_FALLBACK``), so the existing
   booleans (``KYB_REQUIRED_FOR_SHORTLIST``, ``IRD_CBMS_ENABLED``, ``TELEMETRY_ENABLED``,
   ``PAYOUT_PROVIDERS``, ``KYC_FOUR_EYES`` …) keep working until ops create a flag.
3. Unknown keys with no row are off.

Flags are read through the shared cache for ``FEATURE_FLAG_CACHE_SECONDS`` (0 disables caching —
tests) and the cache is dropped whenever a flag is saved or deleted.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable

from django.conf import settings
from django.core.cache import cache

CACHE_KEY = "ks:feature_flags:v1"


def _setting(name: str, default=False) -> Callable[[], bool]:
    return lambda: bool(getattr(settings, name, default))


def _payout(code: str) -> Callable[[], bool]:
    return lambda: code in (getattr(settings, "PAYOUT_PROVIDERS", None) or [])


# Flag key → settings fallback used when no FeatureFlag row exists.
SETTINGS_FALLBACK: dict[str, Callable[[], bool]] = {
    "kyb_required_for_shortlist": _setting("KYB_REQUIRED_FOR_SHORTLIST", True),
    "ird_cbms_enabled": _setting("IRD_CBMS_ENABLED", False),
    "telemetry": _setting("TELEMETRY_ENABLED", True),
    "kyc_four_eyes": _setting("KYC_FOUR_EYES", False),
    "payout_esewa": _payout("esewa"),
    "payout_khalti": _payout("khalti"),
    "payout_connectips": _payout("connectips"),
}


def _ttl() -> int:
    return int(getattr(settings, "FEATURE_FLAG_CACHE_SECONDS", 30) or 0)


def _load() -> dict[str, dict]:
    ttl = _ttl()
    if ttl:
        try:
            cached = cache.get(CACHE_KEY)
        except Exception:  # noqa: BLE001 — cache down: read the DB
            cached = None
        if cached is not None:
            return cached
    from .models import FeatureFlag

    rows = {
        f.key: {
            "enabled": f.enabled,
            "rollout": f.rollout,
            "org_ids": [str(x) for x in (f.org_ids or [])],
            "percent": int(f.percent or 0),
            "client_visible": f.client_visible,
        }
        for f in FeatureFlag.objects.all()
    }
    if ttl:
        try:
            cache.set(CACHE_KEY, rows, ttl)
        except Exception:  # noqa: BLE001
            pass
    return rows


def invalidate() -> None:
    try:
        cache.delete(CACHE_KEY)
    except Exception:  # noqa: BLE001
        pass


def bucket(key: str, subject: str) -> int:
    """Stable 0–99 bucket for percentage rollouts."""
    digest = hashlib.sha256(f"{key}:{subject}".encode()).hexdigest()
    return int(digest[:8], 16) % 100


def _subject_id(obj) -> str | None:
    if obj is None:
        return None
    pk = getattr(obj, "pk", obj)
    return str(pk) if pk is not None else None


def evaluate(row: dict, key: str, organization=None, user=None) -> bool:
    if not row["enabled"]:
        return False
    rollout = row["rollout"]
    org_id = _subject_id(organization)
    if rollout == "all":
        return True
    if rollout == "orgs":
        return org_id is not None and org_id in row["org_ids"]
    if rollout == "percent":
        subject = org_id or _subject_id(user if getattr(user, "is_authenticated", True) else None)
        if subject is None:
            return False
        return bucket(key, subject) < max(0, min(int(row["percent"]), 100))
    return False


def default_for(key: str) -> bool:
    fallback = SETTINGS_FALLBACK.get(key)
    return bool(fallback()) if fallback else False


def is_enabled(key: str, organization=None, user=None) -> bool:
    row = _load().get(key)
    if row is None:
        return default_for(key)
    return evaluate(row, key, organization, user)


def client_flags(organization=None, user=None) -> dict[str, bool]:
    """``{key: bool}`` for every client-visible flag, evaluated for this caller."""
    return {
        key: evaluate(row, key, organization, user)
        for key, row in sorted(_load().items())
        if row["client_visible"]
    }
