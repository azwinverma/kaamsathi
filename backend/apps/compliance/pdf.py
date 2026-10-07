"""Bilingual appointment letter (नियुक्ति पत्र) PDF — Labour Act 2074 essentials.

⚠ TEMPLATE — review with a labour lawyer before relying on it.

Devanagari: reportlab's built-in fonts have no Devanagari glyphs, so we register the Mukta TTF
(the app's Devanagari face, DESIGN.md) when it can be found (``settings.PDF_DEVANAGARI_FONT`` or
the copy shipped with the mobile app). Without it the letter is rendered in English only.
ReportLab does not shape complex scripts, so conjuncts may render unjoined — the English text is
the reference version.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path
from xml.sax.saxutils import escape

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.core.bs import bs_str, format_bs_en, to_devanagari
from apps.core.money import format_npr

logger = logging.getLogger("kaamsathi.compliance")

FOOTER = "Template — review with a labour lawyer · टेम्प्लेट — श्रम कानून विज्ञसँग समीक्षा गर्नुहोस्"
FOOTER_EN = "Template — review with a labour lawyer"
_FONT_NAME = "KSDevanagari"
_font_state: dict = {}


def _font_candidates():
    explicit = getattr(settings, "PDF_DEVANAGARI_FONT", None)
    if explicit:
        yield Path(explicit)
    base = Path(settings.BASE_DIR)
    for root in (base, base.parent):
        yield root / "assets" / "fonts" / "Mukta-Regular.ttf"
        yield root / "mobile" / "assets" / "fonts" / "Mukta-Regular.ttf"
    yield Path("/usr/share/fonts/truetype/mukta/Mukta-Regular.ttf")


def devanagari_font() -> str | None:
    """Register (once) and return the Devanagari font name, or None if unavailable."""
    if "name" in _font_state:
        return _font_state["name"]
    name = None
    for path in _font_candidates():
        try:
            if path.is_file():
                pdfmetrics.registerFont(TTFont(_FONT_NAME, str(path)))
                name = _FONT_NAME
                break
        except Exception:  # noqa: BLE001 - unreadable font file → try next
            logger.warning("Could not register Devanagari font %s", path)
    _font_state["name"] = name
    return name


def _p(text: str, style) -> Paragraph:
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def _clauses(t: dict) -> list[tuple[str, str, str]]:
    """(heading, English, Nepali) for each clause of the letter."""
    monthly = t["wage_type"] == "monthly"
    if monthly:
        wage_en = (
            f"Basic salary {format_npr(t['basic_salary'])}, dearness allowance "
            f"{format_npr(t['dearness_allowance'])} and other allowance {format_npr(t['other_allowance'])} "
            f"per month (total {format_npr(t['monthly_gross'])}), paid monthly by the 15th of the following "
            "Bikram Sambat month."
        )
        wage_ne = (
            f"मासिक आधारभूत तलब रु. {to_devanagari(t['basic_salary'])}, महँगी भत्ता रु. "
            f"{to_devanagari(t['dearness_allowance'])} र अन्य भत्ता रु. {to_devanagari(t['other_allowance'])} "
            f"(जम्मा रु. {to_devanagari(t['monthly_gross'])})। तलब अर्को महिनाको १५ गतेभित्र भुक्तानी गरिनेछ।"
        )
    else:
        wage_en = (
            f"Daily wage (jyala) {format_npr(t['daily_wage'])} per day worked, paid at least monthly, "
            "split into basic and dearness allowance as per the minimum wage notice."
        )
        wage_ne = (
            f"काम गरेको प्रतिदिन रु. {to_devanagari(t['daily_wage'])} दैनिक ज्याला, कम्तीमा मासिक रूपमा "
            "भुक्तानी गरिनेछ।"
        )
    shift = t.get("shift")
    hours_en = "Working hours: 8 hours a day and 48 hours a week, with a rest break of at least 30 minutes"
    hours_ne = "काम गर्ने समय: दिनको ८ घण्टा र हप्ताको ४८ घण्टा, कम्तीमा ३० मिनेट विश्राम सहित"
    if shift:
        hours_en += f" (shift: {shift['name']} {shift['start_time']}–{shift['end_time']})"
        hours_ne += f" (सिफ्ट: {shift['name']} {shift['start_time']}–{shift['end_time']})"
    hours_en += f". Weekly off: {t['weekly_off_en']}."
    hours_ne += f"। साप्ताहिक बिदा: {t['weekly_off_ne']}।"
    ssf_en = (
        "The worker is enrolled in the Social Security Fund (SSF): 11% of basic salary is deducted "
        "from the worker and the employer contributes 20%."
        if t["ssf_enrolled"]
        else "The employer will enrol the worker in the Social Security Fund (SSF) as required by the "
        "Contribution-based Social Security Act 2074 (11% worker, 20% employer of basic salary)."
    )
    ssf_ne = (
        "कामदार सामाजिक सुरक्षा कोषमा सूचीकृत छन्: आधारभूत तलबको ११% कामदारबाट कट्टी र २०% रोजगारदाताबाट योगदान।"
        if t["ssf_enrolled"]
        else "योगदानमा आधारित सामाजिक सुरक्षा ऐन २०७४ बमोजिम रोजगारदाताले कामदारलाई सामाजिक सुरक्षा कोषमा "
        "सूचीकृत गर्नेछ (आधारभूत तलबको ११% कामदार, २०% रोजगारदाता)।"
    )
    return [
        (
            "1. Appointment / नियुक्ति",
            f"{t['org_name']} appoints {t['worker_name']} as {t['designation'] or t['trade'] or 'worker'}"
            f"{' at ' + t['site_name'] if t.get('site_name') else ''} from {t['start_date_bs']} B.S. "
            f"({t['start_date']} A.D.).",
            f"{t.get('org_name_ne') or t['org_name']} ले {t.get('worker_name_ne') or t['worker_name']} लाई "
            f"{t['designation'] or t['trade'] or 'कामदार'} पदमा "
            f"{(t['site_name'] + ' मा ') if t.get('site_name') else ''}"
            f"वि.सं. {to_devanagari(t['start_date_bs'])} देखि नियुक्त गरेको छ।",
        ),
        ("2. Wages / पारिश्रमिक", wage_en, wage_ne),
        ("3. Working hours / काम गर्ने समय", hours_en, hours_ne),
        (
            "4. Overtime / ओभरटाइम",
            "Work beyond 8 hours a day or 48 hours a week is overtime, paid at 1.5 times the hourly wage, "
            "and may not exceed 4 hours a day or 24 hours a week.",
            "दिनको ८ घण्टा वा हप्ताको ४८ घण्टाभन्दा बढी काम ओभरटाइम हो, जसको पारिश्रमिक प्रतिघण्टा "
            "ज्यालाको डेढी (१.५ गुणा) हुनेछ। ओभरटाइम दिनको ४ घण्टा वा हप्ताको २४ घण्टाभन्दा बढी हुने छैन।",
        ),
        (
            "5. Leave / बिदा",
            "Public holidays as notified; home leave 1 day for every 20 days worked; sick leave 12 days a "
            "year (half pay rules per law); mourning leave 13 days; maternity leave 98 days (60 days paid); "
            "paternity leave 15 days.",
            "सार्वजनिक बिदा सूचना बमोजिम; प्रत्येक २० दिन कामबापत १ दिन घर बिदा; वार्षिक १२ दिन बिरामी बिदा; "
            "किरिया बिदा १३ दिन; प्रसूति बिदा ९८ दिन (६० दिन सशुल्क); पितृत्व बिदा १५ दिन।",
        ),
        ("6. Social security / सामाजिक सुरक्षा", ssf_en, ssf_ne),
        (
            "7. Festival allowance / चाडपर्व खर्च",
            "One month's basic salary as festival (Dashain) allowance each year, prorated for less than a "
            "year of service.",
            "हरेक वर्ष एक महिनाको आधारभूत तलब बराबर चाडपर्व खर्च, एक वर्षभन्दा कम सेवामा दामासाहीले।",
        ),
        (
            "8. Probation / परीक्षणकाल",
            "Probation of up to 6 months from the start date, during which either party may end the "
            "employment by giving notice as per law.",
            "सुरु मितिदेखि बढीमा ६ महिना परीक्षणकाल हुनेछ, जुन अवधिमा कानून बमोजिम सूचना दिई रोजगारी अन्त्य गर्न सकिनेछ।",
        ),
        (
            "9. Notice / सूचना",
            "Either party may end the employment with notice as per the Labour Act 2074 (at least 1 month "
            "after probation), or pay in lieu of notice.",
            "श्रम ऐन २०७४ बमोजिम सूचना दिई (परीक्षणकालपछि कम्तीमा १ महिना) वा सूचना अवधिको पारिश्रमिक "
            "दिई जुनसुकै पक्षले रोजगारी अन्त्य गर्न सक्नेछ।",
        ),
        (
            "10. Grievances / गुनासो",
            "Grievances may be raised with the employer in writing or through the KaamSathi app; unresolved "
            "matters may be taken to the Labour Office.",
            "गुनासो रोजगारदातालाई लिखित रूपमा वा कामसाथी एपमार्फत दिन सकिनेछ; समाधान नभएमा श्रम कार्यालयमा "
            "उजुरी गर्न सकिनेछ।",
        ),
    ]


def contract_pdf(contract) -> bytes:
    t = contract.terms
    deva = devanagari_font() if contract.language in ("ne", "both") else None
    show_en = contract.language in ("en", "both") or deva is None
    show_ne = deva is not None and contract.language in ("ne", "both")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=f"Appointment letter — {t['worker_name']} (v{contract.version})",
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9.5, leading=13)
    head = ParagraphStyle("head", parent=styles["Heading4"], fontSize=10, spaceBefore=6, spaceAfter=2)
    ne_style = ParagraphStyle(
        "ne", parent=body, fontName=deva or "Helvetica", leading=15, textColor=colors.HexColor("#373D4C")
    )
    ne_title = ParagraphStyle("ne_title", parent=ne_style, fontSize=14, leading=20, alignment=1)

    story = [
        Paragraph(f"<font color='#2647C4'><b>{escape(t['org_name'])}</b></font>", styles["Title"]),
        _p(
            " · ".join(
                x
                for x in [
                    t.get("org_address"),
                    t.get("org_district"),
                    t.get("org_pan") and f"PAN {t['org_pan']}",
                ]
                if x
            ),
            ParagraphStyle("c", parent=body, alignment=1),
        ),
        Spacer(1, 4 * mm),
        Paragraph(
            "<b>Appointment letter (Employment contract)</b>",
            ParagraphStyle("t", parent=styles["Heading2"], alignment=1),
        ),
    ]
    if show_ne:
        story.append(_p("नियुक्ति पत्र (रोजगार सम्झौता)", ne_title))
    story += [
        _p(
            f"Version {contract.version} · Generated {format_bs_en(contract.generated_at.date())} B.S.",
            ParagraphStyle("meta", parent=body, alignment=1, textColor=colors.HexColor("#6B7383")),
        ),
        Spacer(1, 4 * mm),
    ]
    parties = [
        ["Employer / रोजगारदाता" if show_ne else "Employer", t["org_name"]],
        ["Worker / कामदार" if show_ne else "Worker", t["worker_name"]],
        ["Citizenship no.", t.get("citizenship_no") or "—"],
        ["Designation", t.get("designation") or "—"],
        ["Work site", t.get("site_name") or "—"],
        ["Start date", f"{t['start_date_bs']} B.S. ({t['start_date']})"],
        ["Wage type", "Monthly salary" if t["wage_type"] == "monthly" else "Daily wage (jyala)"],
    ]
    font = deva or "Helvetica"
    table = Table(parties, colWidths=[45 * mm, 125 * mm])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6B7383")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE1E8")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story += [table, Spacer(1, 4 * mm)]

    for heading, en, ne in _clauses(t):
        block = [
            _p(
                heading if show_ne else heading.split(" / ")[0],
                head if not show_ne else ParagraphStyle("h2", parent=head, fontName=font),
            )
        ]
        if show_en:
            block.append(_p(en, body))
        if show_ne:
            block.append(_p(ne, ne_style))
        story.append(KeepTogether(block))

    story += [Spacer(1, 12 * mm)]
    sig = Table(
        [
            ["______________________", "______________________"],
            [f"For the employer: {t['org_name']}", f"Worker: {t['worker_name']}"],
            ["Signature & date / हस्ताक्षर र मिति" if show_ne else "Signature & date"] * 2,
        ],
        colWidths=[85 * mm, 85 * mm],
    )
    sig.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), font), ("FONTSIZE", (0, 0), (-1, -1), 9)]))
    story.append(sig)
    if contract.accepted_at:
        story += [
            Spacer(1, 4 * mm),
            _p(
                f"Accepted by the worker via {contract.accepted_channel or 'app'} on "
                f"{bs_str(contract.accepted_at.date())} B.S.",
                body,
            ),
        ]

    footer_text = FOOTER if show_ne else FOOTER_EN

    def _footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont(font, 7.5)
        canvas.setFillColor(colors.HexColor("#C8302B"))
        canvas.drawCentredString(A4[0] / 2, 10 * mm, footer_text)
        canvas.setFillColor(colors.HexColor("#6B7383"))
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"v{contract.version} · {canvas.getPageNumber()}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
