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
    A cell with no shift and not off clears the entry.

    Returns ``{saved, cleared, changed: [(employment, date)]}`` — ``changed`` lists cells whose
    shift/site/off actually changed (drives worker notifications, O007)."""
    saved = cleared = 0
    changed = []
    for e in entries:
        existing = RosterEntry.objects.filter(employment=e["employment"], date=e["date"]).first()
        if e.get("shift") is None and not e.get("is_off"):
            if existing is not None:
                existing.delete()
                cleared += 1
                changed.append((e["employment"], e["date"]))
            continue
        is_off = bool(e.get("is_off"))
        shift = None if is_off else e.get("shift")
        site = e.get("site")
        new_key = (shift.pk if shift else None, site.pk if site else None, is_off)
        if existing is None or (existing.shift_id, existing.site_id, existing.is_off) != new_key:
            changed.append((e["employment"], e["date"]))
        RosterEntry.objects.update_or_create(
            employment=e["employment"],
            date=e["date"],
            defaults={
                "shift": shift,
                "site": site,
                "is_off": is_off,
                "note": e.get("note") or None,
                "created_by": user,
            },
        )
        saved += 1
    return {"saved": saved, "cleared": cleared, "changed": changed}


@transaction.atomic
def copy_week(
    employments_qs, from_start: dt.date, to_start: dt.date, user, changed: list | None = None
) -> int:
    """Copy one week's roster onto another. Changed target cells are appended to ``changed``."""
    delta = to_start - from_start
    source = RosterEntry.objects.filter(
        employment__in=employments_qs, date__range=(from_start, from_start + dt.timedelta(days=6))
    ).select_related("employment__organization")
    copied = 0
    for src in source:
        target = src.date + delta
        if not src.employment.is_active_on(target):
            continue
        existing = RosterEntry.objects.filter(employment=src.employment, date=target).first()
        key = (src.shift_id, src.site_id, src.is_off)
        if changed is not None and (
            existing is None or (existing.shift_id, existing.site_id, existing.is_off) != key
        ):
            changed.append((src.employment, target))
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


# --------------------------------------------------------------------------- conflicts (O005)
def conflict_labels() -> dict:
    from django.utils.translation import pgettext

    return {
        "on_leave": pgettext("complete1", "Worker is on approved leave this day."),
        "holiday": pgettext("complete1", "This day is a public holiday."),
        "weekly_off": pgettext("complete1", "This day is the weekly day off."),
        "conflict_elsewhere": pgettext(
            "complete1", "Worker has another shift or attendance elsewhere this day."
        ),
    }


def conflicts_for(pairs) -> dict:
    """Warnings (never blocking) for rostered (employment, date) pairs.

    ``{(employment_id, date): [code]}`` — ``on_leave`` (approved leave), ``holiday`` (national/org
    holiday), ``weekly_off`` (org weekly off day) and ``conflict_elsewhere`` (the worker has another
    active employment with a rostered shift or attendance that day; the other employer is never
    named).
    """
    from apps.workforce.models import Attendance, Employment, Holiday, LeaveRequest

    pairs = list(pairs)
    if not pairs:
        return {}
    dates = [d for _, d in pairs]
    lo, hi = min(dates), max(dates)
    emps = {e.pk: e for e, _ in pairs}
    worker_ids = {e.worker_id for e in emps.values()}
    org_ids = {e.organization_id for e in emps.values()}

    leaves = list(
        LeaveRequest.objects.filter(
            employment_id__in=list(emps), status="approved", from_date__lte=hi, to_date__gte=lo
        ).values_list("employment_id", "from_date", "to_date")
    )
    holidays: dict = {}
    for org_id, day in Holiday.objects.filter(
        Q(organization__isnull=True) | Q(organization_id__in=org_ids), date__range=(lo, hi)
    ).values_list("organization_id", "date"):
        holidays.setdefault(day, set()).add(org_id)
    others = dict(
        Employment.objects.filter(worker_id__in=worker_ids, status="active")
        .exclude(pk__in=list(emps))
        .values_list("pk", "worker_id")
    )
    busy: set = set()  # (worker_id, date)
    if others:
        for emp_id, day in RosterEntry.objects.filter(
            employment_id__in=list(others), date__range=(lo, hi), is_off=False
        ).values_list("employment_id", "date"):
            busy.add((others[emp_id], day))
        for emp_id, day in Attendance.objects.filter(
            employment_id__in=list(others), date__range=(lo, hi), status__in=["present", "half_day"]
        ).values_list("employment_id", "date"):
            busy.add((others[emp_id], day))

    out: dict = {}
    for emp, day in pairs:
        codes = []
        if any(eid == emp.pk and f <= day <= t for eid, f, t in leaves):
            codes.append("on_leave")
        orgs = holidays.get(day, set())
        if None in orgs or emp.organization_id in orgs:
            codes.append("holiday")
        if js_weekday(day) == emp.organization.weekly_off_day:
            codes.append("weekly_off")
        if (emp.worker_id, day) in busy:
            codes.append("conflict_elsewhere")
        if codes:
            out[(emp.pk, day)] = codes
    return out


def warnings_list(conflicts: dict) -> list[dict]:
    names = conflict_labels()
    rows = []
    for (emp_id, day), codes in sorted(conflicts.items(), key=lambda x: (str(x[0][0]), x[0][1])):
        for code in codes:
            rows.append(
                {
                    "employment_id": str(emp_id),
                    "date": day.isoformat(),
                    "code": code,
                    "message": str(names[code]),
                }
            )
    return rows


# --------------------------------------------------------------------------- notifications (O007)
NOTIFY_DAYS = 7


def notify_roster_changes(changed) -> int:
    """One inbox/push notification per worker per save batch when their roster changed for
    today … today+7 (debounced: one message per worker per request). Returns workers notified."""
    from apps.core.bs import format_bs_en
    from apps.workers.models import Worker

    try:
        from apps.notifications.services import notify
    except ImportError:  # pragma: no cover
        return 0
    today = today_ad()
    horizon = today + dt.timedelta(days=NOTIFY_DAYS)
    by_worker: dict = {}
    for emp, day in changed:
        if today <= day <= horizon:
            by_worker.setdefault(emp.worker_id, (emp, set()))[1].add(day)
    if not by_worker:
        return 0
    users = {
        w.pk: w.user
        for w in Worker.objects.filter(pk__in=list(by_worker), user__isnull=False).select_related("user")
    }
    sent = 0
    for worker_id, (emp, days) in by_worker.items():
        user = users.get(worker_id)
        if user is None:
            continue
        org = emp.organization.name
        notify(
            user,
            "roster_changed",
            f"Your shifts at {org} changed",
            f"{len(days)} day(s) from {format_bs_en(min(days))} were updated. "
            "Open KaamSathi to see your shifts.",
            title_ne=f"{org} मा तपाईंको सिफ्ट परिवर्तन भयो",
            body_ne=f"{len(days)} दिनको सिफ्ट अद्यावधिक भयो। सिफ्ट हेर्न KaamSathi खोल्नुहोस्।",
            data={"employment_id": str(emp.pk), "dates": sorted(d.isoformat() for d in days)},
            link="/me/roster",
        )
        sent += 1
    return sent
