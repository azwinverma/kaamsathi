"""Weekly timesheets built from attendance, their approval flow and the payroll OT hook."""

from __future__ import annotations

import datetime as dt
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import pgettext

from apps.core.bs import js_weekday
from apps.core.exceptions import APIError, InvalidState
from apps.workforce.models import Attendance, Employment, Holiday

from .models import Timesheet, TimesheetPolicy

WEEK = 7
EDITABLE = {"draft", "rejected"}


def get_policy(org) -> TimesheetPolicy:
    policy, _ = TimesheetPolicy.objects.get_or_create(organization=org)
    return policy


def policy_or_default(org) -> TimesheetPolicy:
    """Stored policy, or an unsaved default (no write on read paths)."""
    return TimesheetPolicy.objects.filter(organization=org).first() or TimesheetPolicy(organization=org)


def parse_week_start(value, field="week_start") -> dt.date:
    if isinstance(value, dt.date):
        day = value
    else:
        try:
            day = dt.date.fromisoformat(str(value))
        except (TypeError, ValueError) as exc:
            raise APIError(
                "validation_error", fields={field: [pgettext("enterprise", "Expected YYYY-MM-DD.")]}
            ) from exc
    if js_weekday(day) != 0:
        raise APIError(
            "validation_error", fields={field: [pgettext("enterprise", "A timesheet week starts on Sunday.")]}
        )
    return day


def week_of(day: dt.date) -> dt.date:
    """The Sunday starting the week that contains ``day``."""
    return day - dt.timedelta(days=js_weekday(day))


def _minutes_between(start, end) -> int:
    if not start or not end or end <= start:
        return 0
    return int((end - start).total_seconds() // 60)


def build_days(employment, week_start: dt.date, policy, records: dict, holidays: set, weekly_off: int):
    """Per-day rows and totals for one employment-week.

    present = daily regular minutes, half_day = half of it; with both check-in and check-out the
    regular minutes are the worked span capped at that base. OT comes from ``overtime_minutes``.
    """
    base_full = int(policy.daily_regular_minutes)
    rows, regular_total, ot_total = [], 0, 0
    for i in range(WEEK):
        day = week_start + dt.timedelta(days=i)
        row = {"date": day.isoformat(), "worked_minutes": 0, "regular_minutes": 0, "overtime_minutes": 0}
        rec = records.get(day)
        if not employment.is_active_on(day):
            row["status"] = "not_employed"
        elif rec is None:
            if day in holidays:
                row["status"] = "holiday"
            elif js_weekday(day) == weekly_off:
                row["status"] = "weekly_off"
            else:
                row["status"] = "not_marked"
        else:
            row["status"] = rec.status
            base = base_full if rec.status == "present" else base_full // 2 if rec.status == "half_day" else 0
            ot = int(rec.overtime_minutes or 0)
            span = _minutes_between(rec.check_in_at, rec.check_out_at)
            if base and span:
                regular = min(span, base)
                worked = span
            else:
                regular = base
                worked = base + ot
            row.update(regular_minutes=regular, overtime_minutes=ot, worked_minutes=max(worked, regular + ot))
            regular_total += regular
            ot_total += ot
        rows.append(row)
    return rows, regular_total, ot_total


def _holidays(org, start, end) -> set:
    return set(
        Holiday.objects.filter(
            Q(organization__isnull=True) | Q(organization=org), date__range=(start, end)
        ).values_list("date", flat=True)
    )


def employments_for_week(org, week_start, site=None, site_ids=None):
    end = week_start + dt.timedelta(days=WEEK - 1)
    qs = (
        Employment.objects.filter(organization=org, start_date__lte=end)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=week_start))
        .select_related("worker", "site", "organization")
    )
    if site:
        qs = qs.filter(site_id=site)
    if site_ids is not None:
        qs = qs.filter(site_id__in=site_ids)
    return qs


@transaction.atomic
def generate(org, week_start: dt.date, site=None, site_ids=None) -> dict:
    """Create or refresh draft/rejected timesheets for the week. Submitted/approved are left alone."""
    policy = policy_or_default(org)
    end = week_start + dt.timedelta(days=WEEK - 1)
    holidays = _holidays(org, week_start, end)
    emps = list(employments_for_week(org, week_start, site, site_ids))
    by_emp: dict = {}
    for a in Attendance.objects.filter(employment__in=emps, date__range=(week_start, end)):
        by_emp.setdefault(a.employment_id, {})[a.date] = a
    existing = {
        t.employment_id: t
        for t in Timesheet.objects.select_for_update().filter(employment__in=emps, week_start=week_start)
    }
    created = refreshed = skipped = 0
    for emp in emps:
        days, regular, ot = build_days(
            emp, week_start, policy, by_emp.get(emp.id, {}), holidays, org.weekly_off_day
        )
        ts = existing.get(emp.id)
        if ts is None:
            Timesheet.objects.create(
                employment=emp,
                week_start=week_start,
                days=days,
                regular_minutes=regular,
                overtime_minutes_claimed=ot,
            )
            created += 1
        elif ts.status in EDITABLE:
            ts.days, ts.regular_minutes, ts.overtime_minutes_claimed = days, regular, ot
            ts.status = "draft"
            ts.overtime_minutes_approved = None
            ts.save()
            refreshed += 1
        else:
            skipped += 1
    return {"created": created, "refreshed": refreshed, "skipped": skipped}


def submit(ts: Timesheet, user) -> Timesheet:
    if ts.status not in EDITABLE:
        raise InvalidState()
    ts.status = "submitted"
    ts.submitted_by = user
    ts.submitted_at = timezone.now()
    ts.save(update_fields=["status", "submitted_by", "submitted_at", "updated_at"])
    return ts


def approve(ts: Timesheet, user, overtime_minutes_approved=None) -> Timesheet:
    if ts.status not in {"draft", "submitted"}:
        raise InvalidState()
    if overtime_minutes_approved is None:
        overtime_minutes_approved = ts.overtime_minutes_claimed
    overtime_minutes_approved = int(overtime_minutes_approved)
    if overtime_minutes_approved < 0 or overtime_minutes_approved > ts.overtime_minutes_claimed:
        raise APIError(
            "validation_error",
            fields={
                "overtime_minutes_approved": [
                    pgettext("enterprise", "Approved overtime must be between 0 and the claimed overtime.")
                ]
            },
        )
    ts.status = "approved"
    ts.overtime_minutes_approved = overtime_minutes_approved
    ts.approved_by = user
    ts.approved_at = timezone.now()
    ts.note = None
    ts.save()
    _notify_worker(ts, approved=True)
    return ts


def reject(ts: Timesheet, user, note: str) -> Timesheet:
    if ts.status not in {"draft", "submitted"}:
        raise InvalidState()
    if not (note or "").strip():
        raise APIError(
            "validation_error",
            fields={"note": [pgettext("enterprise", "Say why the timesheet is rejected.")]},
        )
    ts.status = "rejected"
    ts.note = note.strip()
    ts.approved_by = user
    ts.approved_at = timezone.now()
    ts.overtime_minutes_approved = None
    ts.save()
    return ts


def _notify_worker(ts: Timesheet, approved: bool):
    try:
        from apps.notifications.services import notify
    except ImportError:  # pragma: no cover
        return
    user = getattr(ts.employment.worker, "user", None)
    if user is None:
        return
    hours = Decimal(ts.overtime_minutes_approved or 0) / 60
    notify(
        user,
        "timesheet_approved",
        "Timesheet approved",
        f"Week of {ts.week_start:%d %b %Y}: {hours:.1f} h overtime approved.",
        title_ne="टाइमसिट स्वीकृत भयो",
        body_ne=f"{ts.week_start:%Y-%m-%d} देखिको हप्ता: {hours:.1f} घण्टा ओभरटाइम स्वीकृत।",
        data={"timesheet_id": str(ts.id), "week_start": ts.week_start.isoformat()},
        template="timesheet_approved",
        context={"week": ts.week_start.isoformat(), "hours": f"{hours:.1f}"},
    )


def over_cap(ts: Timesheet, policy) -> bool:
    return ts.overtime_minutes_claimed > policy.weekly_ot_cap_minutes


# --------------------------------------------------------------------------- payroll hook
def approved_ot_minutes(employment, period_start: dt.date, period_end: dt.date) -> int | None:
    """OT minutes payroll should pay for the period, or None to use attendance OT (default).

    When the org's policy has ``ot_requires_approval``: the sum over approved timesheets overlapping
    the period of ``overtime_minutes_approved × (week days inside the period) / 7``, rounded half-up
    to whole minutes. Draft/submitted/rejected weeks contribute nothing.
    """
    policy = TimesheetPolicy.objects.filter(organization_id=employment.organization_id).first()
    if policy is None or not policy.ot_requires_approval:
        return None
    total = Decimal("0")
    sheets = Timesheet.objects.filter(
        employment=employment,
        status="approved",
        week_start__lte=period_end,
        week_start__gte=period_start - dt.timedelta(days=WEEK - 1),
    )
    for ts in sheets:
        week_end = ts.week_start + dt.timedelta(days=WEEK - 1)
        overlap = (min(week_end, period_end) - max(ts.week_start, period_start)).days + 1
        if overlap <= 0:
            continue
        total += Decimal(ts.overtime_minutes_approved or 0) * Decimal(overlap) / Decimal(WEEK)
    return int(total.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
