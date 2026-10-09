"""Server-side Bolau telemetry (names allow-listed in ``apps/telemetry/schema.py``). No PII."""

from __future__ import annotations


def track(name: str, user=None, **props) -> None:
    try:
        from apps.telemetry.services import track as _track
    except ImportError:  # pragma: no cover
        return
    _track(name, user, **props)
