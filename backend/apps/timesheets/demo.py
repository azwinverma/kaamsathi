"""Demo timesheets (called from seed_demo as ``seed(stdout, rng)``). Idempotent.

Hotel: last week's timesheets generated and approved by the owner, this week's left as drafts.
"""

from __future__ import annotations

import datetime as dt

HOTEL = "Hotel Annapurna View Pvt. Ltd."
OWNER_PHONE = "9800000001"


def seed(stdout, rng) -> None:
    from apps.accounts.models import User
    from apps.core.bs import today_ad
    from apps.orgs.models import Organization

    from . import services
    from .models import Timesheet

    org = Organization.objects.filter(name=HOTEL).first()
    if org is None:
        stdout.write("  timesheets: hotel not found, skipped")
        return
    owner = User.objects.filter(phone=OWNER_PHONE).first()
    services.get_policy(org)
    this_week = services.week_of(today_ad())
    last_week = this_week - dt.timedelta(days=7)

    services.generate(org, last_week)
    approved = 0
    for ts in Timesheet.objects.filter(employment__organization=org, week_start=last_week).exclude(
        status="approved"
    ):
        ts.status = "submitted"
        ts.submitted_by = owner
        services.approve(ts, owner)
        approved += 1
    result = services.generate(org, this_week)
    stdout.write(
        f"  timesheets: last week {approved} approved; this week {result['created']} new / "
        f"{result['refreshed']} refreshed drafts"
    )
