"""Bolau periodic jobs (beat entries in config/settings/base.py).

* ``expire_and_confirm`` (every 5 min): unanswered bookings → ``expired`` (30 min or 15 min before
  start); Kaam requests past 24 h → ``expired``; ``completed`` bookings → ``confirmed`` 24 h later;
  1-hour reminders.
* ``risk_scan`` (nightly): review-fraud sweep over recent ratings.
"""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger("kaamsathi.bolau")


@shared_task(name="apps.bolau.tasks.expire_and_confirm")
def expire_and_confirm() -> dict:
    from . import bookings, kaam

    out = {
        "bookings_expired": bookings.expire_due(),
        "requests_expired": kaam.expire_due(),
        "auto_confirmed": bookings.auto_confirm_due(),
        "reminders": bookings.send_reminders(),
    }
    logger.info("bolau expire_and_confirm %s", out)
    return out


@shared_task(name="apps.bolau.tasks.risk_scan")
def risk_scan() -> int:
    from . import risk

    return risk.scan()
