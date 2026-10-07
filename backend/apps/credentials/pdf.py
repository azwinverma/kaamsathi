"""Bilingual Skill Passport PDF ("KAAM ID") with a QR code to the live verify URL.

Devanagari needs a TrueType font with Devanagari glyphs. We look for one (env
``settings.PDF_DEVANAGARI_FONT``, default: bundled Mukta); if none is
found the PDF is rendered English-only rather than printing empty boxes.
"""

from __future__ import annotations

import io
from xml.sax.saxutils import escape

import qrcode
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.core.bs import format_bs_en, format_bs_ne, to_devanagari
from apps.core.money import format_npr

BRAND = colors.HexColor("#2647C4")
DARK = colors.HexColor("#1B2C63")
MUTED = colors.HexColor("#6B7383")
BORDER = colors.HexColor("#DDE1E8")
SUCCESS = colors.HexColor("#12805C")
SUCCESS_BG = colors.HexColor("#E8F7F0")
ACCENT = colors.HexColor("#DC2B4B")

LEVELS = {
    0: ("Phone verified", "फोन प्रमाणित"),
    1: ("Identity verified", "पहिचान प्रमाणित"),
    2: ("Employment verified", "रोजगारी प्रमाणित"),
    3: ("Skills assessed", "सीप परीक्षण भएको"),
    4: ("Certification verified", "प्रमाणपत्र प्रमाणित"),
    5: ("Highly trusted", "अति भरपर्दो"),
}
CHECK = "•"  # bullet: present in the standard Helvetica encoding (dingbat glyphs are not portable)
NSTB = {"elementary": "Elementary", "level1": "Level 1", "level2": "Level 2", "level3": "Level 3"}


def devanagari_font() -> str | None:
    # One resolver for every PDF (bundled Mukta in backend/assets/fonts, PDF_DEVANAGARI_FONT override).
    from apps.compliance.pdf import devanagari_font as resolve

    return resolve()


def _qr_image(url: str, size_mm: float = 34) -> Image:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1B2C63", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return Image(buf, width=size_mm * mm, height=size_mm * mm)


def passport_pdf(payload: dict) -> bytes:
    deva = devanagari_font()

    def bi(en: str, ne: str | None) -> str:
        """'English / नेपाली' markup when a Devanagari font is available."""
        if deva and ne:
            return f"{escape(en)} <font name='{deva}'>/ {escape(ne)}</font>"
        return escape(en)

    def ne_text(text: str | None) -> str:
        return f"<font name='{deva}'>{escape(text)}</font>" if (deva and text) else ""

    base = ParagraphStyle(
        "base", fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#373D4C")
    )
    small = ParagraphStyle("small", parent=base, fontSize=7.5, leading=10, textColor=MUTED)
    label = ParagraphStyle("label", parent=base, fontSize=7.5, leading=10, textColor=MUTED)
    h_name = ParagraphStyle(
        "name", parent=base, fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=DARK
    )
    h_sec = ParagraphStyle(
        "sec", parent=base, fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=BRAND
    )
    white = ParagraphStyle(
        "white", parent=base, fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=colors.white
    )
    white_small = ParagraphStyle(
        "whites", parent=base, fontSize=8, leading=11, textColor=colors.HexColor("#DCE6FF")
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"KaamSathi Skill Passport — {payload['name']}",
        author="KaamSathi",
    )
    width = A4[0] - 32 * mm

    # Header band
    header = Table(
        [
            [
                Paragraph(bi("KAAM ID · Skill Passport", "सीप राहदानी"), white),
                Paragraph("KaamSathi" + (f" · {ne_text('कामसाथी')}" if deva else ""), white_small),
            ]
        ],
        colWidths=[width * 0.7, width * 0.3],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), DARK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("LINEBELOW", (0, 0), (-1, -1), 2.5, ACCENT),
            ]
        )
    )
    story = [header, Spacer(1, 6 * mm)]

    # Identity block + QR
    level = int(payload.get("verification_level") or 0)
    lvl_en, lvl_ne = LEVELS.get(level, LEVELS[0])
    trade = payload.get("trade_primary")
    districts = ", ".join(d["name_en"] for d in payload.get("districts") or [])
    ident_lines = [Paragraph(escape(payload["name"]), h_name)]
    if payload.get("name_ne") and deva:
        ident_lines.append(
            Paragraph(
                ne_text(payload["name_ne"]), ParagraphStyle("nne", parent=base, fontSize=13, leading=18)
            )
        )
    if trade:
        ident_lines.append(
            Paragraph(
                bi(trade["name_en"], trade.get("name_ne")),
                ParagraphStyle("tr", parent=base, fontSize=11, leading=15),
            )
        )
    if districts:
        ident_lines.append(Paragraph(escape(districts), small))
    ident_lines.append(Spacer(1, 3 * mm))
    level_text = bi(f"Verification level {level} — {lvl_en}", f"तह {to_devanagari(level)} — {lvl_ne}")
    badge = Table(
        [
            [
                Paragraph(
                    f"<b>{CHECK} {level_text}</b>",
                    ParagraphStyle("b", parent=base, textColor=SUCCESS),
                )
            ]
        ],
    )
    badge.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SUCCESS_BG),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("ROUNDEDCORNERS", [4, 4, 4, 4]),
            ]
        )
    )
    ident_lines.append(badge)
    if payload.get("reliability_score") is not None:
        ident_lines.append(Spacer(1, 2 * mm))
        ident_lines.append(
            Paragraph(bi(f"Reliability score: {payload['reliability_score']}/100", "भरपर्दोपन अंक"), base)
        )
    qr_cell = [
        _qr_image(payload["verify_url"]),
        Paragraph(
            bi("Scan to verify", "प्रमाणित गर्न स्क्यान गर्नुहोस्"), ParagraphStyle("qc", parent=small, alignment=1)
        ),
    ]
    top = Table([[ident_lines, qr_cell]], colWidths=[width - 42 * mm, 42 * mm])
    top.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (1, 0), (1, 0), "CENTER")]))
    story += [top, Spacer(1, 5 * mm)]

    def section(title_en, title_ne):
        story.append(Paragraph(bi(title_en, title_ne), h_sec))
        story.append(Spacer(1, 1.5 * mm))

    def grid(rows, col_widths, header=True):
        t = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
        style = [
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        if header:
            style.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF3FF")))
        t.setStyle(TableStyle(style))
        story.append(t)
        story.append(Spacer(1, 4 * mm))

    def p(text, style=base):
        return Paragraph(text, style)

    def check(ok: bool, en: str, ne: str) -> Paragraph:
        state = (
            f"<font color='#12805C'><b>{bi('Verified', 'प्रमाणित')}</b></font>"
            if ok
            else f"<font color='#6B7383'>{bi('Not verified', 'प्रमाणित छैन')}</font>"
        )
        return p(f"{bi(en, ne)}<br/>{state}")

    ident = payload.get("identity") or {}
    section("Identity checks", "पहिचान जाँच")
    grid(
        [
            [
                check(ident.get("citizenship"), "Citizenship / NID", "नागरिकता"),
                check(ident.get("phone"), "Phone", "फोन"),
                check(ident.get("address"), "Address", "ठेगाना"),
            ]
        ],
        [width / 3] * 3,
        header=False,
    )

    if payload.get("skills"):
        section("Skills", "सीप")
        rows = [
            [
                p(bi("Trade", "पेशा"), label),
                p(bi("Experience", "अनुभव"), label),
                p(bi("NSTB level", "एनएसटीबी तह"), label),
            ]
        ]
        for s in payload["skills"]:
            t = s.get("trade") or {}
            rows.append(
                [
                    p(bi(t.get("name_en", ""), t.get("name_ne"))),
                    p(f"{s['years']} yrs"),
                    p(NSTB.get(s.get("nstb_level") or "", "—")),
                ]
            )
        grid(rows, [width * 0.5, width * 0.2, width * 0.3])

    section("Verified credentials", "प्रमाणित प्रमाणपत्रहरू")
    creds = payload.get("credentials") or []
    if creds:
        rows = [
            [
                p(bi("Credential", "प्रमाणपत्र"), label),
                p(bi("Issuer", "जारीकर्ता"), label),
                p(bi("Issued", "जारी मिति"), label),
                p(bi("Valid until", "म्याद"), label),
            ]
        ]
        for c in creds:
            title = f"<b>{escape(c['title'])}</b>"
            if c.get("level"):
                title += f" · {escape(c['level'])}"
            title += f"<br/><font size=7 color='#12805C'>{CHECK} Verified by KaamSathi</font>"
            rows.append(
                [
                    p(title),
                    p(escape(c["issuer"])),
                    p(f"{c['issued_on_bs'] or '—'} B.S."),
                    p(f"{c['expires_on_bs']} B.S." if c.get("expires_on_bs") else "—"),
                ]
            )
        grid(rows, [width * 0.42, width * 0.28, width * 0.15, width * 0.15])
    else:
        story += [
            p(bi("No verified credentials yet.", "अहिलेसम्म प्रमाणित प्रमाणपत्र छैन।"), small),
            Spacer(1, 4 * mm),
        ]

    if payload.get("assessments"):
        section("Skill assessments passed", "उत्तीर्ण सीप परीक्षण")
        rows = [
            [
                p(bi("Trade", "पेशा"), label),
                p(bi("Level", "तह"), label),
                p(bi("Assessed on", "परीक्षण मिति"), label),
            ]
        ]
        for a in payload["assessments"]:
            t = a.get("trade") or {}
            rows.append(
                [
                    p(bi(t.get("name_en", ""), t.get("name_ne"))),
                    p(escape(a.get("level") or "—")),
                    p(f"{a['assessed_on_bs']} B.S."),
                ]
            )
        grid(rows, [width * 0.5, width * 0.2, width * 0.3])

    work = payload.get("work") or {}
    section("Work record on KaamSathi", "कामसाथीमा कामको अभिलेख")
    rate = work.get("attendance_rate")
    grid(
        [
            [
                p(bi("Employers", "रोजगारदाता"), label),
                p(bi("Months worked", "काम गरेको महिना"), label),
                p(bi("Jobs completed", "पूरा गरेको काम"), label),
                p(bi("Attendance (180 days)", "हाजिरी (१८० दिन)"), label),
            ],
            [
                p(str(work.get("verified_employers", 0))),
                p(str(work.get("total_months", 0))),
                p(str(work.get("completed_jobs", 0))),
                p(f"{round(rate * 100)}%" if rate is not None else "—"),
            ],
        ],
        [width / 4] * 4,
    )

    avail = payload.get("availability") or {}
    lines = [
        bi("Available for work", "कामका लागि उपलब्ध")
        if avail.get("is_available")
        else bi("Not available right now", "अहिले उपलब्ध छैन")
    ]
    if avail.get("expected_monthly_wage"):
        lines.append(
            f"{bi('Expected monthly wage', 'अपेक्षित मासिक तलब')}: {format_npr(avail['expected_monthly_wage'])}"
        )
    if payload.get("contact"):
        lines.append(f"{bi('Phone', 'फोन')}: +977 {escape(payload['contact']['phone'])}")
    section("Availability & contact", "उपलब्धता र सम्पर्क")
    story += [p("<br/>".join(lines)), Spacer(1, 6 * mm)]

    generated = timezone.localdate()
    gen_text = f"Generated {format_bs_en(generated)} B.S. ({generated.isoformat()})"
    if deva:
        gen_text += f" · <font name='{deva}'>{escape(format_bs_ne(generated))}</font>"
    story += [
        Table([[""]], colWidths=[width], style=[("LINEABOVE", (0, 0), (-1, -1), 0.5, BORDER)]),
        p(
            "Only information verified by KaamSathi or recorded by employers on the platform is shown. "
            f"Check the live record at <font color='#2647C4'>{escape(payload['verify_url'])}</font>. "
            "The worker controls who can see this passport.",
            small,
        ),
        p(gen_text, small),
    ]
    doc.build(story)
    return buf.getvalue()
