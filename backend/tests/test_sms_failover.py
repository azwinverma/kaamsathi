"""SMS gateway failover, circuit breaker and one SMSMessage row per message (RUNBOOK §7).

Eager retries run inline here with task_eager_propagates off, exactly as in SERVERLESS mode.
"""

from unittest import mock

import pytest
from django.core.cache import cache

from apps.notifications import delivery as delivery_mod
from apps.notifications import services as nsvc
from apps.notifications.models import NotificationDelivery, SMSMessage
from apps.notifications.sms import SMSResult
from apps.notifications.tasks import send_sms
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

PHONE = "9841234567"
SPARROW = "apps.notifications.sms.SparrowSMSBackend.send"
AAKASH = "apps.notifications.sms.AakashSMSBackend.send"


@pytest.fixture(autouse=True)
def gateways(settings, monkeypatch):
    monkeypatch.setitem(send_sms.app.conf, "CELERY_TASK_EAGER_PROPAGATES", False)
    settings.SMS_BACKEND = "sparrow"
    settings.SMS_FAILOVER_BACKEND = "aakash"
    settings.SMS_CIRCUIT_THRESHOLD = 3
    settings.SMS_CIRCUIT_SECONDS = 300
    cache.clear()
    yield
    cache.clear()


def test_primary_failure_fails_over_in_the_same_attempt():
    with (
        mock.patch(SPARROW, return_value=SMSResult(False, "503 down")) as primary,
        mock.patch(AAKASH, return_value=SMSResult(True, "200 ok")) as failover,
    ):
        assert send_sms.apply(args=(PHONE, "hello")).get() is True
    assert primary.call_count == 1 and failover.call_count == 1
    msg = SMSMessage.objects.get(phone=PHONE)
    assert (msg.status, msg.backend, msg.failed_over, msg.attempts) == ("sent", "aakash", True, 1)
    assert "sparrow: 503 down" in msg.provider_response and "aakash: 200 ok" in msg.provider_response


def test_primary_timeout_exception_also_fails_over():
    with (
        mock.patch(SPARROW, side_effect=TimeoutError("read timed out")),
        mock.patch(AAKASH, return_value=SMSResult(True, "200 ok")),
    ):
        assert send_sms.apply(args=(PHONE, "hello")).get() is True
    assert SMSMessage.objects.get(phone=PHONE).backend == "aakash"


def test_healthy_primary_does_not_touch_failover():
    with mock.patch(SPARROW, return_value=SMSResult(True, "200")), mock.patch(AAKASH) as failover:
        send_sms.apply(args=(PHONE, "hello"))
    failover.assert_not_called()
    msg = SMSMessage.objects.get(phone=PHONE)
    assert (msg.backend, msg.failed_over, msg.attempts) == ("sparrow", False, 1)


def test_retries_update_one_row_without_failover(settings):
    settings.SMS_FAILOVER_BACKEND = ""
    with mock.patch(SPARROW, return_value=SMSResult(False, "503")) as primary:
        assert send_sms.apply(args=(PHONE, "hello")).get() is False
    assert primary.call_count == 4  # first try + 3 retries (eager: inline)
    msg = SMSMessage.objects.get(phone=PHONE)  # one row, not four
    assert (msg.status, msg.attempts, msg.backend) == ("failed", 4, "sparrow")


def test_both_gateways_down_retries_one_row():
    with (
        mock.patch(SPARROW, return_value=SMSResult(False, "503")),
        mock.patch(AAKASH, return_value=SMSResult(False, "500")),
    ):
        send_sms.apply(args=(PHONE, "hello"))
    msg = SMSMessage.objects.get(phone=PHONE)
    assert msg.status == "failed" and msg.attempts == 4


def test_circuit_opens_after_consecutive_primary_failures():
    with (
        mock.patch(SPARROW, return_value=SMSResult(False, "503")) as primary,
        mock.patch(AAKASH, return_value=SMSResult(True, "200")),
    ):
        for i in range(5):
            send_sms.apply(args=(f"984100000{i}", "hello"))
    assert primary.call_count == 3  # the 4th and 5th messages skip the broken primary
    assert SMSMessage.objects.filter(backend="aakash", failed_over=True).count() == 5


def test_primary_success_resets_the_failure_count():
    results = [SMSResult(False, "503"), SMSResult(False, "503"), SMSResult(True, "200")] * 2
    with (
        mock.patch(SPARROW, side_effect=results) as primary,
        mock.patch(AAKASH, return_value=SMSResult(True)),
    ):
        for i in range(6):
            send_sms.apply(args=(f"984100000{i}", "hello"))
    assert primary.call_count == 6  # never three in a row → circuit stays closed


def test_failover_off_when_same_as_primary_or_unknown(settings):
    from apps.notifications.sms import get_failover_backend

    settings.SMS_FAILOVER_BACKEND = "sparrow"
    assert get_failover_backend() is None
    settings.SMS_FAILOVER_BACKEND = "nope"
    assert get_failover_backend() is None
    settings.SMS_FAILOVER_BACKEND = "aakash"
    assert get_failover_backend().name == "aakash"


def test_otp_request_uses_failover(api, django_capture_on_commit_callbacks):
    with (
        mock.patch(SPARROW, return_value=SMSResult(False, "503")),
        mock.patch(AAKASH, return_value=SMSResult(True, "200")) as failover,
        django_capture_on_commit_callbacks(execute=True),
    ):
        res = api.post("/api/v1/auth/otp/request", {"phone": PHONE}, format="json")
    assert res.status_code == 200
    assert "KaamSathi code" in failover.call_args.args[1]
    msg = SMSMessage.objects.get(phone=PHONE, kind="otp")
    assert msg.backend == "aakash" and "redacted" in msg.body


def test_notification_delivery_uses_failover_and_reuses_row_on_retry():
    u = f.UserFactory()
    n = nsvc.notify(u, "shortlist", "T", "Body", sms=True)
    d = NotificationDelivery.objects.get(notification=n, channel="sms")
    with (
        mock.patch(SPARROW, return_value=SMSResult(False, "503")),
        mock.patch(AAKASH, return_value=SMSResult(False, "500")),
    ):
        delivery_mod.deliver(d)
        d.refresh_from_db()
        assert d.status == "queued"
        delivery_mod.process_due(now=d.next_attempt_at)
    with (
        mock.patch(SPARROW, return_value=SMSResult(False, "503")),
        mock.patch(AAKASH, return_value=SMSResult(True)),
    ):
        d.refresh_from_db()
        delivery_mod.process_due(now=d.next_attempt_at)
    d.refresh_from_db()
    assert d.status == "sent"
    msg = SMSMessage.objects.get(phone=u.phone)  # one row across three attempts
    assert (msg.attempts, msg.backend, msg.failed_over, msg.status) == (3, "aakash", True, "sent")


def test_system_health_shows_failovers():
    with (
        mock.patch(SPARROW, return_value=SMSResult(False, "503")),
        mock.patch(AAKASH, return_value=SMSResult(True, "200")),
    ):
        for i in range(3):
            send_sms.apply(args=(f"984100000{i}", "hello"), kwargs={"kind": "otp"})
    staff = auth_client(f.UserFactory(is_staff=True))
    sms = staff.get("/api/v1/ops/system/health").json()["sms"]
    assert sms["primary"] == "sparrow" and sms["failover"] == "aakash"
    assert sms["circuit_open"] is True and sms["failovers_24h"] == 3
    first = sms["recent_failovers"][0]
    assert first["kind"] == "otp" and first["backend"] == "aakash" and "phone" not in first
