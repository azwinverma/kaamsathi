"""Booking fee — KaamSathi's own revenue, paid by the **Ghardhani only** (docs/CONTRACT-BOLAU.md §6).

* Sipalu never pay and KaamSathi never holds the Sipalu's money: the only thing collected here is
  the Ghardhani's booking fee (``BOLAU_BOOKING_FEE``, default Rs 49).
* The fee is opened when a booking is accepted. With the ``bolau_fee`` flag off (default) it is
  **waived** and recorded as waived (``billing.Charge(kind=booking_fee, status=waived)``).
* Gateways (eSewa ePay, Khalti KPG) are stubs raising ``NotConfigured`` until a merchant agreement
  and credentials exist. Their webhook is HMAC-SHA256 over ``timestamp + "." + body`` with a skew
  window and replay protection — the same pattern as ``apps/payouts/providers.py``.
* Refund when the Sipalu declines / lets it expire / no-shows / cancels, or when the Ghardhani cancels
  inside the free window. A paid fee whose gateway cannot refund automatically is marked refunded and
  left for ops to return manually (``refund_manual`` in the ledger).
"""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import APIError
from apps.core.money import D, format_npr, q2
from apps.payouts.providers import InvalidSignature, NotConfigured, WebhookReplayed

from . import labels
from .common import error
from .models import Booking

logger = logging.getLogger("kaamsathi.bolau")

__all__ = ["InvalidSignature", "NotConfigured", "WebhookReplayed"]


def fee_amount():
    return q2(D(getattr(settings, "BOLAU_BOOKING_FEE", "49.00")))


def fee_enabled() -> bool:
    from apps.core.flags import is_enabled

    return is_enabled("bolau_fee")


# --------------------------------------------------------------------------- gateways
class Gateway:
    code = ""
    label = ""
    credential_settings: tuple = ()

    def has_credentials(self) -> bool:
        return all(getattr(settings, name, None) for name in self.credential_settings)

    def is_enabled(self) -> bool:
        return fee_enabled() and self.has_credentials()

    def ensure_enabled(self):
        if not self.is_enabled():
            raise NotConfigured(f"{self.label} payments are not enabled yet.")

    def initiate(self, booking: Booking) -> dict:
        """Start a payment for the booking fee → ``{redirect_url, reference}``."""
        self.ensure_enabled()
        # Live API call (eSewa ePay v2 form / Khalti KPG initiate) goes here once the merchant
        # agreement and sandbox credentials exist.
        raise NotConfigured(f"{self.label} payments are not enabled yet.")  # pragma: no cover

    def refund(self, booking: Booking) -> bool:
        """Ask the gateway to refund; False = not possible automatically (ops refund manually)."""
        return False

    # ----------------------------------------------------------- webhooks
    def webhook_secret(self) -> str | None:
        return (getattr(settings, "BOLAU_WEBHOOK_SECRETS", None) or {}).get(self.code)

    def verify_signature(self, request) -> str:
        """``X-Signature: sha256=<hex hmac(secret, ts + "." + body)>`` + ``X-Timestamp`` (required).

        The timestamp must be within ``BOLAU_WEBHOOK_MAX_SKEW_SECONDS`` (300) and an exact replay of a
        verified delivery → 409 ``webhook_replayed``. Returns the replay-cache key.
        """
        secret = self.webhook_secret()
        if not secret:
            raise NotConfigured()
        ts = (request.headers.get("X-Timestamp") or "").strip()
        try:
            ts_value = int(ts)
        except ValueError as exc:
            raise InvalidSignature("Missing or invalid X-Timestamp.") from exc
        skew = abs(timezone.now().timestamp() - ts_value)
        if skew > int(getattr(settings, "BOLAU_WEBHOOK_MAX_SKEW_SECONDS", 300)):
            raise InvalidSignature("Webhook timestamp is outside the allowed window.")
        expected = hmac.new(secret.encode(), ts.encode() + b"." + request.body, hashlib.sha256).hexdigest()
        given = (request.headers.get("X-Signature") or "").strip().lower()
        if given.startswith("sha256="):
            given = given[7:]
        if not given or not hmac.compare_digest(expected, given):
            raise InvalidSignature()
        from django.core.cache import cache

        key = "ks:bolau-webhook:" + hashlib.sha256(f"{self.code}:{given}".encode()).hexdigest()
        if not cache.add(key, 1, int(getattr(settings, "BOLAU_WEBHOOK_REPLAY_TTL_SECONDS", 86400))):
            raise WebhookReplayed()
        return key

    def parse(self, request) -> dict:
        try:
            payload = json.loads(request.body or b"{}")
        except ValueError as exc:
            raise APIError("validation_error", message="Invalid JSON body.") from exc
        if not isinstance(payload, dict):
            raise APIError("validation_error", message="Invalid JSON body.")
        return payload


class EsewaGateway(Gateway):
    code = "esewa"
    label = "eSewa"
    credential_settings = ("ESEWA_MERCHANT_CODE", "ESEWA_SECRET_KEY")


class KhaltiGateway(Gateway):
    code = "khalti"
    label = "Khalti"
    credential_settings = ("KHALTI_SECRET_KEY",)


GATEWAYS: dict[str, Gateway] = {g.code: g for g in (EsewaGateway(), KhaltiGateway())}


def get_gateway(code: str) -> Gateway:
    gw = GATEWAYS.get(code)
    if gw is None:
        raise APIError("validation_error", fields={"provider": [f"Unknown provider '{code}'."]})
    return gw


# --------------------------------------------------------------------------- fee lifecycle
def _assert_ghardhani_payer(booking: Booking) -> None:
    """Guiding rule 1: the payer is the Ghardhani who booked — never the Sipalu."""
    if booking.sipalu.user_id and booking.sipalu.user_id == booking.ghardhani_id:
        raise APIError("invalid_state", message=labels.message("self_booking"))


def open_fee(booking: Booking) -> None:
    """Called inside the acceptance transaction. Creates the Charge and sets the booking fee status."""
    from apps.billing.models import Charge

    if booking.fee_charge_id:
        return
    _assert_ghardhani_payer(booking)
    amount = fee_amount()
    enabled = fee_enabled() and amount > 0
    charge = Charge.objects.create(
        payer_user=booking.ghardhani,
        kind="booking_fee",
        amount=amount,
        description=f"Bolau booking fee {booking.code}",
        status="unpaid" if enabled else "waived",
    )
    booking.fee_charge = charge
    booking.booking_fee = amount
    booking.booking_fee_status = "pending" if enabled else "waived"


def settle_fee(booking: Booking, *, refundable: bool) -> None:
    """On cancel / decline / expiry / no-show. ``refundable`` = the Ghardhani is not at fault."""
    charge = booking.fee_charge
    if booking.booking_fee_status == "paid" and refundable:
        try:
            gw = GATEWAYS.get(booking.fee_provider)
            automatic = bool(gw and gw.refund(booking))
        except Exception:  # noqa: BLE001
            logger.exception("bolau refund failed for %s", booking.code)
            automatic = False
        booking.booking_fee_status = "refunded"
        if charge is not None:
            charge.status = "refunded"
            charge.save(update_fields=["status"])
        booking.fee_refund_manual = not automatic
    elif booking.booking_fee_status == "pending" and refundable:
        booking.booking_fee_status = "waived"
        if charge is not None:
            charge.status = "waived"
            charge.save(update_fields=["status"])


def start_payment(booking: Booking, provider: str) -> dict:
    if booking.booking_fee_status != "pending":
        raise error("invalid_state", "fee_not_payable")
    gw = get_gateway(provider)
    return gw.initiate(booking)


@transaction.atomic
def apply_webhook(provider: str, payload: dict) -> dict:
    """``{reference: "BK-…", status: paid|failed|refunded, transaction_id?, amount?}`` → fee status."""
    ref = str(payload.get("reference") or payload.get("booking_code") or "").strip()
    status = str(payload.get("status") or "").strip().lower()
    booking = (
        Booking.objects.select_for_update(of=("self",)).select_related("fee_charge").filter(code=ref).first()
    )
    if booking is None:
        return {"applied": False, "reason": "unknown_reference"}
    if booking.fee_provider and booking.fee_provider != provider:
        return {"applied": False, "reason": "provider_mismatch"}
    if status in ("paid", "success", "completed", "complete"):
        if booking.booking_fee_status != "pending":
            return {"applied": False, "reason": "not_pending"}
        amount = payload.get("amount")
        if amount is not None and q2(D(amount)) != q2(booking.booking_fee):
            return {"applied": False, "reason": "amount_mismatch"}
        booking.booking_fee_status = "paid"
        booking.fee_provider = provider
        booking.fee_reference = str(payload.get("transaction_id") or "")[:80]
        booking.fee_paid_at = timezone.now()
        booking.save(
            update_fields=["booking_fee_status", "fee_provider", "fee_reference", "fee_paid_at", "updated_at"]
        )
        if booking.fee_charge_id:
            booking.fee_charge.status = "paid"
            booking.fee_charge.save(update_fields=["status"])
        return {"applied": True, "booking_fee_status": "paid"}
    if status in ("refunded", "reversed") and booking.booking_fee_status == "paid":
        booking.booking_fee_status = "refunded"
        booking.save(update_fields=["booking_fee_status", "updated_at"])
        if booking.fee_charge_id:
            booking.fee_charge.status = "refunded"
            booking.fee_charge.save(update_fields=["status"])
        return {"applied": True, "booking_fee_status": "refunded"}
    return {"applied": False, "reason": "ignored_status"}


# --------------------------------------------------------------------------- receipt
def receipt_pdf(booking: Booking) -> bytes:
    """Bilingual receipt for a paid booking fee (no invoice — the Ghardhani is an individual)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A5
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    from apps.compliance.pdf import devanagari_font

    font = devanagari_font()
    styles = getSampleStyleSheet()
    base = ParagraphStyle("b", parent=styles["Normal"], fontSize=9.5, leading=13)
    ne = ParagraphStyle("ne", parent=base, fontName=font) if font else None
    title = ParagraphStyle("t", parent=styles["Title"], fontSize=15)

    def bi(en: str, np: str):
        if ne is None:
            return Paragraph(en, base)
        return [Paragraph(en, base), Paragraph(np, ne)]

    paid_at = timezone.localtime(booking.fee_paid_at) if booking.fee_paid_at else None
    rows = [
        [bi("Receipt for", "रसिद"), Paragraph(f"Bolau booking fee · {booking.code}", base)],
        [
            bi("Paid by (Ghardhani)", "भुक्तानी गर्ने (घरधनी)"),
            Paragraph(booking.ghardhani.full_name or "—", base),
        ],
        [bi("Amount", "रकम"), Paragraph(format_npr(booking.booking_fee), base)],
        [
            bi("Paid on", "भुक्तानी मिति"),
            Paragraph(paid_at.strftime("%Y-%m-%d %H:%M") if paid_at else "—", base),
        ],
        [bi("Method", "माध्यम"), Paragraph(booking.fee_provider or "—", base)],
        [bi("Reference", "सन्दर्भ"), Paragraph(booking.fee_reference or "—", base)],
    ]
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A5, leftMargin=12 * mm, rightMargin=12 * mm, topMargin=12 * mm)
    table = Table(rows, colWidths=[45 * mm, 75 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
            ]
        )
    )
    note_en = (
        "This fee is KaamSathi's booking service charge paid by the Ghardhani. The price of the work is "
        "paid directly to the Sipalu and is not collected by KaamSathi. Sipalu never pay any fee."
    )
    note_ne = (
        "यो शुल्क घरधनीले तिर्ने KaamSathi को बुकिङ सेवा शुल्क हो। कामको मूल्य सिधै सिपालुलाई तिरिन्छ, "
        "KaamSathi ले उठाउँदैन। सिपालुले कुनै शुल्क तिर्नु पर्दैन।"
    )
    story = [Paragraph("KaamSathi — Receipt", title)]
    if ne is not None:
        story.append(Paragraph("KaamSathi — रसिद", ne))
    story += [Spacer(1, 4 * mm), table, Spacer(1, 4 * mm), Paragraph(note_en, base)]
    if ne is not None:
        story.append(Paragraph(note_ne, ne))
    doc.build(story)
    return buf.getvalue()
