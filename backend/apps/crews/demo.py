"""Demo data for naike crews (called from seed_demo). Idempotent."""

from __future__ import annotations

CREWS = [
    # (lead, crew name, extra members to link — seed_demo already links Shyam's Hetauda crew)
    ("Shyam Lal Chaudhary", "Shyam's Hetauda masonry crew", []),
    ("Lok Bahadur Thapa", "Lok's Chitwan mason team", ["Dhan Bahadur Budha", "Manoj Oli"]),
]


def seed(stdout, rng) -> None:
    from apps.crews.models import Crew, Referral
    from apps.crews.services import create_referral_for_application, update_eligibility
    from apps.hiring.models import Application
    from apps.workers.models import Worker

    made = 0
    for lead_name, crew_name, extra in CREWS:
        lead = Worker.objects.filter(full_name=lead_name).first()
        if lead is None:
            stdout.write(f"crews demo: {lead_name} missing — run seed_demo first.")
            continue
        crew, created = Crew.objects.get_or_create(lead=lead, defaults={"name": crew_name})
        made += int(created)
        Worker.objects.filter(full_name__in=extra, naike__isnull=True).exclude(pk=lead.pk).update(naike=lead)

    # Referrals for crew members already placed through the pipeline (e.g. Bir Bahadur Lama).
    referrals = 0
    joined = Application.objects.filter(
        stage="joined", worker__naike__led_crew__is_active=True
    ).select_related("worker")
    for app in joined:
        if not Referral.objects.filter(application=app).exists() and create_referral_for_application(app):
            referrals += 1
    counts = update_eligibility()
    stdout.write(
        f"crews demo: {made} crews created, {referrals} referrals added "
        f"({counts['eligible']} now eligible, {counts['void']} void)."
    )
