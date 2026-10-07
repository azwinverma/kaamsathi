"""Demo offers, financial profiles and one consented referral for Ram Bahadur Thapa.

Called by ``seed_demo`` as ``seed(stdout, rng)``; idempotent. Partner names are fictional.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.utils import timezone

DEMO_OFFERS = [
    {
        "partner": "bank",
        "kind": "tool_finance",
        "title": "Tool finance for skilled workers",
        "title_ne": "सीपयुक्त कामदारका लागि औजार कर्जा",
        "description": (
            "Buy the tools of your trade and repay in monthly instalments. Decision and terms by the bank."
        ),
        "description_ne": "आफ्नो पेशाका औजार किन्नुहोस् र मासिक किस्तामा तिर्नुहोस्। निर्णय र सर्त बैंकको।",
        "min_verified_months": 1,
        "min_avg_net": Decimal("15000.00"),
        "max_amount": Decimal("50000.00"),
        "interest_note": "Sandbox: interest and fees as published by the partner bank.",
    },
    {
        "partner": "bank",
        "kind": "ewa",
        "title": "Earned wage access",
        "title_ne": "कमाएको तलब अग्रिम",
        "description": "Draw part of the salary you have already earned this month, paid by the partner.",
        "description_ne": "यो महिना कमाइसकेको तलबको केही भाग साझेदारबाट अग्रिम लिनुहोस्।",
        "min_verified_months": 1,
        "min_avg_net": None,
        "max_amount": Decimal("10000.00"),
        "interest_note": "Sandbox: any partner charges are shown by the partner before you accept.",
    },
    {
        "partner": "insurer",
        "kind": "insurance",
        "title": "Accident insurance",
        "title_ne": "दुर्घटना बीमा",
        "description": "Cover for workplace and personal accidents, premium set by the insurer.",
        "description_ne": "कार्यस्थल तथा व्यक्तिगत दुर्घटनाको बीमा, प्रिमियम बीमा कम्पनीले तोक्छ।",
        "min_verified_months": 1,
        "min_avg_net": None,
        "max_amount": None,
        "interest_note": "Sandbox: premium as quoted by the insurer.",
    },
    {
        "partner": "bank",
        "kind": "vehicle_finance",
        "title": "Two-wheeler finance",
        "title_ne": "दुई पाङ्ग्रे सवारी कर्जा",
        "description": "Finance for a motorbike or scooter to get to work.",
        "description_ne": "कामसम्म पुग्न मोटरसाइकल वा स्कुटरका लागि कर्जा।",
        "min_verified_months": 6,
        "min_avg_net": Decimal("20000.00"),
        "max_amount": Decimal("250000.00"),
        "interest_note": "Sandbox: rate as published by the partner bank.",
    },
]


def seed(stdout, rng) -> None:
    from apps.partners.demo import ensure_partners
    from apps.partners.models import ConsentGrant, PartnerAccessLog, PartnerAPIKey
    from apps.workers.models import Consent, Worker

    from .models import Offer, Referral
    from .services import OFFER_PURPOSE, REFERRAL_SCOPES, build_profile, refresh_all

    partners = ensure_partners()
    offers = {}
    for spec in DEMO_OFFERS:
        spec = dict(spec)
        partner = partners[spec.pop("partner")]
        offer, _ = Offer.objects.update_or_create(
            partner=partner, title=spec["title"], defaults={**spec, "is_active": True}
        )
        offers[offer.kind] = offer
    n_profiles = refresh_all()

    ram = (
        Worker.objects.filter(user__phone="9800000010").first()
        or Worker.objects.filter(full_name="Ram Bahadur Thapa").first()
    )
    if ram is None:
        stdout.write(f"  Finance: {len(offers)} offers, {n_profiles} profiles (demo worker not found)")
        return
    build_profile(ram)
    offer = offers["tool_finance"]
    bank = offer.partner
    if not Referral.objects.filter(worker=ram, offer=offer).exists():
        now = timezone.now()
        grant = ConsentGrant.objects.create(
            worker=ram,
            partner=bank,
            purpose=OFFER_PURPOSE[offer.kind],
            scopes=REFERRAL_SCOPES,
            granted_at=now - dt.timedelta(days=2),
            expires_at=now + dt.timedelta(days=28),
            channel="app",
            status="active",
        )
        Consent.objects.create(
            worker=ram, organization=None, scope="history_share", granted=True, channel="app"
        )
        Referral.objects.create(
            worker=ram,
            offer=offer,
            partner=bank,
            grant=grant,
            amount_requested=Decimal("35000.00"),
            purpose_note="Professional knife set and induction cooker",
            status="under_review",
            partner_ref="DEMO-TF-0001",
            history=[
                {"status": "submitted", "at": (now - dt.timedelta(days=2)).isoformat(), "note": ""},
                {
                    "status": "under_review",
                    "at": (now - dt.timedelta(days=1)).isoformat(),
                    "note": "Sandbox partner",
                },
            ],
        )
        key = PartnerAPIKey.objects.filter(partner=bank, revoked_at__isnull=True).first()
        for path, scope in (
            (f"/api/v1/partner/workers/{ram.id}/earnings", "earnings.read"),
            (f"/api/v1/partner/workers/{ram.id}/profile", "profile.read"),
        ):
            PartnerAccessLog.objects.create(
                partner=bank,
                api_key=key,
                worker=ram,
                endpoint=path,
                method="GET",
                scope=scope,
                status_code=200,
            )
    stdout.write(
        f"  Finance: {len(offers)} offers, {n_profiles} financial profiles, referral for {ram.full_name}"
    )
