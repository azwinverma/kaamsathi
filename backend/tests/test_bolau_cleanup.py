"""manage.py cleanup_dev_test_data: dev-only removal of E2E Bolau bookings and test Sipalu."""

from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from apps.accounts.models import User
from apps.billing.models import Charge
from apps.bolau.models import Booking, BookingEvent, SipaluProfile
from apps.bolau.profiles import ensure_profile
from apps.notifications.models import Notification
from apps.workers.models import Worker
from tests import factories as f
from tests.bolau_helpers import book, flag_on, make_ghardhani, make_sipalu, tomorrow_at

pytestmark = pytest.mark.django_db


def run(*args):
    out = StringIO()
    call_command("cleanup_dev_test_data", *args, stdout=out)
    return out.getvalue()


@pytest.fixture
def data():
    flag_on()
    profile, service, sc = make_sipalu()
    _user, addr, gc = make_ghardhani()
    e2e = book(gc, profile, addr, service, description="E2E: fan hums").json()["id"]
    assert sc.post(f"/api/v1/me/bolau/bookings/{e2e}/accept", {}, format="json").status_code == 200
    real = book(gc, profile, addr, service, start=tomorrow_at(14), description="Real job").json()["id"]
    # Onboarding-e2e Sipalu: pending, Bolau off, no bookings → removed.
    gone = ensure_profile(f.UserFactory(phone="9800000950", full_name="E2E Sipalu"))
    # Same range but switched on (public) → kept.
    kept = ensure_profile(f.UserFactory(phone="9800000951", full_name="Kept Sipalu"))
    SipaluProfile.objects.filter(pk=kept.pk).update(bolau_enabled=True)
    return {"e2e": e2e, "real": real, "gone": gone, "kept": kept}


def test_refuses_outside_dev(settings):
    settings.DEBUG = False
    settings.SETTINGS_MODULE = "config.settings.prod"
    with pytest.raises(CommandError, match="Refusing"):
        run("--apply")


def test_dry_run_changes_nothing_then_apply_deletes_only_test_data(settings, data):
    settings.DEBUG = True
    e2e = Booking.objects.get(pk=data["e2e"])
    charge_id = e2e.fee_charge_id
    assert charge_id and BookingEvent.objects.filter(booking=e2e).exists()
    assert Notification.objects.filter(data__booking_id=str(e2e.id)).exists()

    out = run()
    assert f"Would delete booking {e2e.code}" in out
    assert "Would delete test Sipalu 9800000950" in out
    assert "keep Sipalu 9800000951" in out
    assert "Dry run: 1 bookings" in out
    assert Booking.objects.filter(pk=data["e2e"]).exists()
    assert Worker.objects.filter(phone="9800000950").exists()

    out = run("--apply")
    assert "Deleted: 1 bookings" in out and "1 sipalu, 1 users" in out
    assert not Booking.objects.filter(pk=data["e2e"]).exists()
    assert not BookingEvent.objects.filter(booking_id=data["e2e"]).exists()
    assert not Charge.objects.filter(pk=charge_id).exists()
    assert not Notification.objects.filter(data__booking_id=data["e2e"]).exists()
    assert Booking.objects.filter(pk=data["real"]).exists()
    assert not Worker.objects.filter(phone="9800000950").exists()
    assert not SipaluProfile.objects.filter(pk=data["gone"].pk).exists()
    assert not User.objects.filter(phone="9800000950").exists()
    assert SipaluProfile.objects.filter(pk=data["kept"].pk).exists()
    # Idempotent.
    assert "Deleted: 0 bookings" in run("--apply")


def test_sipalu_with_a_booking_is_kept(settings):
    settings.DEBUG = True
    flag_on()
    p = ensure_profile(f.UserFactory(phone="9800000952", full_name="Booked Sipalu"))
    # A booking as Ghardhani by the same user also keeps the account.
    _u, addr, gc = make_ghardhani(phone="9800000952")
    other, service, _sc = make_sipalu(handle="other-sipalu")
    assert book(gc, other, addr, service, description="Real").status_code == 201
    out = run("--apply")
    assert "keep Sipalu 9800000952" in out and "has bookings" in out
    assert SipaluProfile.objects.filter(pk=p.pk).exists()
