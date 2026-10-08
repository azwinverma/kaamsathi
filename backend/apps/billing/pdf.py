"""Bilingual (English / नेपाली) tax invoice PDF.

⚠ Format to be confirmed with a tax adviser against IRD requirements (VAT invoice must show the
seller PAN/VAT no., buyer PAN for registered buyers, invoice number, BS date, taxable amount, VAT).
Reuses the Devanagari font registration from ``apps.compliance.pdf``; without the font the invoice
is rendered in English only.
"""

from __future__ import annotations

import io
from xml.sax.saxutils import escape

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.compliance.pdf import devanagari_font
from apps.core.bs import bs_str, format_bs_en
from apps.core.money import format_npr

BRAND = "#2647C4"
MUTED = "#6B7383"
GRID = "#DDE1E8"


def _seller() -> dict:
    return {
        "name": getattr(settings, "BILLING_SELLER_NAME", "KaamSathi Pvt. Ltd."),
        "address": getattr(settings, "BILLING_SELLER_ADDRESS", "Kathmandu, Nepal"),
        "pan": getattr(settings, "BILLING_SELLER_PAN", "") or "—",
    }


def _title(invoice) -> tuple[str, str]:
    if invoice.status == "draft":
        return "PROFORMA (DRAFT) — not a tax invoice", "प्रोफर्मा (मस्यौदा)"
    if invoice.status == "void":
        return "TAX INVOICE — VOID", "कर बीजक — रद्द"
    return "TAX INVOICE", "कर बीजक"


def invoice_pdf(invoice) -> bytes:
    deva = devanagari_font()
    font = deva or "Helvetica"
    seller = _seller()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=f"Invoice {invoice.number or 'draft'}",
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9.5, leading=13)
    small = ParagraphStyle("small", parent=body, fontSize=8, textColor=colors.HexColor(MUTED))
    ne = ParagraphStyle("ne", parent=body, fontName=font, fontSize=11, leading=16, alignment=2)

    def bi(en: str, np: str) -> str:
        return f"{en} / {np}" if deva else en

    title_en, title_ne = _title(invoice)
    head = Table(
        [
            [
                Paragraph(f"<font color='{BRAND}' size='16'><b>{escape(seller['name'])}</b></font>", body),
                Paragraph(
                    f"<b>{escape(title_en)}</b>", ParagraphStyle("t", parent=body, alignment=2, fontSize=12)
                ),
            ],
            [
                Paragraph(f"{escape(seller['address'])}<br/>PAN / VAT: {escape(seller['pan'])}", small),
                Paragraph(escape(title_ne), ne) if deva else "",
            ],
        ],
        colWidths=[100 * mm, 74 * mm],
    )
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))

    issue_bs = bs_str(invoice.issue_date)
    meta = [
        [bi("Invoice no.", "बीजक नं."), invoice.number or "—"],
        [bi("Fiscal year", "आर्थिक वर्ष"), invoice.fiscal_year or "—"],
        [bi("Issue date", "जारी मिति"), f"{issue_bs} B.S. ({invoice.issue_date.isoformat()})"],
        [bi("Due date", "भुक्तानी मिति"), f"{bs_str(invoice.due_date)} B.S. ({invoice.due_date.isoformat()})"],
        [bi("Billed to", "खरिदकर्ता"), invoice.buyer_name or str(invoice.payer)],
        [bi("Buyer address", "ठेगाना"), invoice.buyer_address or "—"],
        [bi("Buyer PAN", "खरिदकर्ताको प्यान"), invoice.pan_of_buyer or "—"],
    ]
    if invoice.period_bs_year and invoice.period_bs_month:
        from apps.core.bs import BSMonth

        month = BSMonth(invoice.period_bs_year, invoice.period_bs_month)
        meta.append(
            [
                bi("Period", "अवधि"),
                f"{month.name_en} {month.year} ({format_bs_en(month.start)} – {format_bs_en(month.end)})",
            ]
        )
    meta_table = Table(meta, colWidths=[52 * mm, 122 * mm])
    meta_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor(MUTED)),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )

    rows = [["#", bi("Description", "विवरण"), bi("Qty", "परिमाण"), bi("Rate", "दर"), bi("Amount", "रकम")]]
    for i, line in enumerate(invoice.lines.all(), start=1):
        rows.append(
            [
                str(i),
                Paragraph(escape(line.description), body),
                f"{line.quantity.normalize():f}",
                format_npr(line.unit_price),
                format_npr(line.amount),
            ]
        )
    n_lines = len(rows)
    rows += [
        ["", bi("Taxable amount", "करयोग्य रकम"), "", "", format_npr(invoice.subtotal)],
        [
            "",
            f"{bi('VAT', 'मूल्य अभिवृद्धि कर')} {invoice.vat_rate.normalize():f}%",
            "",
            "",
            format_npr(invoice.vat_amount),
        ],
        ["", bi("Total", "जम्मा"), "", "", format_npr(invoice.total)],
    ]
    lines = Table(rows, colWidths=[8 * mm, 96 * mm, 18 * mm, 26 * mm, 26 * mm], repeatRows=1)
    lines.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF1FB")),
                ("GRID", (0, 0), (-1, n_lines - 1), 0.5, colors.HexColor(GRID)),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEABOVE", (1, n_lines), (-1, n_lines), 0.5, colors.HexColor(GRID)),
                ("FONTSIZE", (0, -1), (-1, -1), 10.5),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor(BRAND)),
            ]
        )
    )

    story = [head, Spacer(1, 6 * mm), meta_table, Spacer(1, 5 * mm), lines, Spacer(1, 5 * mm)]
    from . import services

    paid, credited = services.paid_amount(invoice), services.credited_amount(invoice)
    if paid or credited:
        story.append(
            Paragraph(
                f"Paid: {format_npr(paid)} · Credited: {format_npr(credited)} · "
                f"Balance due: {format_npr(services.balance_due(invoice))}",
                body,
            )
        )
    if invoice.notes:
        story.append(Paragraph(escape(invoice.notes).replace("\n", "<br/>"), body))
    story += [
        Spacer(1, 4 * mm),
        Paragraph(
            "KaamSathi bills employers and partners only — workers never pay any fee. "
            "Pay by bank transfer quoting the invoice number.",
            small,
        ),
    ]
    if deva:
        story.append(
            Paragraph(
                "कामसाथीले रोजगारदाता र साझेदारलाई मात्र बिल गर्छ — कामदारले कुनै शुल्क तिर्दैनन्।",
                ParagraphStyle("nef", parent=small, fontName=font, fontSize=9, leading=13),
            )
        )

    footer = f"{invoice.number or 'DRAFT'} · {seller['name']}"

    def _footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor(MUTED))
        canvas.drawString(18 * mm, 10 * mm, footer)
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, str(canvas.getPageNumber()))
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
