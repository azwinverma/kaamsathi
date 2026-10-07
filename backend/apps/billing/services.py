from decimal import Decimal

from django.conf import settings
from django.db.models import Q, Sum

from apps.core.money import q2
from apps.workforce.models import Employment

from .models import Charge


def active_worker_count(org) -> int:
    return Employment.objects.filter(organization=org, status="active").count()


def workers_active_in(org, month) -> int:
    """Employments that overlapped the BS month at any point (billing for a past month)."""
    return (
        Employment.objects.filter(organization=org, start_date__lte=month.end)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=month.start))
        .count()
    )


def subscription_amount(workers: int) -> Decimal:
    per = Decimal(settings.SUBSCRIPTION_PER_WORKER)
    minimum = Decimal(settings.SUBSCRIPTION_MINIMUM)
    return q2(max(workers * per, minimum))


def monthly_estimate(org) -> Decimal:
    return subscription_amount(active_worker_count(org))


def unpaid_total(org) -> Decimal:
    return q2(Charge.objects.filter(organization=org, status="unpaid").aggregate(t=Sum("amount"))["t"] or 0)


def create_subscription_charge(org, bs_year: int, bs_month: int):
    from apps.core.bs import MONTHS_EN, BSMonth

    existing = Charge.objects.filter(
        organization=org, kind="subscription", bs_year=bs_year, bs_month=bs_month
    ).first()
    if existing:
        return existing, False
    workers = workers_active_in(org, BSMonth(bs_year, bs_month))
    charge = Charge.objects.create(
        organization=org,
        kind="subscription",
        amount=subscription_amount(workers),
        description=f"Subscription {MONTHS_EN[bs_month]} {bs_year} ({workers} active workers)",
        bs_year=bs_year,
        bs_month=bs_month,
    )
    return charge, True
