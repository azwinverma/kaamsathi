"""Demo data for trust operations: employer verification (KYB) and risk flags. Idempotent.

* Both demo employers are verified; "Everest Guard Services" waits in the KYB queue (pending).
* A duplicate-identity pair (a second registration of Hari Prasad Adhikari with the same citizenship
  number), detected by the real on-save detector; the duplicate also reuses the original's bank
  account, found by the real nightly detector.
* A confirmed manual flag and a dismissed location anomaly for the resolved tabs.
"""

from __future__ import annotations

import datetime as dt

from django.core.files.base import ContentFile
from django.utils import timezone

HOTEL = "Hotel Annapurna View Pvt. Ltd."
BUILDERS = "Shivam Builders & Construction"
PENDING_ORG = "Everest Guard Services Pvt. Ltd."
OPS_PHONE = "9800000003"
PENDING_OWNER_PHONE = "9800000004"
ORIGINAL_WORKER = "Hari Prasad Adhikari"
DUPLICATE_PHONE = "9800000901"

KYB = {
    HOTEL: ("61234/076/077", "301234567"),
    BUILDERS: ("70412/078/079", "609876543"),
    PENDING_ORG: ("88120/081/082", "612340987"),
}


def _pdf(title: str) -> ContentFile:
    """A tiny valid one-page PDF standing in for a scanned registration certificate."""
    text = title.replace("(", "").replace(")", "")
    stream = f"BT /F1 14 Tf 72 720 Td ({text}) Tj ET"
    body = (
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R"
        "/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
        f"4 0 obj<</Length {len(stream)}>>stream\n{stream}\nendstream endobj\n"
        "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
        "trailer<</Root 1 0 R>>\n%%EOF\n"
    )
    return ContentFile(body.encode())


def _kyb(stdout, ops) -> None:
    from apps.accounts.models import User
    from apps.geo.models import District
    from apps.orgs.models import Membership, Organization

    owner, created = User.objects.get_or_create(
        phone=PENDING_OWNER_PHONE, defaults={"full_name": "Bikash Karki"}
    )
    if created:
        owner.set_unusable_password()
        owner.save()
    district = District.objects.filter(code="lalitpur").first() or District.objects.first()
    pending, _ = Organization.objects.get_or_create(
        name=PENDING_ORG,
        defaults={
            "industry": "security",
            "district": district,
            "municipality": "Lalitpur Metropolitan City",
            "ward": 3,
            "address": "Jawalakhel",
            "phone": "015530011",
            "email": "info@everestguard.com.np",
        },
    )
    Membership.objects.get_or_create(user=owner, organization=pending, defaults={"role": "owner"})

    now = timezone.now()
    for org in Organization.objects.filter(name__in=list(KYB)):
        reg_no, pan = KYB[org.name]
        changed = False
        if not org.registration_no:
            org.registration_no = reg_no
            changed = True
        if not org.pan_no:
            org.pan_no = pan
            changed = True
        slug = org.name.split()[0].lower()
        if not org.registration_doc:
            org.registration_doc.save(
                f"{slug}-registration.pdf", _pdf(f"Company registration {reg_no}"), save=False
            )
            changed = True
        if not org.pan_doc:
            org.pan_doc.save(f"{slug}-pan.pdf", _pdf(f"PAN certificate {pan}"), save=False)
            changed = True
        target = "pending" if org.name == PENDING_ORG else "verified"
        if org.verification_status != target:
            org.verification_status = target
            if target == "verified":
                org.verified_by = ops
                org.verified_at = now - dt.timedelta(days=40)
                org.verification_note = "Registration and PAN checked against OCR and IRD records."
            changed = True
        if changed:
            org.save()
    stdout.write(f"  risk: KYB — 2 verified employers, '{PENDING_ORG}' pending review")


def _flags(stdout, ops) -> None:
    from apps.workers.models import Worker
    from apps.workforce.models import Employment

    from .detectors import shared_bank_accounts
    from .models import FraudFlag

    original = Worker.objects.filter(full_name=ORIGINAL_WORKER).exclude(phone=DUPLICATE_PHONE).first()
    if original is None:
        stdout.write("  risk: demo workers missing — run seed_demo first.")
        return
    if not original.citizenship_no:
        original.citizenship_no = "27-01-74-05512"
        original.save(update_fields=["citizenship_no"])
    if not original.bank_account_no:
        original.payment_method = "bank"
        original.bank_name = "Nabil Bank"
        original.bank_account_no = "01020304050607"
        original.bank_account_name = original.full_name
        original.save(update_fields=["payment_method", "bank_name", "bank_account_no", "bank_account_name"])
    duplicate = Worker.objects.filter(phone=DUPLICATE_PHONE).first()
    if duplicate is None:
        # post_save → apps.risk.signals → duplicate_identity flags both records
        duplicate = Worker.objects.create(
            full_name="Hari Prasad Adhikary",
            phone=DUPLICATE_PHONE,
            gender="male",
            citizenship_no=original.citizenship_no,
            current_district=original.current_district,
            permanent_district=original.permanent_district,
            verification_status="pending",
            payment_method="bank",
            bank_name=original.bank_name,
            bank_account_no=original.bank_account_no,
            bank_account_name=original.bank_account_name,
            notes="Registered at a field camp in Syangja.",
        )
    shared_bank_accounts()

    resolved = [
        # (subject, kind, severity, details, status, note)
        (
            Employment.objects.filter(organization__name=BUILDERS, status="active")
            .order_by("start_date")
            .first(),
            "geo_anomaly",
            "medium",
            {
                "reasons": ["outside_geofence"],
                "events": [
                    {"date": "2026-08-12", "distance_m": 640},
                    {"date": "2026-08-13", "distance_m": 615},
                ],
            },
            "dismissed",
            "Site moved to the Hetauda bypass for two weeks; supervisor confirmed.",
        ),
        (
            Employment.objects.filter(organization__name=HOTEL, status="active")
            .order_by("-start_date")
            .first(),
            "manual",
            "medium",
            {"note": "Supervisor reported a colleague checking in on this worker's behalf."},
            "confirmed",
            "Called worker and supervisor; proxy check-in confirmed on 2 days. Employer corrected hajiri.",
        ),
    ]
    for subject, kind, severity, details, status, note in resolved:
        if subject is None:
            continue
        exists = FraudFlag.objects.filter(
            subject_type="employment", subject_id=str(subject.pk), kind=kind, status=status
        ).exists()
        if not exists:
            created = timezone.now() - dt.timedelta(days=12)
            f = FraudFlag.objects.create(
                subject_type="employment",
                subject_id=str(subject.pk),
                kind=kind,
                severity=severity,
                details=details,
                status=status,
                note=note,
                created_by=ops if kind == "manual" else None,
                resolved_by=ops,
                resolved_at=created + dt.timedelta(days=2),
            )
            FraudFlag.objects.filter(pk=f.pk).update(created_at=created)
    stdout.write(f"  risk: {FraudFlag.objects.filter(status='open').count()} open flags")


def seed(stdout, rng) -> None:
    from apps.accounts.models import User

    ops = User.objects.filter(phone=OPS_PHONE).first()
    _kyb(stdout, ops)
    _flags(stdout, ops)
