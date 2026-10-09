"""Slot checks: weekly rules, time off, overlapping bookings (no double-booking), next free slot."""

from __future__ import annotations

import datetime as dt

from django.utils import timezone

from apps.core.bs import js_weekday

from .common import LEAD_TIME
from .models import AvailabilityRule, Booking, SipaluProfile, TimeOff

STEP = dt.timedelta(minutes=30)


def within_rules(rules, start: dt.datetime, end: dt.datetime) -> bool:
    s, e = timezone.localtime(start), timezone.localtime(end)
    if s.date() != e.date() and not (
        e.time() == dt.time(0, 0) and e.date() == s.date() + dt.timedelta(days=1)
    ):
        return False
    day = js_weekday(s.date())
    end_t = e.time() if e.date() == s.date() else dt.time(23, 59, 59)
    return any(r.weekday == day and r.start_time <= s.time() and end_t <= r.end_time for r in rules)


def on_time_off(profile: SipaluProfile, start: dt.datetime, end: dt.datetime, time_off=None) -> bool:
    s, e = timezone.localtime(start).date(), timezone.localtime(end).date()
    rows = time_off if time_off is not None else TimeOff.objects.filter(profile=profile)
    return any(t.from_date <= e and t.to_date >= s for t in rows)


def overlapping(worker, start: dt.datetime, end: dt.datetime, exclude_id=None):
    qs = Booking.objects.filter(
        sipalu=worker, status__in=Booking.ACTIVE, scheduled_start__lt=end, scheduled_end__gt=start
    )
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return qs


def slot_problem(
    profile: SipaluProfile, start: dt.datetime, end: dt.datetime, *, check_rules=True
) -> str | None:
    """Message key of the first problem with the slot, or None when it is free."""
    if start < timezone.now() + LEAD_TIME:
        return "lead_time"
    if check_rules and not within_rules(list(profile.availability.all()), start, end):
        return "outside_availability"
    if on_time_off(profile, start, end):
        return "time_off"
    if overlapping(profile.worker, start, end).exists():
        return "slot_taken"
    return None


def next_available(profile: SipaluProfile, minutes: int = 60, *, days: int = 7, now=None, rules=None,
                   time_off=None, busy=None) -> dt.datetime | None:  # fmt: skip
    """First start (30-minute grid inside the weekly rules) that is free for ``minutes``."""
    now = now or timezone.now()
    earliest = now + LEAD_TIME
    rules = rules if rules is not None else list(AvailabilityRule.objects.filter(profile=profile))
    if not rules:
        return None
    time_off = time_off if time_off is not None else list(TimeOff.objects.filter(profile=profile))
    if busy is None:
        busy = list(
            Booking.objects.filter(
                sipalu_id=profile.worker_id,
                status__in=Booking.ACTIVE,
                scheduled_end__gt=now,
                scheduled_start__lt=now + dt.timedelta(days=days + 1),
            ).values_list("scheduled_start", "scheduled_end")
        )
    length = dt.timedelta(minutes=minutes)
    tz = timezone.get_current_timezone()
    today = timezone.localtime(now).date()
    for offset in range(days + 1):
        day = today + dt.timedelta(days=offset)
        if any(t.from_date <= day <= t.to_date for t in time_off):
            continue
        weekday = js_weekday(day)
        for r in sorted((r for r in rules if r.weekday == weekday), key=lambda r: r.start_time):
            cursor = timezone.make_aware(dt.datetime.combine(day, r.start_time), tz)
            stop = timezone.make_aware(dt.datetime.combine(day, r.end_time), tz)
            while cursor + length <= stop:
                if cursor >= earliest and not any(s < cursor + length and e > cursor for s, e in busy):
                    return cursor
                cursor += STEP
    return None


def availability_summary(profile: SipaluProfile, rules=None) -> dict:
    rules = rules if rules is not None else list(profile.availability.all())
    weekly = {}
    for r in rules:
        weekly.setdefault(r.weekday, []).append(
            [r.start_time.strftime("%H:%M"), r.end_time.strftime("%H:%M")]
        )
    return {
        "weekly": [{"weekday": d, "ranges": weekly[d]} for d in sorted(weekly)],
        "next_available": None,
    }
