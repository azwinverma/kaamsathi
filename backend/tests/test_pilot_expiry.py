"""The free pilot ends after 90 days: reminder 14 days before, then the org moves to standard."""

import datetime as dt
from unittest import mock

import pytest
from django.conf import settings as dj_settings

from apps.audit.models import AuditLog
from apps.billing import services
from apps.billing.tasks import pilot_expiry
from apps.core.bs import today_ad
from apps.notifications.models import Notification, SMSMessage
from apps.orgs.models import Organization
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def pilot_org(ends_in_days: int):
    org = f.OrganizationFactory(plan="pilot")
    org.pilot_ends_on = today_ad() + dt.timedelta(days=ends_in_days)
    org.save(update_fields=["pilot_ends_on"])
    return org


@pytest.fixture
def people():
    def _make(org):
        owner = f.MembershipFactory(organization=org, role="owner").user
        admin = f.MembershipFactory(organization=org, role="admin").user
        hr = f.MembershipFactory(organization=org, role="hr").user
        return owner, admin, hr

    return _make


@pytest.fixture
def finance():
    from apps.accounts.models import StaffProfile

    u = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=u, roles=["finance_ops"])
    verifier = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=verifier, roles=["verifier"])
    return u, verifier


def test_pilot_dates_set_when_org_gets_the_pilot_plan():
    org = f.OrganizationFactory(plan="pilot")
    assert org.pilot_started_on == today_ad()
    assert org.pilot_ends_on == today_ad() + dt.timedelta(days=90)
    paid = f.OrganizationFactory()  # factory default: standard
    assert paid.pilot_started_on is None and paid.pilot_ends_on is None
    paid.plan = "pilot"
    paid.save(update_fields=["plan"])  # update_fields still persists the new dates
    paid.refresh_from_db()
    assert paid.pilot_ends_on == today_ad() + dt.timedelta(days=90)


def test_reminder_14_days_before_goes_to_admins_and_finance_ops(
    people, finance, django_capture_on_commit_callbacks
):
    org = pilot_org(14)
    owner, admin, hr = people(org)
    fin, verifier = finance
    with django_capture_on_commit_callbacks(execute=True):
        assert pilot_expiry() == {"reminded": 1, "ended": 0}
    for user in (owner, admin):
        n = Notification.objects.get(user=user, kind="pilot_ending")
        assert "14" in n.body and n.link == "/app/billing"
        assert n.title_ne == "तपाईंको निःशुल्क पाइलट छिट्टै सकिँदैछ"
        assert SMSMessage.objects.filter(phone=user.phone).exists()
    assert not Notification.objects.filter(user=hr).exists()  # billing is owner/admin only
    ops = Notification.objects.get(user=fin, kind="pilot_ending_ops")
    assert org.name in ops.body and ops.data["organization_id"] == str(org.pk)
    assert not Notification.objects.filter(user=verifier).exists()
    org.refresh_from_db()
    assert org.pilot_reminder_sent_on == today_ad()
    assert pilot_expiry() == {"reminded": 0, "ended": 0}  # once only
    assert Notification.objects.filter(user=owner, kind="pilot_ending").count() == 1


def test_nothing_happens_more_than_14_days_out(people):
    org = pilot_org(15)
    owner, *_ = people(org)
    assert pilot_expiry() == {"reminded": 0, "ended": 0}
    assert not Notification.objects.filter(user=owner).exists()


def test_day_90_moves_org_to_standard_audited_and_notified(people, finance):
    org = pilot_org(0)
    owner, admin, _ = people(org)
    fin, _ = finance
    assert pilot_expiry() == {"reminded": 0, "ended": 1}
    org.refresh_from_db()
    assert org.plan == "standard" and not services.on_pilot(org)
    entry = AuditLog.objects.get(action="billing.pilot.end", organization=org)
    assert entry.actor is None and entry.changes["plan"] == {"from": "pilot", "to": "standard"}
    assert Notification.objects.filter(user=owner, kind="pilot_ended").exists()
    assert Notification.objects.filter(user=admin, kind="pilot_ended").exists()
    assert Notification.objects.filter(user=fin, kind="pilot_ended_ops").exists()
    f.EmploymentFactory(organization=org)
    charge, _ = services.create_subscription_charge(org, 2083, 5)
    assert charge.status == "unpaid"  # no longer waived
    assert pilot_expiry() == {"reminded": 0, "ended": 0}


def test_missed_runs_still_end_an_overdue_pilot():
    org = pilot_org(-3)
    pilot_expiry()
    org.refresh_from_db()
    assert org.plan == "standard"


def test_inactive_orgs_are_skipped():
    org = pilot_org(0)
    Organization.objects.filter(pk=org.pk).update(is_active=False)
    assert pilot_expiry() == {"reminded": 0, "ended": 0}


def test_ops_can_extend_a_pilot(people):
    org = pilot_org(5)
    org.pilot_reminder_sent_on = today_ad()
    org.save(update_fields=["pilot_reminder_sent_on"])
    staff = auth_client(f.UserFactory(is_staff=True))
    url = f"/api/v1/ops/billing/subscriptions/{org.id}/extend-pilot"
    res = staff.post(url, {"days": 30, "note": "Payroll go-live slipped"}, format="json")
    assert res.status_code == 200, res.content
    body = res.json()
    assert body["pilot"]["ends_on"] == (today_ad() + dt.timedelta(days=35)).isoformat()
    assert body["pilot"]["days_left"] == 35
    org.refresh_from_db()
    assert org.pilot_ends_on == today_ad() + dt.timedelta(days=35) and org.pilot_reminder_sent_on is None
    entry = AuditLog.objects.get(action="billing.pilot.extend", organization=org)
    assert entry.changes["note"] == "Payroll go-live slipped" and entry.changes["days"] == 30
    # a new reminder is due 14 days before the new end
    assert pilot_expiry() == {"reminded": 0, "ended": 0}


def test_extend_pilot_validation(org):
    staff = auth_client(f.UserFactory(is_staff=True))
    url = f"/api/v1/ops/billing/subscriptions/{org.id}/extend-pilot"
    res = staff.post(url, {"days": 30, "note": "x"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"  # not on pilot
    org.plan = "pilot"
    org.save()
    assert staff.post(url, {"days": 0, "note": "x"}, format="json").status_code == 400
    assert staff.post(url, {"days": 400, "note": "x"}, format="json").status_code == 400
    assert staff.post(url, {"days": 10}, format="json").status_code == 400  # note required
    employer = auth_client(f.MembershipFactory(organization=org, role="owner").user, org)
    assert employer.post(url, {"days": 10, "note": "x"}, format="json").status_code == 403


def test_billing_summary_and_subscription_show_days_left(org, owner_client):
    org.plan = "pilot"
    org.save()
    org.pilot_ends_on = today_ad() + dt.timedelta(days=40)
    org.save(update_fields=["pilot_ends_on"])
    body = owner_client.get("/api/v1/org/billing/summary").json()
    assert body["pilot"] is True and body["pilot_days_left"] == 40
    assert body["pilot_ends_on"] == org.pilot_ends_on.isoformat()
    sub = owner_client.get("/api/v1/org/billing/subscription").json()
    assert sub["pilot"]["days_left"] == 40 and sub["pilot"]["started_on"] == today_ad().isoformat()


def test_billing_summary_without_pilot(owner_client):
    body = owner_client.get("/api/v1/org/billing/summary").json()
    assert body["pilot"] is False and body["pilot_days_left"] is None


def test_pilot_expiry_is_scheduled_daily():
    schedule = dj_settings.CELERY_BEAT_SCHEDULE.values()
    entries = [e for e in schedule if e["task"] == "apps.billing.tasks.pilot_expiry"]
    assert len(entries) == 1


def test_sms_failure_does_not_stop_the_run(people):
    org = pilot_org(0)
    people(org)
    with mock.patch("apps.notifications.services.notify", side_effect=RuntimeError("boom")):
        assert pilot_expiry() == {"reminded": 0, "ended": 1}
