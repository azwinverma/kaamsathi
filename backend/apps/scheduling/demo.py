"""Demo data for scheduling (called by ``seed_demo``): this week's and next week's hotel roster."""

from __future__ import annotations

import datetime as dt


def seed(stdout, rng) -> None:
    from apps.core.bs import js_weekday, today_ad
    from apps.core.management.commands.seed_demo import HOTEL
    from apps.orgs.models import Organization, Shift
    from apps.workforce.models import Employment

    from .models import RosterEntry
    from .services import week_start_of

    hotel = Organization.objects.filter(name=HOTEL).first()
    if not hotel:
        stdout.write("  scheduling: demo hotel missing — skipped")
        return
    shifts = list(Shift.objects.filter(organization=hotel))
    owner = hotel.memberships.filter(role="owner").first()
    start = week_start_of(today_ad())
    created = 0
    for emp in Employment.objects.filter(organization=hotel, status="active").select_related("shift", "site"):
        # Each worker gets one weekly off: the org's off day for most, a weekday for a few.
        off_day = hotel.weekly_off_day if rng.random() < 0.7 else rng.randrange(7)
        for i in range(14):
            day = start + dt.timedelta(days=i)
            if not emp.is_active_on(day):
                continue
            is_off = js_weekday(day) == off_day
            shift = None if is_off else (emp.shift or (rng.choice(shifts) if shifts else None))
            _, was_created = RosterEntry.objects.get_or_create(
                employment=emp,
                date=day,
                defaults={
                    "shift": shift,
                    "site": emp.site,
                    "is_off": is_off,
                    "created_by": owner.user if owner else None,
                },
            )
            created += int(was_created)
    stdout.write(f"  scheduling: {created} roster entries for this and next week")
