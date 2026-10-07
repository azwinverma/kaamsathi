"""Celery tasks for credentials (beat entry pre-registered in config/settings/base.py)."""

from __future__ import annotations

import datetime as dt
import logging

from celery import shared_task
from django.utils import translation
from django.utils.translation import gettext as _

from apps.core.bs import format_bs_en, format_bs_ne, to_devanagari, today_ad

logger = logging.getLogger("kaamsathi.credentials")

REMINDER_DAYS = (30, 7)


def _language(worker) -> str:
    user = getattr(worker, "user", None)
    return getattr(user, "preferred_language", None) or "ne"


@shared_task
def expiry_reminders() -> dict:
    """Mark past-expiry credentials ``expired``; SMS workers 30 and 7 days before expiry."""
    from apps.notifications.services import send_sms

    from .models import Credential
    from .services import recompute_trust

    today = today_ad()
    expired_qs = Credential.objects.filter(status__in=["verified", "pending"], expires_on__lt=today)
    affected = list(expired_qs.select_related("worker").values_list("worker_id", flat=True).distinct())
    expired = expired_qs.update(status="expired")
    if affected:
        from apps.workers.models import Worker

        for worker in Worker.objects.filter(pk__in=affected):
            recompute_trust(worker)

    reminded = 0
    targets = [today + dt.timedelta(days=d) for d in REMINDER_DAYS]
    due = Credential.objects.filter(status="verified", expires_on__in=targets).select_related("worker__user")
    for cred in due:
        worker = cred.worker
        days = (cred.expires_on - today).days
        lang = _language(worker)
        with translation.override(lang):
            date_text = format_bs_ne(cred.expires_on) if lang == "ne" else format_bs_en(cred.expires_on)
            body = _(
                "KaamSathi: your %(title)s expires in %(days)s days (%(date)s). "
                "Renew it and upload the new certificate in the app."
            ) % {
                "title": cred.title,
                "days": to_devanagari(days) if lang == "ne" else days,
                "date": date_text,
            }
        send_sms(worker.phone, body, kind="credential_expiry")
        reminded += 1
    result = {"expired": expired, "reminded": reminded}
    logger.info("credentials.expiry_reminders %s", result)
    return result
