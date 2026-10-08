"""Funnels and weekly retention over raw events, with k-anonymity on every output.

Any count describing 1..K-1 distinct subjects is suppressed (``null`` + ``suppressed: true``), and
so is every rate derived from it. Computed in Python: phase-1 volumes are small; move to SQL or a
nightly rollup when events exceed a few million rows.
"""

from __future__ import annotations

import datetime as dt
from collections import defaultdict

from django.db.models import Min
from django.utils import timezone

from .models import Event

K_ANONYMITY = 5

# key: how events are grouped — "subject" (worker:<id> …), "organization", or "application".
FUNNELS: dict[str, dict] = {
    "worker_onboarding": {
        "key": "subject",
        "steps": [
            ("profile_created", "worker_profile_created", {}),
            ("onboarded", "worker_onboarded", {}),
            ("verified", "worker_verified", {}),
            ("shortlisted", "application_stage_changed", {"to_stage": "shortlisted"}),
            ("placed", "worker_placed", {}),
        ],
    },
    "employer_activation": {
        "key": "organization",
        "steps": [
            ("org_created", "org_created", {}),
            ("job_published", "job_published", {}),
            ("first_placement", "worker_placed", {}),
            ("first_attendance", "first_attendance", {}),
            ("payroll_approved", "payroll_approved", {}),
        ],
    },
    "hiring": {
        "key": "application",
        "steps": [
            ("shortlisted", "application_stage_changed", {"to_stage": "shortlisted"}),
            ("selected", "application_stage_changed", {"to_stage": "selected"}),
            ("joined", "worker_placed", {}),
        ],
    },
}


def suppress(n: int) -> int | None:
    return None if 0 < n < K_ANONYMITY else n


def _rate(num: int | None, den: int | None) -> float | None:
    if num is None or den is None or den == 0:
        return None
    return round(num / den, 4)


def _key(event: Event, kind: str):
    if kind == "organization":
        return event.organization_id
    if kind == "application":
        return (event.properties or {}).get("application_id")
    return event.subject or None


def _matches(event: Event, name: str, where: dict) -> bool:
    if event.name != name:
        return False
    props = event.properties or {}
    return all(props.get(k) == v for k, v in where.items())


def funnel_counts(name: str, since: dt.datetime, until: dt.datetime | None = None) -> list[int]:
    """Raw (unsuppressed) sequential funnel: a key reaches step i only after steps 0..i-1, in order."""
    spec = FUNNELS[name]
    steps = spec["steps"]
    names = {s[1] for s in steps}
    qs = Event.objects.filter(name__in=names, occurred_at__gte=since)
    if until is not None:
        qs = qs.filter(occurred_at__lte=until)
    progress: dict = defaultdict(int)
    for event in qs.order_by("occurred_at", "id").only("name", "subject", "organization_id", "properties"):
        key = _key(event, spec["key"])
        if key in (None, ""):
            continue
        reached = progress[key]
        if reached < len(steps) and _matches(event, steps[reached][1], steps[reached][2]):
            progress[key] = reached + 1
    return [sum(1 for v in progress.values() if v > i) for i in range(len(steps))]


def funnel(name: str, days: int = 30) -> dict:
    since = timezone.now() - dt.timedelta(days=days)
    raw = funnel_counts(name, since)
    shown = [suppress(n) for n in raw]
    first = shown[0] if shown else None
    out = []
    for i, (label, event_name, _where) in enumerate(FUNNELS[name]["steps"]):
        out.append(
            {
                "key": label,
                "event": event_name,
                "count": shown[i],
                "suppressed": shown[i] is None,
                "conversion_from_previous": None if i == 0 else _rate(shown[i], shown[i - 1]),
                "conversion_from_start": _rate(shown[i], first),
            }
        )
    return {"name": name, "days": days, "k_anonymity": K_ANONYMITY, "steps": out}


def _week_start(value: dt.datetime) -> dt.date:
    d = timezone.localtime(value).date()
    return d - dt.timedelta(days=d.weekday())  # Monday


def retention(weeks: int = 8) -> dict:
    """Weekly cohorts of users by the week of their first event; share active in each later week."""
    now = timezone.now()
    this_week = _week_start(now)
    first_cohort = this_week - dt.timedelta(weeks=weeks - 1)
    first_seen = {
        row["user"]: _week_start(row["first"])
        for row in Event.objects.filter(user__isnull=False).values("user").annotate(first=Min("occurred_at"))
    }
    cohorts: dict[dt.date, set] = defaultdict(set)
    for user_id, week in first_seen.items():
        if week >= first_cohort:
            cohorts[week].add(user_id)

    tz_start = timezone.make_aware(dt.datetime.combine(first_cohort, dt.time.min))
    active: dict[dt.date, set] = defaultdict(set)
    for user_id, at in Event.objects.filter(user__isnull=False, occurred_at__gte=tz_start).values_list(
        "user", "occurred_at"
    ):
        active[_week_start(at)].add(user_id)

    rows = []
    for i in range(weeks):
        start = first_cohort + dt.timedelta(weeks=i)
        members = cohorts.get(start, set())
        size = len(members)
        n_offsets = (this_week - start).days // 7 + 1
        hidden = 0 < size < K_ANONYMITY
        values = []
        for offset in range(n_offsets):
            week = start + dt.timedelta(weeks=offset)
            kept = suppress(len(members & active.get(week, set())))
            values.append(
                {
                    "week": offset,
                    "retained": None if hidden else kept,
                    "rate": None if hidden else _rate(kept, size),
                }
            )
        rows.append(
            {
                "cohort_start": start.isoformat(),
                "size": None if hidden else size,
                "suppressed": hidden,
                "weeks": values,
            }
        )
    return {"cohort": "week", "weeks": weeks, "k_anonymity": K_ANONYMITY, "rows": rows}
