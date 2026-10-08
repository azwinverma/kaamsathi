"""Event ingestion, server-side ``track()`` and retention purge."""

from __future__ import annotations

import datetime as dt
import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Event
from .schema import SERVER_EVENTS, clean_properties

logger = logging.getLogger("kaamsathi.telemetry")

MAX_CLOCK_SKEW = dt.timedelta(minutes=5)
MAX_BACKDATE = dt.timedelta(days=7)


def enabled() -> bool:
    return bool(getattr(settings, "TELEMETRY_ENABLED", True))


def retention_days() -> int:
    return int(getattr(settings, "TELEMETRY_RETENTION_DAYS", 400))


def clamp_time(value: dt.datetime | None, now: dt.datetime) -> dt.datetime:
    """Client clocks lie: future or very old timestamps are replaced by the receive time."""
    if value is None:
        return now
    if timezone.is_naive(value):
        value = timezone.make_aware(value, dt.UTC)
    if value > now + MAX_CLOCK_SKEW or value < now - MAX_BACKDATE:
        return now
    return value


def track(name: str, user=None, organization=None, *, subject: str = "", **props) -> Event | None:
    """Server-side event. Unknown property keys / PII-looking values are dropped, and any failure is
    logged and swallowed (inside a savepoint) so analytics can never break a business flow."""
    if not enabled():
        return None
    try:
        if name not in SERVER_EVENTS:
            logger.warning("telemetry: unknown server event %s dropped", name)
            return None
        clean, errors = clean_properties(props, strict=False)
        if errors:
            logger.warning("telemetry: %s dropped properties %s", name, sorted(errors))
        if user is not None and not getattr(user, "is_authenticated", False):
            user = None
        if not subject and user is not None:
            subject = f"user:{user.pk}"
        with transaction.atomic():
            return Event.objects.create(
                name=name,
                user=user,
                organization=organization,
                subject=subject[:80],
                platform="server",
                properties=clean,
                occurred_at=timezone.now(),
            )
    except Exception:  # noqa: BLE001 - analytics must never break the caller
        logger.exception("telemetry: could not record %s", name)
        return None


def track_once(name: str, *, subject: str = "", organization=None, user=None, **props) -> Event | None:
    """Track ``name`` only if no event with that name exists yet for the subject (or organization)."""
    if not enabled():
        return None
    try:
        qs = Event.objects.filter(name=name)
        qs = qs.filter(subject=subject) if subject else qs.filter(organization=organization)
        if qs.exists():
            return None
    except Exception:  # noqa: BLE001
        logger.exception("telemetry: dedupe check failed for %s", name)
        return None
    return track(name, user=user, organization=organization, subject=subject, **props)


def ingest(events: list[dict], *, user=None, organization=None) -> int:
    """Store an already-validated client batch."""
    now = timezone.now()
    rows = []
    for e in events:
        anon = e.get("anonymous_id") or ""
        subject = f"user:{user.pk}" if user is not None else (f"anon:{anon}" if anon else "")
        rows.append(
            Event(
                name=e["name"],
                user=user,
                organization=organization,
                anonymous_id=anon,
                subject=subject,
                platform=e["platform"],
                properties=e.get("properties") or {},
                occurred_at=clamp_time(e.get("occurred_at"), now),
            )
        )
    Event.objects.bulk_create(rows)
    return len(rows)


def purge_old_events(days: int | None = None) -> int:
    """Delete raw events older than ``days`` (default ``TELEMETRY_RETENTION_DAYS`` = 400)."""
    cutoff = timezone.now() - dt.timedelta(days=days or retention_days())
    deleted, _ = Event.objects.filter(received_at__lt=cutoff).delete()
    return deleted
