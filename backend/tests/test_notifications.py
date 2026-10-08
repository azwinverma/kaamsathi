"""Inbox, devices, SMS→inbox mirroring and the FCM HTTP v1 adapter (CONTRACT-EXTENSIONS §4)."""

import base64
import json
from unittest import mock

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from django.core.cache import cache

from apps.notifications import push
from apps.notifications.models import DeviceToken, Notification, SMSMessage
from apps.notifications.services import notify, send_sms
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return f.UserFactory(preferred_language="en")


@pytest.fixture
def client(user):
    return auth_client(user)


# --------------------------------------------------------------------------- inbox
def test_notify_creates_inbox_row(user):
    notify(user, "test", "Hello", "Body", title_ne="नमस्ते", data={"a": 1}, link="/app/payroll")
    n = Notification.objects.get(user=user)
    assert (n.kind, n.title, n.title_ne, n.body, n.data, n.link) == (
        "test",
        "Hello",
        "नमस्ते",
        "Body",
        {"a": 1},
        "/app/payroll",
    )
    assert n.read_at is None


def test_inbox_unread_count_read_and_read_all(user, client):
    for i in range(3):
        notify(user, "k", f"T{i}", "b")
    notify(f.UserFactory(), "k", "other user", "b")
    body = client.get("/api/v1/me/notifications").json()
    assert body["count"] == 3 and body["results"][0]["title"] == "T2"  # newest first
    assert client.get("/api/v1/me/notifications/unread-count").json() == {"count": 3}

    nid = body["results"][0]["id"]
    res = client.post(f"/api/v1/me/notifications/{nid}/read")
    assert res.status_code == 200 and res.json()["read_at"] is not None
    assert client.get("/api/v1/me/notifications/unread-count").json() == {"count": 2}
    assert client.get("/api/v1/me/notifications", {"unread": "1"}).json()["count"] == 2

    assert client.post("/api/v1/me/notifications/read-all").json() == {"updated": 2}
    assert client.get("/api/v1/me/notifications/unread-count").json() == {"count": 0}


def test_cannot_read_someone_elses_notification(client):
    notify(f.UserFactory(), "k", "secret", "b")
    other = Notification.objects.get()
    assert client.post(f"/api/v1/me/notifications/{other.id}/read").status_code == 404
    other.refresh_from_db()
    assert other.read_at is None


def test_inbox_requires_login(api):
    assert api.get("/api/v1/me/notifications").status_code == 401


def test_notify_with_sms_sends_in_user_language(django_capture_on_commit_callbacks):
    u = f.UserFactory(preferred_language="ne")
    with django_capture_on_commit_callbacks(execute=True):
        notify(u, "shortlist", "Shortlisted", "You are shortlisted", body_ne="तपाईं छनोट हुनुभयो", sms=True)
    sms = SMSMessage.objects.get(phone=u.phone)
    assert "छनोट" in sms.body and sms.kind == "shortlist"
    assert Notification.objects.filter(user=u).count() == 1  # no duplicate inbox row from the SMS


# --------------------------------------------------------------------------- SMS events mirrored
def test_existing_sms_events_create_inbox_rows(user):
    send_sms(user.phone, "KaamSathi: A worker raised a dispute.", kind="dispute_raised")
    n = Notification.objects.get(user=user)
    assert n.kind == "dispute_raised" and n.link == "/app/disputes" and n.title_ne
    send_sms(user.phone, "Your code is 123456", kind="otp")  # not an inbox event
    send_sms("9811111111", "x", kind="dispute_raised")  # no such user
    assert Notification.objects.count() == 1


def test_payslip_ready_task_creates_inbox_row(org):
    from apps.notifications.tasks import payslip_ready
    from apps.payroll import services as payroll

    worker_user = f.UserFactory()
    worker = f.WorkerFactory(user=worker_user, phone=worker_user.phone)
    f.EmploymentFactory(organization=org, worker=worker)
    run = payroll.create_run(org, 2083, 4)
    assert payslip_ready(str(run.id)) == 1
    n = Notification.objects.get(user=worker_user)
    assert n.kind == "payslip_ready" and "salary" in n.body


def test_shortlist_task_notifies_org_inbox(org, owner):
    from apps.notifications.tasks import notify_employer_shortlist

    job = f.JobFactory(organization=org)
    notify_employer_shortlist(str(job.id), 2)
    assert Notification.objects.filter(user=owner, kind="shortlist").exists()


# --------------------------------------------------------------------------- devices
def test_register_and_delete_device(user, client):
    token = "fcm-token-" + "a" * 40
    res = client.post("/api/v1/me/devices", {"platform": "android", "token": token}, format="json")
    assert res.status_code == 201 and res.json()["created"] is True
    res = client.post("/api/v1/me/devices", {"platform": "android", "token": token}, format="json")
    assert res.status_code == 200
    # the same physical device signing in as someone else moves the token
    other = f.UserFactory()
    auth_client(other).post("/api/v1/me/devices", {"platform": "android", "token": token}, format="json")
    assert DeviceToken.objects.get(token=token).user == other
    assert client.delete(f"/api/v1/me/devices/{token}").status_code == 404
    assert auth_client(other).delete(f"/api/v1/me/devices/{token}").status_code == 204
    assert not DeviceToken.objects.exists()
    assert (
        client.post("/api/v1/me/devices", {"platform": "nokia", "token": token}, format="json").status_code
        == 400
    )


# --------------------------------------------------------------------------- FCM adapter
def test_fcm_disabled_path(user, settings):
    settings.FCM_PROJECT_ID = ""
    settings.FCM_SERVICE_ACCOUNT_JSON = ""
    DeviceToken.objects.create(user=user, platform="android", token="t" * 20)
    assert push.enabled() is False
    with mock.patch("requests.post") as post:
        assert push.send("t" * 20, "a", "b") == "disabled"
        notify(user, "k", "Title", "Body")
        from apps.notifications.tasks import send_push

        assert send_push(str(Notification.objects.get().id)) == 0
    post.assert_not_called()


def _account():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    account = {
        "type": "service_account",
        "client_email": "push@demo-project.iam.gserviceaccount.com",
        "private_key": pem,
        "private_key_id": "kid123",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    return key, account


def _b64d(part):
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def test_fcm_jwt_is_rs256_signed():
    key, account = _account()
    jwt = push.build_jwt(account, now=1_700_000_000)
    header_b64, claims_b64, sig_b64 = jwt.split(".")
    header, claims = json.loads(_b64d(header_b64)), json.loads(_b64d(claims_b64))
    assert header == {"alg": "RS256", "typ": "JWT", "kid": "kid123"}
    assert claims == {
        "iss": account["client_email"],
        "scope": "https://www.googleapis.com/auth/firebase.messaging",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": 1_700_000_000,
        "exp": 1_700_003_600,
    }
    # verifies with the public key (raises on mismatch)
    key.public_key().verify(
        _b64d(sig_b64), f"{header_b64}.{claims_b64}".encode(), padding.PKCS1v15(), hashes.SHA256()
    )


def test_fcm_message_payload():
    msg = push.build_message("tok", "Title", "Body", data={"n": 1, "s": "x"}, link="https://kaamsathi.app/x")
    m = msg["message"]
    assert m["token"] == "tok"
    assert m["notification"] == {"title": "Title", "body": "Body"}
    assert m["data"] == {"n": "1", "s": "x", "link": "https://kaamsathi.app/x"}  # strings only
    assert m["android"]["priority"] == "high"
    assert m["webpush"] == {"fcm_options": {"link": "https://kaamsathi.app/x"}}


class R:
    def __init__(self, status, payload=None, text=""):
        self.status_code = status
        self._payload = payload or {}
        self.text = text or json.dumps(self._payload)

    def json(self):
        return self._payload


def test_fcm_send_flow_and_unregistered_token(settings, django_capture_on_commit_callbacks):
    _, account = _account()
    settings.FCM_PROJECT_ID = "demo-project"
    settings.FCM_SERVICE_ACCOUNT_JSON = json.dumps(account)
    cache.delete(push.CACHE_KEY)
    u = f.UserFactory(preferred_language="ne")
    DeviceToken.objects.create(user=u, platform="android", token="good-token-123")
    DeviceToken.objects.create(user=u, platform="ios", token="stale-token-123")

    def fake_post(url, **kwargs):
        if url == account["token_uri"]:
            assert kwargs["data"]["grant_type"] == "urn:ietf:params:oauth:grant-type:jwt-bearer"
            return R(200, {"access_token": "ya29.test", "expires_in": 3600})
        assert url == "https://fcm.googleapis.com/v1/projects/demo-project/messages:send"
        assert kwargs["headers"]["Authorization"] == "Bearer ya29.test"
        if kwargs["json"]["message"]["token"] == "stale-token-123":
            return R(
                404, text='{"error": {"status": "NOT_FOUND", "details": [{"errorCode": "UNREGISTERED"}]}}'
            )
        return R(200, {"name": "projects/demo-project/messages/1"})

    with mock.patch("requests.post", side_effect=fake_post) as post:
        with django_capture_on_commit_callbacks(execute=True):
            notify(u, "k", "Hello", "Body", title_ne="नमस्ते", body_ne="सन्देश")
    sent = [c for c in post.call_args_list if "json" in c.kwargs]
    assert len(sent) == 2
    assert sent[0].kwargs["json"]["message"]["notification"] == {"title": "नमस्ते", "body": "सन्देश"}
    assert list(DeviceToken.objects.values_list("token", flat=True)) == ["good-token-123"]
    # token is cached: a second push does not exchange a new JWT
    with mock.patch("requests.post", side_effect=fake_post) as post:
        assert push.send("good-token-123", "a", "b") == "sent"
    assert post.call_count == 1
    cache.delete(push.CACHE_KEY)


# --------------------------------------------------------------------------- templates / deliveries / prefs
import datetime as dt  # noqa: E402

from django.core import mail  # noqa: E402
from django.utils import timezone  # noqa: E402

from apps.notifications import delivery as delivery_mod  # noqa: E402
from apps.notifications import services as nsvc  # noqa: E402
from apps.notifications.models import (  # noqa: E402
    NotificationDelivery,
    NotificationPreference,
    NotificationTemplate,
)
from apps.notifications.sms import SMSResult  # noqa: E402


def test_default_templates_are_seeded():
    assert NotificationTemplate.objects.filter(key="payslip_ready", channel="sms", language="ne").exists()
    assert nsvc.ensure_default_templates() == 0  # idempotent


def test_render_language_fallback_and_missing_vars():
    NotificationTemplate.objects.create(
        key="t1", channel="inapp", language="en", subject="Hi {name}", body="B {x}"
    )
    assert nsvc.render("t1", "inapp", "ne", {"name": "Ram", "x": 1}) == ("Hi Ram", "B 1")  # ne → en
    assert nsvc.render("t1", "inapp", "ne", {}, fallback_en=False) is None
    assert nsvc.render_text("Hi {name} {y}", {"name": "Sita"}) == ("Hi Sita {y}", ["y"])
    # newest active version wins; inactive versions are ignored
    NotificationTemplate.objects.create(
        key="t1", channel="inapp", language="en", version=2, subject="v2", body="b2"
    )
    NotificationTemplate.objects.create(
        key="t1", channel="inapp", language="en", version=3, subject="v3", body="b3", is_active=False
    )
    assert nsvc.render("t1", "inapp", "en") == ("v2", "b2")


def test_notify_with_template_uses_user_language():
    u = f.UserFactory(preferred_language="ne")
    nsvc.notify(
        u,
        "timesheet_approved",
        "literal",
        "literal",
        template="timesheet_approved",
        context={"week": "2026-10-04", "hours": "2.0"},
    )
    n = Notification.objects.get(user=u)
    assert n.title == "Timesheet approved" and "2.0 h" in n.body
    assert n.title_ne == "टाइमसिट स्वीकृत भयो" and "2.0 घण्टा" in n.body_ne
    nsvc.notify(u, "x", "Literal title", "Literal body", template="no_such_template")
    assert Notification.objects.get(user=u, kind="x").title == "Literal title"


def test_deliveries_recorded_and_sms_sent(django_capture_on_commit_callbacks):
    u = f.UserFactory()
    with django_capture_on_commit_callbacks(execute=True):
        n = nsvc.notify(u, "shortlist", "T", "Body", sms=True)
    rows = {d.channel: d for d in NotificationDelivery.objects.filter(notification=n)}
    assert set(rows) == {"inapp", "sms"}
    assert (
        rows["sms"].status == "sent"
        and rows["sms"].attempts == 1
        and rows["sms"].provider_ref.startswith("sms:")
    )
    assert SMSMessage.objects.get(phone=u.phone).body == "KaamSathi: Body"


def test_sms_delivery_retries_then_fails():
    u = f.UserFactory()
    n = nsvc.notify(u, "shortlist", "T", "Body", sms=True)
    d = NotificationDelivery.objects.get(notification=n, channel="sms")
    with mock.patch("apps.notifications.sms.ConsoleSMSBackend.send", return_value=SMSResult(False, "down")):
        delivery_mod.deliver(d)
        d.refresh_from_db()
        assert d.status == "queued" and d.attempts == 1 and d.error == "down"
        assert d.next_attempt_at > timezone.now() + dt.timedelta(seconds=50)
        assert delivery_mod.process_due() == 0  # not due yet
        assert delivery_mod.process_due(now=d.next_attempt_at) == 1
        d.refresh_from_db()
        assert d.status == "queued" and d.attempts == 2
        for _ in range(2):  # retries 2 and 3 (after 5 min and 30 min)
            delivery_mod.process_due(now=d.next_attempt_at)
            d.refresh_from_db()
    assert d.status == "failed" and d.attempts == 4 and d.next_attempt_at is None


def test_email_channel_for_critical_payslip(django_capture_on_commit_callbacks):
    u = f.UserFactory(email="ram@example.com")
    NotificationPreference.objects.create(user=u, email_enabled=False, sms_enabled=False)
    ctx = {"month": "Ashwin 2083", "amount": "Rs. 19,550", "organization": "Hotel", "name": "Ram"}
    with django_capture_on_commit_callbacks(execute=True):
        nsvc.notify(u, "payslip_ready", "Salary paid", "x", sms=True, template="payslip_ready", context=ctx)
    # critical: opt-outs ignored for SMS and email
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ["ram@example.com"]
    assert mail.outbox[0].subject == "Your Ashwin 2083 payslip from Hotel"
    assert "Rs. 19,550" in SMSMessage.objects.get(phone=u.phone).body
    # non-critical, email opted out → no email delivery
    nsvc.notify(u, "shortlist", "T", "B", email=True)
    assert not NotificationDelivery.objects.filter(channel="email", notification__kind="shortlist").exists()


def test_preferences_api(user, client):
    body = client.get("/api/v1/me/notification-preferences").json()
    assert body == {
        "sms_enabled": True,
        "push_enabled": True,
        "email_enabled": True,
        "marketing_opt_in": False,
        "job_alert_frequency": "instant",
        "quiet_hours_start": None,
        "quiet_hours_end": None,
    }
    res = client.patch(
        "/api/v1/me/notification-preferences",
        {
            "sms_enabled": False,
            "job_alert_frequency": "weekly",
            "quiet_hours_start": "21:00",
            "quiet_hours_end": "07:00",
        },
        format="json",
    )
    assert res.status_code == 200, res.json()
    assert res.json()["quiet_hours_start"] == "21:00" and res.json()["job_alert_frequency"] == "weekly"
    bad = client.patch("/api/v1/me/notification-preferences", {"quiet_hours_end": None}, format="json")
    assert bad.status_code == 400


def test_opt_outs_marketing_and_quiet_hours(user):
    pref = NotificationPreference.objects.create(user=user, sms_enabled=False)
    n = nsvc.notify(user, "shortlist", "T", "B", sms=True)
    assert not n.deliveries.filter(channel="sms").exists()  # opted out
    n = nsvc.notify(user, "otp_notice", "T", "B", sms=True)
    assert n.deliveries.filter(channel="sms").exists()  # critical ignores opt-out
    assert nsvc.notify(user, "marketing_news", "T", "B") is None  # needs opt-in
    pref.marketing_opt_in = True
    pref.sms_enabled = True
    now = timezone.localtime()
    pref.quiet_hours_start = (now - dt.timedelta(hours=1)).time().replace(second=0, microsecond=0)
    pref.quiet_hours_end = (now + dt.timedelta(hours=1)).time().replace(second=0, microsecond=0)
    pref.save()
    assert nsvc.notify(user, "marketing_news", "T", "B") is not None
    held = nsvc.notify(user, "shortlist", "T", "B", sms=True).deliveries.get(channel="sms")
    assert held.status == "queued" and held.next_attempt_at > timezone.now() + dt.timedelta(minutes=50)
    urgent = nsvc.notify(user, "safety_alert", "T", "B", sms=True).deliveries.get(channel="sms")
    assert urgent.next_attempt_at <= timezone.now()


def test_payslip_task_uses_template(org, django_capture_on_commit_callbacks):
    from apps.notifications.tasks import payslip_ready
    from apps.payroll import services as payroll

    u = f.UserFactory(preferred_language="ne")
    worker = f.WorkerFactory(user=u, phone=u.phone)
    f.EmploymentFactory(organization=org, worker=worker)
    run = payroll.create_run(org, 2083, 4)
    with django_capture_on_commit_callbacks(execute=True):
        payslip_ready(str(run.id))
    n = Notification.objects.get(user=u, kind="payslip_ready")
    assert n.title_ne == "तलब भुक्तानी भयो"
    assert "भुक्तानी भयो" in SMSMessage.objects.get(phone=u.phone).body  # Nepali SMS template


# --------------------------------------------------------------------------- ops templates
def test_ops_template_crud_versions_and_preview(staff_client, client):
    res = staff_client.post(
        "/api/v1/ops/notifications/templates",
        {"key": "welcome", "channel": "sms", "language": "en", "subject": "", "body": "Hi {name}"},
        format="json",
    )
    assert res.status_code == 201 and res.json()["version"] == 1
    tid = res.json()["id"]
    res = staff_client.patch(
        f"/api/v1/ops/notifications/templates/{tid}", {"body": "Namaste {name}"}, format="json"
    )
    assert res.status_code == 201 and res.json()["version"] == 2
    assert NotificationTemplate.objects.filter(key="welcome").count() == 2
    latest = staff_client.get("/api/v1/ops/notifications/templates", {"key": "welcome", "latest": "1"}).json()
    assert [r["version"] for r in latest["results"]] == [2]
    res = staff_client.patch(
        f"/api/v1/ops/notifications/templates/{tid}", {"is_active": False}, format="json"
    )
    assert res.status_code == 200 and res.json()["version"] == 1 and res.json()["is_active"] is False
    assert nsvc.render("welcome", "sms", "en", {"name": "Ram"}) == ("", "Namaste Ram")
    res = staff_client.post(
        "/api/v1/ops/notifications/templates/preview",
        {"body": "Hi {name}, {amount}", "context": {"name": "Ram"}},
        format="json",
    )
    assert res.json()["body"] == "Hi Ram, {amount}" and res.json()["missing"] == ["amount"]
    assert client.get("/api/v1/ops/notifications/templates").status_code == 403
    assert staff_client.get("/api/v1/ops/notifications/deliveries").status_code == 200
