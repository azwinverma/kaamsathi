"""Demo data for compliance (called by ``seed_demo``): contracts, SSF filing, a contractor."""

from __future__ import annotations

import datetime as dt


def seed(stdout, rng) -> None:
    from apps.core.bs import BSMonth, today_ad
    from apps.core.management.commands.seed_demo import BUILDERS, HOTEL
    from apps.orgs.models import Organization
    from apps.payroll.models import PayrollRun
    from apps.workers.models import Trade
    from apps.workforce.models import Employment

    from . import services
    from .models import Contractor, ContractorAssignment, EmploymentContract

    orgs = list(Organization.objects.filter(name__in=[HOTEL, BUILDERS]))
    if not orgs:
        stdout.write("  compliance: demo orgs missing — skipped")
        return
    contracts = accepted = filings = 0
    for org in orgs:
        owner = org.memberships.filter(role="owner").select_related("user").first()
        user = owner.user if owner else None
        emps = (
            Employment.objects.filter(organization=org, status="active")
            .select_related("organization__district", "worker", "site", "trade", "shift")
            .order_by("worker__full_name")
        )
        # Deterministic (idempotent): every 7th worker still has no contract, ~60% accepted.
        for i, emp in enumerate(emps):
            if i % 7 == 3 or EmploymentContract.objects.filter(employment=emp).exists():
                continue
            contract, _ = services.generate_contract(emp, user)
            contracts += 1
            if i % 5 in (0, 1, 3):
                services.accept_contract(contract, "paper" if i % 3 == 0 else "app")
                accepted += 1

        prev = BSMonth.of(today_ad()).previous()
        run = PayrollRun.objects.filter(
            organization=org, bs_year=prev.year, bs_month=prev.month, status__in=["approved", "paid"]
        ).first()
        if run and not hasattr(run, "ssf_filing"):
            filing, _ = services.prepare_ssf_filing(run, user)
            services.update_filing(
                filing,
                {
                    "status": "submitted",
                    "submitted_on": min(today_ad(), run.period_end + dt.timedelta(days=5)),
                    "note": "Uploaded on the SSF employer portal.",
                },
            )
            filings += 1

    builders = next((o for o in orgs if o.name == BUILDERS), None)
    if builders:
        lead = Employment.objects.filter(
            organization=builders, worker__full_name="Shyam Lal Chaudhary"
        ).first()
        contractor, created = Contractor.objects.get_or_create(
            organization=builders,
            name="Chaudhary Labour Supply",
            defaults={
                "phone": "9845012345",
                "pan_no": "612345780",
                "lead_worker": lead.worker if lead else None,
            },
        )
        if created:
            contractor.trades.set(Trade.objects.filter(code__in=["mason", "helper", "rebar_worker"]))
        crew = Employment.objects.filter(
            organization=builders,
            status="active",
            wage_type="daily",
            site__name__startswith="Hetauda Commercial",
        )
        for emp in crew:
            ContractorAssignment.objects.get_or_create(
                employment=emp, defaults={"contractor": contractor, "assigned_on": emp.start_date}
            )
    stdout.write(
        f"  compliance: {contracts} contracts ({accepted} accepted), {filings} SSF filings, contractor ready"
    )
