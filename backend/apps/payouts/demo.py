"""Demo data for payouts (called by ``seed_demo``): a completed bank-file batch for last month."""

from __future__ import annotations


def seed(stdout, rng) -> None:
    from django.utils import timezone

    from apps.core.bs import BSMonth, today_ad
    from apps.core.management.commands.seed_demo import BUILDERS, HOTEL
    from apps.payroll.models import PayrollRun

    from . import services
    from .models import PayoutBatch, PayoutItem

    prev = BSMonth.of(today_ad()).previous()
    made = 0
    for run in PayrollRun.objects.filter(
        organization__name__in=[HOTEL, BUILDERS], bs_year=prev.year, bs_month=prev.month, status="paid"
    ):
        if PayoutBatch.objects.filter(run=run, provider="bank_file").exists():
            continue
        slips = list(
            run.payslips.select_related("worker")
            .filter(payment_method="bank")
            .exclude(worker__bank_account_no=None)
        )
        if not slips:
            continue
        paid_at = run.paid_at or timezone.now()
        owner = run.organization.memberships.filter(role="owner").first()
        batch = PayoutBatch.objects.create(
            run=run,
            provider="bank_file",
            status="completed",
            created_by=owner.user if owner else None,
            submitted_at=paid_at,
            completed_at=paid_at,
        )
        for i, slip in enumerate(slips, start=1):
            w = slip.worker
            PayoutItem.objects.create(
                batch=batch,
                payslip=slip,
                amount=slip.net_pay,
                method="bank",
                account_name=w.bank_account_name or w.full_name,
                account_no=w.bank_account_no,
                bank_name=w.bank_name,
                status="paid",
                provider_ref=f"NB{run.bs_year}{run.bs_month:02d}{i:04d}",
            )
        batch.totals = services.compute_totals(batch, services.eligibility(run, "bank_file")["excluded"])
        batch.save(update_fields=["totals"])
        made += 1
    stdout.write(f"  payouts: {made} completed bank-file batches")
