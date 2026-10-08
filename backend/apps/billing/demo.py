"""Demo billing: hotel on the Growth plan, issued invoices for the current BS month (one paid)."""

from __future__ import annotations


def seed(stdout, rng):
    import datetime as dt

    from apps.core.management.commands.seed_demo import BUILDERS, HOTEL
    from apps.orgs.models import Organization

    from . import services
    from .models import Invoice, Plan

    orgs = {o.name: o for o in Organization.objects.filter(name__in=[HOTEL, BUILDERS])}
    if not orgs:
        return
    hotel = orgs.get(HOTEL)
    growth = Plan.objects.filter(code="growth").first()
    if hotel is not None and growth is not None and services.subscription_for(hotel) is None:
        services.set_plan(hotel, growth)

    from apps.core.bs import BSMonth, today_ad

    current = BSMonth.of(today_ad())  # seed_demo marks last month paid; bill this month's charges
    year, month = current.year, current.month
    for org in orgs.values():
        services.create_subscription_charge(org, year, month)
    if Invoice.objects.filter(
        organization__in=orgs.values(), period_bs_year=year, period_bs_month=month
    ).exists():
        stdout.write("  Billing: demo invoices already present")
        return
    issued = []
    for inv in services.generate_invoices(year, month):
        if inv.organization_id in {o.id for o in orgs.values()}:
            issued.append(services.issue_invoice(inv))
    if issued:
        first = issued[0]
        services.record_payment(
            first,
            amount=services.balance_due(first),
            method="bank",
            paid_on=dt.date.today(),
            reference="DEMO-TT-001",
        )
    stdout.write(f"  Billing: {len(issued)} demo invoice(s) issued for BS {year}-{month:02d}")
