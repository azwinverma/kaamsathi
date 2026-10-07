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
