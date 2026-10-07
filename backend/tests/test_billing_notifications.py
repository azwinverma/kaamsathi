import datetime as dt
from decimal import Decimal
from unittest import mock

import pytest
from django.utils import timezone

from apps.billing.services import create_subscription_charge
from apps.notifications import services as notifications
from apps.notifications.models import SMSMessage
from apps.notifications.tasks import notify_employer_shortlist

from .factories import EmploymentFactory, JobFactory

pytestmark = pytest.mark.django_db

# BS 2083-05 (Bhadra) = 2026-08-17 .. 2026-09-16


def test_past_month_subscription_counts_workers_active_in_that_month(org):
    for _ in range(25):  # active through Bhadra
        EmploymentFactory(organization=org)
    for _ in range(5):  # left during Bhadra: still billed for it
        EmploymentFactory(organization=org, status="ended", end_date=dt.date(2026, 9, 1))
    for _ in range(4):  # left before Bhadra
        EmploymentFactory(organization=org, status="ended", end_date=dt.date(2026, 8, 1))
    for _ in range(3):  # joined after Bhadra
        EmploymentFactory(organization=org, start_date=dt.date(2026, 9, 20))

    charge, created = create_subscription_charge(org, 2083, 5)

    assert created
    assert charge.amount == Decimal("4500.00")  # 30 × 150
    assert "30 active workers" in charge.description


def test_subscription_minimum_applies(org):
    EmploymentFactory(organization=org)
    charge, _ = create_subscription_charge(org, 2083, 5)
    assert charge.amount == Decimal("3000.00")


def test_shortlist_sms_does_not_claim_verified(owner):
    job = JobFactory(organization=owner.memberships.first().organization)
    notify_employer_shortlist(str(job.id), 3)
    body = SMSMessage.objects.filter(kind="shortlist").latest("id").body
    assert "3 new candidate(s)" in body
    assert "verified" not in body


def test_future_eta_is_not_sent_immediately_in_eager_mode(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    task = mock.Mock(name="task")
    with mock.patch.object(notifications.transaction, "on_commit") as on_commit:
        notifications.enqueue(task, "x", eta=timezone.now() + dt.timedelta(days=2))
        notifications.enqueue(task, "x")
    assert on_commit.call_count == 1
