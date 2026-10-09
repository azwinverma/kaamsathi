"""Bolau notifications: every booking / request / offer transition → ``notify()`` in English + Nepali.

Templates are bilingual literals (``{code}``, ``{name}``, ``{when}``, ``{trade}`` placeholders). SMS goes
out for request / accept / decline / cancel / on-the-way (arrival near) per the contract; everything
else is inbox + push. Bodies never contain phone numbers or addresses.
"""

from __future__ import annotations

import logging

from django.utils import timezone

logger = logging.getLogger("kaamsathi.bolau")

# event → (title_en, title_ne, body_en, body_ne, sms)
TEMPLATES: dict[str, tuple[str, str, str, str, bool]] = {
    "booking_requested": (
        "New Bolau booking request",
        "नयाँ बोलाउ अनुरोध",
        "{name} wants to book you for {trade} on {when} ({code}). Accept or decline in the app.",
        "{name} ले तपाईंलाई {when} मा {trade} कामका लागि बोलाउन चाहनुहुन्छ ({code})। "
        "एपमा स्वीकार वा अस्वीकार गर्नुहोस्।",
        True,
    ),
    "booking_accepted": (
        "Booking accepted",
        "बुकिङ स्वीकार भयो",
        "{name} accepted your booking {code} for {when}.",
        "{name} ले {when} को बुकिङ {code} स्वीकार गर्नुभयो।",
        True,
    ),
    "booking_instant": (
        "New confirmed booking",
        "नयाँ पक्का बुकिङ",
        "Instant booking {code}: {trade} on {when}. See the details in the app.",
        "तुरुन्त बुकिङ {code}: {when} मा {trade} काम। विवरण एपमा हेर्नुहोस्।",
        True,
    ),
    "booking_declined": (
        "Booking declined",
        "बुकिङ अस्वीकार भयो",
        "{name} cannot take booking {code}. Try another Sipalu.",
        "{name} ले बुकिङ {code} लिन सक्नुहुन्न। अर्को सिपालु खोज्नुहोस्।",
        True,
    ),
    "booking_expired": (
        "Booking request expired",
        "बुकिङ अनुरोधको समय सकियो",
        "Booking {code} was not answered in time. Any fee is refunded.",
        "बुकिङ {code} को समयमै जवाफ आएन। शुल्क भए फिर्ता हुन्छ।",
        False,
    ),
    "booking_on_the_way": (
        "Your Sipalu is on the way",
        "तपाईंको सिपालु आउँदै हुनुहुन्छ",
        "{name} is on the way for booking {code}. Keep your arrival code ready.",
        "{name} बुकिङ {code} का लागि आउँदै हुनुहुन्छ। आगमन कोड तयार राख्नुहोस्।",
        True,
    ),
    "booking_arrived": (
        "Sipalu arrived",
        "सिपालु आइपुग्नुभयो",
        "{name} has arrived for booking {code}.",
        "{name} बुकिङ {code} का लागि आइपुग्नुभयो।",
        False,
    ),
    "booking_quote": (
        "Quote to approve",
        "स्वीकृत गर्नुपर्ने मूल्य",
        "{name} quoted {amount} for booking {code}. Approve it before work starts.",
        "{name} ले बुकिङ {code} का लागि {amount} मूल्य दिनुभयो। काम सुरु हुनुअघि स्वीकृत गर्नुहोस्।",
        False,
    ),
    "booking_quote_approved": (
        "Quote approved",
        "मूल्य स्वीकृत भयो",
        "The Ghardhani approved your quote for booking {code}. You can start work.",
        "घरधनीले बुकिङ {code} को मूल्य स्वीकृत गर्नुभयो। काम सुरु गर्न सक्नुहुन्छ।",
        False,
    ),
    "booking_quote_rejected": (
        "Quote declined",
        "मूल्य अस्वीकार भयो",
        "The Ghardhani declined your quote for booking {code}. Only the visit fee is due.",
        "घरधनीले बुकिङ {code} को मूल्य अस्वीकार गर्नुभयो। भ्रमण शुल्क मात्र तिर्नुपर्छ।",
        False,
    ),
    "booking_started": (
        "Work started",
        "काम सुरु भयो",
        "Work on booking {code} has started.",
        "बुकिङ {code} को काम सुरु भयो।",
        False,
    ),
    "booking_completed": (
        "Work completed — please confirm",
        "काम सकियो — पुष्टि गर्नुहोस्",
        "{name} marked booking {code} complete. Pay the Sipalu directly and confirm in the app.",
        "{name} ले बुकिङ {code} सकियो भन्नुभयो। सिपालुलाई सिधै भुक्तानी गरी एपमा पुष्टि गर्नुहोस्।",
        False,
    ),
    "booking_confirmed": (
        "Booking confirmed",
        "बुकिङ पुष्टि भयो",
        "Booking {code} is confirmed. You can now rate each other.",
        "बुकिङ {code} पुष्टि भयो। अब एकअर्कालाई मूल्याङ्कन गर्न सक्नुहुन्छ।",
        False,
    ),
    "booking_cancelled": (
        "Booking cancelled",
        "बुकिङ रद्द भयो",
        "Booking {code} for {when} was cancelled.",
        "{when} को बुकिङ {code} रद्द भयो।",
        True,
    ),
    "booking_no_show": (
        "No-show reported",
        "नआएको रिपोर्ट भयो",
        "The Ghardhani reported that nobody came for booking {code}.",
        "घरधनीले बुकिङ {code} मा कोही नआएको रिपोर्ट गर्नुभयो।",
        False,
    ),
    "booking_disputed": (
        "Booking dispute raised",
        "बुकिङ विवाद दर्ता भयो",
        "A dispute was raised for booking {code}. KaamSathi will review it.",
        "बुकिङ {code} मा विवाद दर्ता भयो। KaamSathi ले हेर्नेछ।",
        False,
    ),
    "booking_paid": (
        "Payment marked",
        "भुक्तानी जनाइयो",
        "Payment to the Sipalu for booking {code} was marked as paid.",
        "बुकिङ {code} को सिपालुलाई भुक्तानी भएको जनाइयो।",
        False,
    ),
    "booking_reminder": (
        "Booking soon",
        "बुकिङ छिट्टै",
        "Reminder: booking {code} starts at {when}.",
        "सम्झना: बुकिङ {code} {when} मा सुरु हुन्छ।",
        False,
    ),
    "request_new": (
        "New Kaam request near you",
        "तपाईं नजिक नयाँ कामको अनुरोध",
        "A Ghardhani needs a {trade} ({code}). Send an offer in the app.",
        "एक घरधनीलाई {trade} चाहिएको छ ({code})। एपमा प्रस्ताव पठाउनुहोस्।",
        False,
    ),
    "offer_new": (
        "New offer",
        "नयाँ प्रस्ताव",
        "{name} sent an offer of {amount} for your request {code}.",
        "{name} ले तपाईंको अनुरोध {code} का लागि {amount} को प्रस्ताव पठाउनुभयो।",
        False,
    ),
    "offer_accepted": (
        "Your offer was accepted",
        "तपाईंको प्रस्ताव स्वीकार भयो",
        "Your offer was accepted. Booking {code} is confirmed for {when}.",
        "तपाईंको प्रस्ताव स्वीकार भयो। बुकिङ {code} {when} का लागि पक्का भयो।",
        True,
    ),
    "offer_rejected": (
        "Offer not chosen",
        "प्रस्ताव छानिएन",
        "The Ghardhani chose another offer for request {code}.",
        "घरधनीले अनुरोध {code} का लागि अर्को प्रस्ताव छान्नुभयो।",
        False,
    ),
    "request_expired": (
        "Kaam request expired",
        "कामको अनुरोधको समय सकियो",
        "Your request {code} expired. Post it again or book a Sipalu directly.",
        "तपाईंको अनुरोध {code} को समय सकियो। फेरि पोस्ट गर्नुहोस् वा सिधै सिपालु बोलाउनुहोस्।",
        False,
    ),
    "sipalu_suspended": (
        "Bolau paused on your profile",
        "तपाईंको प्रोफाइलमा बोलाउ रोकियो",
        "KaamSathi paused bookings on your profile. Contact support to know more.",
        "KaamSathi ले तपाईंको प्रोफाइलमा बुकिङ रोकेको छ। थप जान्न सहायतामा सम्पर्क गर्नुहोस्।",
        False,
    ),
    "sipalu_unsuspended": (
        "Bolau is open again",
        "बोलाउ फेरि खुल्यो",
        "Bookings are allowed on your profile again. Turn Bolau on when you are ready.",
        "तपाईंको प्रोफाइलमा फेरि बुकिङ गर्न मिल्छ। तयार हुँदा बोलाउ सुरु गर्नुहोस्।",
        False,
    ),
}


def when_text(value) -> str:
    if value is None:
        return ""
    return timezone.localtime(value).strftime("%Y-%m-%d %H:%M")


def send(user, event: str, *, link: str | None = None, data: dict | None = None, **ctx) -> None:
    """Notify ``user`` about ``event``; never raises (a notification must not break a booking)."""
    if user is None:
        return
    spec = TEMPLATES.get(event)
    if spec is None:  # pragma: no cover - programming error
        logger.error("Unknown bolau notification %s", event)
        return
    title, title_ne, body, body_ne, sms = spec

    class _Safe(dict):
        def __missing__(self, key):
            return ""

    values = _Safe({k: ("" if v is None else v) for k, v in ctx.items()})
    try:
        from apps.notifications.services import notify

        notify(
            user,
            f"bolau_{event}",
            title,
            body.format_map(values),
            title_ne=title_ne,
            body_ne=body_ne.format_map(values),
            data=data or {},
            link=link,
            sms=sms,
        )
    except Exception:  # noqa: BLE001
        logger.exception("bolau notify %s failed", event)


def booking_ctx(booking, *, name: str = "") -> dict:
    return {
        "code": booking.code,
        "when": when_text(booking.scheduled_start),
        "trade": booking.trade.name_en if booking.trade_id else "",
        "name": name,
    }


def to_ghardhani(booking, event: str, **extra) -> None:
    ctx = booking_ctx(
        booking, name=booking.sipalu.full_name.split(" ")[0] if booking.sipalu.full_name else ""
    )
    ctx.update(extra)
    send(
        booking.ghardhani,
        event,
        link=f"/ghar/bookings/{booking.id}",
        data={"booking_id": str(booking.id), "code": booking.code},
        **ctx,
    )


def to_sipalu(booking, event: str, **extra) -> None:
    user = booking.sipalu.user
    if user is None:
        return
    gh = booking.ghardhani
    name = (getattr(getattr(gh, "ghardhani", None), "display_name", "") or gh.full_name or "").split(" ")[0]
    ctx = booking_ctx(booking, name=name)
    ctx.update(extra)
    send(
        user,
        event,
        link=f"/bolau/jobs/{booking.id}",
        data={"booking_id": str(booking.id), "code": booking.code},
        **ctx,
    )
