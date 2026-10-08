"""Demo integrations (called from seed_demo as ``seed(stdout, rng)``). Idempotent.

One inactive webhook endpoint for the hotel pointing at a non-resolvable host, so nothing is sent.
No API key is created: a key is only ever shown once, so the owner creates it in the UI.
"""

from __future__ import annotations

HOTEL = "Hotel Annapurna View Pvt. Ltd."
DEMO_URL = "https://example.invalid/hook"


def seed(stdout, rng) -> None:
    from apps.orgs.models import Organization

    from .models import EVENT_CODES, WebhookEndpoint

    org = Organization.objects.filter(name=HOTEL).first()
    if org is None:
        stdout.write("  integrations: hotel not found, skipped")
        return
    _, created = WebhookEndpoint.objects.update_or_create(
        organization=org,
        url=DEMO_URL,
        defaults={
            "description": "Demo ERP hook (inactive — example.invalid never resolves)",
            "events": [e for e in EVENT_CODES if e.startswith(("payroll.", "timesheet.", "employment."))],
            "is_active": False,
        },
    )
    stdout.write(f"  integrations: demo webhook {'created' if created else 'kept'} (inactive)")
