"""IRD e-billing / CBMS (Central Billing Monitoring System) adapter — **stub, disabled**.

Nepal's IRD requires large taxpayers / e-billing users to post every sales invoice (and sales
return / credit note) to CBMS in real time. KaamSathi is not registered for e-billing yet, so this
adapter only builds the payload; ``post_*`` raise :class:`NotConfigured` until

* ``IRD_CBMS_ENABLED = True`` and
* ``IRD_CBMS_URL``, ``IRD_CBMS_USERNAME``, ``IRD_CBMS_PASSWORD``, ``BILLING_SELLER_PAN`` are set

and the live call is implemented against the IRD-issued spec (field names below follow the public
CBMS "bill" API; confirm with the IRD-approved billing software certification before going live).
Manual fallback: the PDF invoice + monthly VAT return (Annex 13 sales book) from the ops console.
"""

from __future__ import annotations

from django.conf import settings

from apps.core.bs import bs_str


class NotConfigured(Exception):
    """CBMS sync is disabled or missing credentials."""


def is_enabled() -> bool:
    return bool(getattr(settings, "IRD_CBMS_ENABLED", False)) and all(
        getattr(settings, key, "") for key in ("IRD_CBMS_URL", "IRD_CBMS_USERNAME", "IRD_CBMS_PASSWORD")
    )


def _bs_slash(value) -> str:
    return (bs_str(value) or "").replace("-", ".")


def bill_payload(invoice) -> dict:
    """CBMS ``/api/bill`` body for an issued invoice."""
    return {
        "username": getattr(settings, "IRD_CBMS_USERNAME", ""),
        "password": "***",  # filled in at send time, never logged
        "seller_pan": getattr(settings, "BILLING_SELLER_PAN", ""),
        "buyer_pan": invoice.pan_of_buyer or "",
        "buyer_name": invoice.buyer_name,
        "fiscal_year": invoice.fiscal_year.replace("/", "."),
        "invoice_number": invoice.number,
        "invoice_date": _bs_slash(invoice.issue_date),
        "total_sales": float(invoice.total),
        "taxable_sales_vat": float(invoice.subtotal),
        "vat": float(invoice.vat_amount),
        "excisable_amount": 0,
        "excise": 0,
        "taxable_sales_hst": 0,
        "hst": 0,
        "amount_for_esf": 0,
        "esf": 0,
        "export_sales": 0,
        "tax_exempted_sales": 0,
        "isrealtime": True,
        "datetimeClient": invoice.issued_at.isoformat() if invoice.issued_at else None,
    }


def credit_note_payload(note) -> dict:
    """CBMS ``/api/billreturn`` body for a credit note (sales return)."""
    inv = note.invoice
    return {
        "seller_pan": getattr(settings, "BILLING_SELLER_PAN", ""),
        "buyer_pan": inv.pan_of_buyer or "",
        "buyer_name": inv.buyer_name,
        "fiscal_year": inv.fiscal_year.replace("/", "."),
        "ref_invoice_number": inv.number,
        "credit_note_number": note.number,
        "credit_note_date": _bs_slash(note.issue_date),
        "reason_for_return": note.reason,
        "total_sales": float(note.amount),
        "taxable_sales_vat": float(note.amount - note.vat_amount),
        "vat": float(note.vat_amount),
        "isrealtime": True,
    }


def post_invoice(invoice) -> dict:
    if not is_enabled():
        raise NotConfigured("IRD CBMS sync is disabled (IRD_CBMS_ENABLED / credentials not set).")
    raise NotConfigured("IRD CBMS live mode is not implemented yet — needs IRD e-billing registration.")


def post_credit_note(note) -> dict:
    if not is_enabled():
        raise NotConfigured("IRD CBMS sync is disabled (IRD_CBMS_ENABLED / credentials not set).")
    raise NotConfigured("IRD CBMS live mode is not implemented yet — needs IRD e-billing registration.")
