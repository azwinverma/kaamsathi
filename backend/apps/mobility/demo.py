"""Demo foreign-employment documents (``seed(stdout, rng)``; idempotent).

Uses the fictional "Demo Recruitment Agency (sandbox)" partner: marks it compliance-verified with a
licence valid for one year, gives a few demo workers passports / medical / police documents in mixed
statuses (one passport expiring soon) and one active share. All numbers are obviously fake.
"""

from __future__ import annotations

import datetime as dt

from django.core.files.base import ContentFile
from django.utils import timezone

AGENCY_NAME = "Demo Recruitment Agency (sandbox)"
RAM_PHONE = "9800000010"

# A tiny valid PDF so the ops viewer has something to open.
DEMO_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 120]/Contents 4 0 R"
    b"/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
    b"4 0 obj<</Length 58>>stream\nBT /F1 14 Tf 20 60 Td (KaamSathi DEMO document - not real) Tj ET\n"
    b"endstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)


def _agency():
    from apps.partners.models import Partner

    agency = Partner.objects.filter(name=AGENCY_NAME).first()
    if agency is None:
        from apps.partners.services import ensure_webhook_secret

        agency = Partner.objects.create(
            name=AGENCY_NAME,
            kind="recruitment_agency",
            regulator="dofe",
            license_no="SANDBOX-DOFE-004",
            contact_email="desk@demo-recruitment.example",
            contact_phone="014000004",
            is_active=True,
        )
        ensure_webhook_secret(agency)
    today = timezone.localdate()
    if agency.compliance_status != "verified" or not agency.license_valid_on(today):
        agency.compliance_status = "verified"
        agency.license_valid_until = today + dt.timedelta(days=365)
        agency.compliance_verified_at = timezone.now()
        agency.compliance_note = "Sandbox agency — licence checked (demo data)."
        agency.save()
    return agency


def _file(name):
    return ContentFile(DEMO_PDF, name=name)


def seed(stdout, rng) -> None:
    from apps.accounts.models import User
    from apps.partners.models import ConsentGrant
    from apps.workers.models import Worker

    from .models import ClearanceDocument, TravelDocument
    from .services import SHARE_SCOPES

    agency = _agency()
    today = timezone.localdate()
    ops = User.objects.filter(is_staff=True).order_by("date_joined").first()
    now = timezone.now()

    ram = Worker.objects.filter(phone=RAM_PHONE).first()
    others = list(Worker.objects.exclude(phone=RAM_PHONE).order_by("phone")[:3])
    workers = [w for w in [ram, *others] if w is not None]
    if not workers:
        stdout.write("  Mobility: no demo workers yet — skipped")
        return

    def verified(**extra):
        return {"status": "verified", "verified_by": ops, "verified_at": now, **extra}

    def dates(issued_ago, expires_in):
        return {
            "issued_on": today - dt.timedelta(days=issued_ago),
            "expires_on": today + dt.timedelta(days=expires_in),
        }

    # (worker index, group, kind, field values)
    plan = [
        (0, "travel", "passport", {"number": "DEMO0000101", **dates(3620, 30), **verified()}),
        (
            0,
            "clearance",
            "medical_fitness",
            {
                "title": "Medical fitness report",
                "issuer": "Demo Health Clinic (sandbox)",
                "reference_no": "DEMO-MED-0101",
                **dates(20, 70),
                **verified(),
            },
        ),
        (
            0,
            "clearance",
            "police_clearance",
            {
                "title": "Police clearance report",
                "issuer": "Nepal Police (demo entry)",
                "reference_no": "DEMO-PCR-0101",
                **dates(10, 170),
                "status": "pending",
            },
        ),
        (1, "travel", "passport", {"number": "DEMO0000202", **dates(400, 3250), "status": "pending"}),
        (
            2,
            "travel",
            "passport",
            {
                "number": "DEMO0000303",
                **dates(900, 2700),
                "status": "rejected",
                "note": "Photo page is blurred — please upload a clearer scan.",
            },
        ),
        (
            3,
            "clearance",
            "language_test",
            {
                "title": "Korean EPS-TOPIK (demo)",
                "issuer": "Demo Language Centre (sandbox)",
                "score_or_level": "152/200",
                **dates(60, 670),
                **verified(),
            },
        ),
    ]
    created = 0
    for idx, group, kind, defaults in plan:
        if idx >= len(workers):
            continue
        worker = workers[idx]
        model = TravelDocument if group == "travel" else ClearanceDocument
        if model.objects.filter(worker=worker, kind=kind).exists():
            continue
        doc = model(worker=worker, kind=kind, **defaults)
        doc.document.save(f"demo-{kind}.pdf", _file(f"demo-{kind}.pdf"), save=False)
        doc.save()
        created += 1

    shares = 0
    if ram is not None and not ConsentGrant.objects.active().filter(worker=ram, partner=agency).exists():
        from apps.partners.services import create_grant

        create_grant(ram, agency, purpose="recruitment", scopes=SHARE_SCOPES, days=30, channel="app")
        shares = 1
    stdout.write(
        f"  Mobility: {AGENCY_NAME} verified (licence to {agency.license_valid_until}); "
        f"{created} documents, {shares} new share"
    )
