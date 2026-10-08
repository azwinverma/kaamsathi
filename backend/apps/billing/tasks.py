from celery import shared_task


@shared_task
def monthly_subscription_charges(force: bool = False):
    """Runs daily via beat; creates subscription charges on BS day 1 (idempotent)."""
    from apps.core.bs import ad_to_bs, today_ad
    from apps.orgs.models import Organization

    from .services import create_subscription_charge

    today = ad_to_bs(today_ad())
    if today.day != 1 and not force:
        return 0
    created = 0
    for org in Organization.objects.filter(is_active=True):
        _, was_created = create_subscription_charge(org, today.year, today.month)
        created += int(was_created)
    return created


@shared_task
def generate_monthly_invoices(bs_year: int | None = None, bs_month: int | None = None):
    """Draft invoices for the previous BS month (or the given one). Ops reviews and issues them."""
    from .services import generate_invoices, previous_bs_month

    if bs_year is None or bs_month is None:
        bs_year, bs_month = previous_bs_month()
    return len(generate_invoices(bs_year, bs_month))
