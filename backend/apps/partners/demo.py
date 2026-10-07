"""Demo partners (clearly fictional sandbox names — never real banks or insurers).

Called by ``seed_demo`` as ``seed(stdout, rng)``; idempotent.
"""

from __future__ import annotations

DEMO_PARTNERS = [
    {
        "name": "Demo Bank Ltd. (sandbox)",
        "kind": "bank",
        "regulator": "nrb",
        "license_no": "SANDBOX-NRB-001",
        "contact_email": "partners@demo-bank.example",
        "contact_phone": "014000001",
    },
    {
        "name": "Demo Insurance (sandbox)",
        "kind": "insurer",
        "regulator": "beema_samiti",
        "license_no": "SANDBOX-NIA-002",
        "contact_email": "partners@demo-insurance.example",
        "contact_phone": "014000002",
    },
    {
        "name": "Demo Training Institute",
        "kind": "training",
        "regulator": "ctevt",
        "license_no": "SANDBOX-CTEVT-003",
        "contact_email": "info@demo-training.example",
        "contact_phone": "014000003",
    },
    {
        "name": "Demo Recruitment Agency (sandbox)",
        "kind": "recruitment_agency",
        "regulator": "dofe",
        "license_no": "SANDBOX-DOFE-004",
        "contact_email": "desk@demo-recruitment.example",
        "contact_phone": "014000004",
    },
]


def ensure_partners() -> dict:
    from .models import Partner
    from .services import ensure_webhook_secret

    out = {}
    for spec in DEMO_PARTNERS:
        partner, _ = Partner.objects.update_or_create(name=spec["name"], defaults={**spec, "is_active": True})
        ensure_webhook_secret(partner)
        out[spec["kind"]] = partner
    return out


def seed(stdout, rng) -> None:
    from .models import PartnerAPIKey
    from .services import create_api_key

    partners = ensure_partners()
    bank = partners["bank"]
    if not PartnerAPIKey.objects.filter(partner=bank, revoked_at__isnull=True).exists():
        _key, full = create_api_key(
            bank, ["profile.read", "earnings.read", "referrals.write"], name="Sandbox key (demo)"
        )
        stdout.write(f"  Partner sandbox key for {bank.name} (shown once): {full}")
    stdout.write(f"  Partners: {len(partners)} fictional sandbox partners")
