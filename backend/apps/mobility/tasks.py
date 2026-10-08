"""Daily foreign-employment document expiry job (beat: ``apps.mobility.tasks.expiry_reminders``)."""

from __future__ import annotations

import datetime as dt
import logging

from celery import shared_task

from apps.core.bs import format_bs_en, format_bs_ne, to_devanagari, today_ad

logger = logging.getLogger("kaamsathi.mobility")

REMINDER_DAYS = (60, 30, 7)
REMIND_TRAVEL_KINDS = ("passport",)
REMIND_CLEARANCE_KINDS = ("medical_fitness", "police_clearance")
KIND_NE = {"passport": "राहदानी", "medical_fitness": "स्वास्थ्य परीक्षण", "police_clearance": "प्रहरी प्रतिवेदन"}
KIND_EN = {
    "passport": "passport",
    "medical_fitness": "medical fitness report",
    "police_clearance": "police clearance",
}


def notify_worker(worker, *, kind, title_en, title_ne, body_en, body_ne, sms=True, link=None, data=None):
    """In-app notification via ``apps.notifications.services.notify`` when available; otherwise (or
    when the worker has no login yet) an SMS in the worker's language."""
    user = getattr(worker, "user", None)
    notify = None
    if user is not None:
        try:
            from apps.notifications.services import notify
        except ImportError:
            notify = None
    if notify is not None:
        try:
            notify(
                user,
                kind,
                title_en,
                body_en,
                title_ne=title_ne,
                body_ne=body_ne,
                data=data,
                link=link,
                sms=sms,
            )
            return
        except Exception:  # noqa: BLE001 - fall back to SMS
            logger.exception("notify failed; falling back to SMS")
    if not sms:
        return
    from apps.notifications.services import send_sms

    lang = getattr(user, "preferred_language", None) or "ne"
    send_sms(worker.phone, body_ne if lang == "ne" else body_en, kind=kind)


@shared_task
def expiry_reminders() -> dict:
    """Mark past-expiry documents ``expired``; remind 60/30/7 days before passport, medical and
    police clearance expiry."""
    from .models import ClearanceDocument, TravelDocument

    today = today_ad()
    expired = 0
    for model in (TravelDocument, ClearanceDocument):
        expired += model.objects.filter(status__in=["verified", "pending"], expires_on__lt=today).update(
            status="expired"
        )

    targets = [today + dt.timedelta(days=d) for d in REMINDER_DAYS]
    due = [
        *TravelDocument.objects.filter(
            kind__in=REMIND_TRAVEL_KINDS, status__in=["verified", "pending"], expires_on__in=targets
        ).select_related("worker__user"),
        *ClearanceDocument.objects.filter(
            kind__in=REMIND_CLEARANCE_KINDS, status__in=["verified", "pending"], expires_on__in=targets
        ).select_related("worker__user"),
    ]
    reminded = 0
    for doc in due:
        days = (doc.expires_on - today).days
        en = (
            f"KaamSathi: your {KIND_EN[doc.kind]} expires in {days} days ({format_bs_en(doc.expires_on)}). "
            "Renew it in time and upload the new one in the app."
        )
        ne = (
            f"कामसाथी: तपाईंको {KIND_NE[doc.kind]} {to_devanagari(days)} दिनमा "
            f"({format_bs_ne(doc.expires_on)}) "
            "म्याद सकिँदैछ। समयमै नवीकरण गरी नयाँ कागजात एपमा अपलोड गर्नुहोस्।"
        )
        notify_worker(
            doc.worker,
            kind="mobility_expiry",
            title_en=f"{KIND_EN[doc.kind].capitalize()} expires in {days} days",
            title_ne=f"{KIND_NE[doc.kind]} {to_devanagari(days)} दिनमा म्याद सकिँदै",
            body_en=en,
            body_ne=ne,
            sms=True,
            data={"document_id": str(doc.id), "kind": doc.kind, "days": days},
        )
        reminded += 1
    result = {"expired": expired, "reminded": reminded}
    logger.info("mobility.expiry_reminders %s", result)
    return result
