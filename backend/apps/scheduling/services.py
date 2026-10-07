"""Roster helpers: week windows, grid building, upsert and copy-week."""

from __future__ import annotations

import datetime as dt

from django.db import transaction
from django.db.models import Q

from apps.core.bs import bs_str, js_weekday, today_ad
from apps.core.exceptions import APIError

from .models import RosterEntry


def week_start_of(day: dt.date) -> dt.date:
    """Nepal's week starts on Sunday."""
    return day - dt.timedelta(days=js_weekday(day))


def parse_week_start(value, name="week_start") -> dt.date:
    if not value:
        return week_start_of(today_ad())
    try:
        return dt.date.fromisoformat(str(value))
    except ValueError as exc:
        raise APIError("validation_error", fields={name: ["Expected YYYY-MM-DD."]}) from exc


def week_days(start: dt.date, org=None) -> list[dict]:
    from apps.workforce.models import Holiday

    dates = [start + dt.timedelta(days=i) for i in range(7)]
    holidays = {}
    if org is not None:
        for h in Holiday.objects.filter(
            Q(organization__isnull=True) | Q(organization=org), date__range=(dates[0], dates[-1])
        ):
            holidays[h.date] = h
    return [
        {
            "date": d.isoformat(),
            "date_bs": bs_str(d),
            "weekday": js_weekday(d),
            "is_holiday": d in holidays,
            "holiday_name": holidays[d].name_en if d in holidays else None,
            "is_weekly_off": org is not None and js_weekday(d) == org.weekly_off_day,
        }
        for d in dates
    ]


def cell(entry: RosterEntry | None) -> dict | None:
    if entry is None:
        return None
    return {
        "shift_id": str(entry.shift_id) if entry.shift_id else None,
        "site_id": str(entry.site_id) if entry.site_id else None,
        "is_off": entry.is_off,
        "note": entry.note,
    }


def shift_ref(shift) -> dict | None:
    if shift is None:
        return None
    return {
        "id": str(shift.id),
        "name": shift.name,
        "start_time": shift.start_time.strftime("%H:%M"),
        "end_time": shift.end_time.strftime("%H:%M"),
    }


def rostered_for(employments, day: dt.date) -> dict:
    """{employment_id: rostered_shift payload} for the attendance day view."""
    out = {}
    for e in RosterEntry.objects.filter(employment__in=employments, date=day).select_related("shift"):
        out[e.employment_id] = {
            **(shift_ref(e.shift) or {"id": None, "name": None, "start_time": None, "end_time": None}),
            "shift_id": str(e.shift_id) if e.shift_id else None,
            "site_id": str(e.site_id) if e.site_id else None,
            "is_off": e.is_off,
        }
    return out


@transaction.atomic
def upsert(entries: list[dict], user) -> dict:
    """entries: validated dicts {employment, date, shift|None, site|None, is_off, note}.
    A cell with no shift and not off clears the entry."""
    saved = cleared = 0
    for e in entries:
        if e.get("shift") is None and not e.get("is_off"):
            cleared += RosterEntry.objects.filter(employment=e["employment"], date=e["date"]).delete()[0]
            continue
        RosterEntry.objects.update_or_create(
            employment=e["employment"],
            date=e["date"],
            defaults={
                "shift": None if e.get("is_off") else e.get("shift"),
                "site": e.get("site"),
                "is_off": bool(e.get("is_off")),
                "note": e.get("note") or None,
                "created_by": user,
            },
        )
        saved += 1
    return {"saved": saved, "cleared": cleared}


@transaction.atomic
def copy_week(employments_qs, from_start: dt.date, to_start: dt.date, user) -> int:
    delta = to_start - from_start
    source = RosterEntry.objects.filter(
        employment__in=employments_qs, date__range=(from_start, from_start + dt.timedelta(days=6))
    ).select_related("employment")
    copied = 0
    for src in source:
        target = src.date + delta
        if not src.employment.is_active_on(target):
            continue
        RosterEntry.objects.update_or_create(
            employment=src.employment,
            date=target,
            defaults={
                "shift_id": src.shift_id,
                "site_id": src.site_id,
                "is_off": src.is_off,
                "note": src.note,
                "created_by": user,
            },
        )
        copied += 1
    return copied
