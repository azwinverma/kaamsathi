"""Platform controls: feature flags (C015/X012), OTP resend cooldown (D005), payout webhook replay
protection, KYC four-eyes."""

import datetime as dt
import hashlib
import hmac
import json
import time

import pytest
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.test import override_settings
from django.utils import timezone

from apps.accounts.models import PhoneOTP, StaffProfile
from apps.audit.models import AuditLog
from apps.core import flags
from apps.core.models import FeatureFlag
from apps.risk.models import VerificationReview
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


# ================================================================ feature flags


def test_is_enabled_falls_back_to_settings_then_flag_overrides(settings, org):
    settings.KYB_REQUIRED_FOR_SHORTLIST = True
    assert flags.is_enabled("kyb_required_for_shortlist") is True
    settings.KYB_REQUIRED_FOR_SHORTLIST = False
    assert flags.is_enabled("kyb_required_for_shortlist") is False
    assert flags.is_enabled("unknown_flag") is False
    settings.PAYOUT_PROVIDERS = ["bank_file", "esewa"]
    assert flags.is_enabled("payout_esewa") and not flags.is_enabled("payout_khalti")

    FeatureFlag.objects.create(key="kyb_required_for_shortlist", enabled=True)
    assert flags.is_enabled("kyb_required_for_shortlist") is True
    FeatureFlag.objects.filter(key="kyb_required_for_shortlist").update(enabled=False)
    assert flags.is_enabled("kyb_required_for_shortlist") is False


def test_rollout_orgs_and_percent(org):
    other = f.OrganizationFactory()
    FeatureFlag.objects.create(key="new_wage_sheet", enabled=True, rollout="orgs", org_ids=[str(org.id)])
    assert flags.is_enabled("new_wage_sheet", organization=org)
    assert not flags.is_enabled("new_wage_sheet", organization=other)
    assert not flags.is_enabled("new_wage_sheet")

    FeatureFlag.objects.create(key="beta", enabled=True, rollout="percent", percent=0)
    assert not flags.is_enabled("beta", organization=org)
    FeatureFlag.objects.filter(key="beta").update(percent=100)
    assert flags.is_enabled("beta", organization=org)
    FeatureFlag.objects.filter(key="beta").update(percent=50)
    expected = flags.bucket("beta", str(org.id)) < 50
    assert flags.is_enabled("beta", organization=org) is expected  # stable per org
    assert flags.is_enabled("beta", organization=org) is expected


@override_settings(FEATURE_FLAG_CACHE_SECONDS=60)
def test_flag_cache_is_invalidated_on_save():
    cache.delete(flags.CACHE_KEY)
    flag = FeatureFlag.objects.create(key="cached", enabled=True)
    assert flags.is_enabled("cached")
    flag.enabled = False
    flag.save()
    assert not flags.is_enabled("cached")
    flag.delete()
    assert not flags.is_enabled("cached")
    cache.delete(flags.CACHE_KEY)


def test_ops_flags_crud_superadmin_only_and_audited(staff_client):
    res = staff_client.get("/api/v1/ops/flags")
    assert res.status_code == 200
    defaults = {d["key"] for d in res.json()["settings_defaults"]}
    assert {"kyb_required_for_shortlist", "kyc_four_eyes", "payout_esewa"} <= defaults

    res = staff_client.post(
        "/api/v1/ops/flags",
        {"key": "kyc_four_eyes", "description": "Two verifiers", "enabled": True, "client_visible": True},
        format="json",
    )
    assert res.status_code == 201, res.json()
    assert res.json()["rollout"] == "all" and res.json()["has_settings_fallback"] is True
    assert flags.is_enabled("kyc_four_eyes")
    dup = staff_client.post("/api/v1/ops/flags", {"key": "kyc_four_eyes"}, format="json")
    assert dup.status_code == 400 and dup.json()["error"]["code"] == "duplicate"
    bad = staff_client.post("/api/v1/ops/flags", {"key": "Bad Key!"}, format="json")
    assert bad.status_code == 400
    bad = staff_client.post("/api/v1/ops/flags", {"key": "x_orgs", "rollout": "orgs"}, format="json")
    assert bad.status_code == 400 and "org_ids" in bad.json()["error"]["fields"]
    bad = staff_client.post("/api/v1/ops/flags", {"key": "x_pct", "percent": 101}, format="json")
    assert bad.status_code == 400

    res = staff_client.patch("/api/v1/ops/flags/kyc_four_eyes", {"enabled": False}, format="json")
    assert res.status_code == 200 and res.json()["enabled"] is False
    assert res.json()["updated_by"] is not None
    assert not flags.is_enabled("kyc_four_eyes")
    assert staff_client.delete("/api/v1/ops/flags/kyc_four_eyes").status_code == 204
    assert staff_client.get("/api/v1/ops/flags/kyc_four_eyes").status_code == 404
    actions = set(AuditLog.objects.filter(action__startswith="ops.flag.").values_list("action", flat=True))
    assert actions == {"ops.flag.create", "ops.flag.update", "ops.flag.delete"}

    verifier = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=verifier, roles=["verifier"])
    assert auth_client(verifier).get("/api/v1/ops/flags").status_code == 403
    assert auth_client(f.UserFactory()).get("/api/v1/ops/flags").status_code == 403


def test_client_flags_only_client_visible(owner_client, org, api):
    FeatureFlag.objects.create(key="new_ui", enabled=True, client_visible=True)
    FeatureFlag.objects.create(key="secret_backend", enabled=True, client_visible=False)
    FeatureFlag.objects.create(
        key="org_beta", enabled=True, rollout="orgs", org_ids=[str(org.id)], client_visible=True
    )
    res = owner_client.get("/api/v1/flags")
    assert res.status_code == 200
    assert res.json() == {"flags": {"new_ui": True, "org_beta": True}}
    no_org = auth_client(f.UserFactory()).get("/api/v1/flags")
    assert no_org.json() == {"flags": {"new_ui": True, "org_beta": False}}
    assert api.get("/api/v1/flags").status_code == 401


# ================================================================ OTP resend cooldown


def test_otp_resend_cooldown_30_seconds(api, settings):
    settings.OTP_RESEND_COOLDOWN_SECONDS = 30
    phone = "9841555001"
    assert api.post("/api/v1/auth/otp/request", {"phone": phone}, format="json").status_code == 200
    res = api.post("/api/v1/auth/otp/request", {"phone": phone}, format="json")
    assert res.status_code == 429
    err = res.json()["error"]
    assert err["code"] == "otp_rate_limited" and 1 <= err["retry_after"] <= 30
    assert res["Retry-After"] == str(err["retry_after"])
    # other phones are unaffected
    assert api.post("/api/v1/auth/otp/request", {"phone": "9841555002"}, format="json").status_code == 200
    # after the cooldown the same phone may request again
    PhoneOTP.objects.filter(phone=phone).update(created_at=timezone.now() - dt.timedelta(seconds=31))
    assert api.post("/api/v1/auth/otp/request", {"phone": phone}, format="json").status_code == 200


def test_otp_hourly_limit_reports_retry_after(api, settings):
    settings.OTP_RESEND_COOLDOWN_SECONDS = 0
    phone = "9841555003"
    for _ in range(settings.OTP_MAX_PER_HOUR):
        assert api.post("/api/v1/auth/otp/request", {"phone": phone}, format="json").status_code == 200
    res = api.post("/api/v1/auth/otp/request", {"phone": phone}, format="json")
    assert res.status_code == 429 and 3500 <= res.json()["error"]["retry_after"] <= 3600


# ================================================================ payout webhook replay

SECRET = "whsec-replay"
WALLET = dict(
    PAYOUT_PROVIDERS=["bank_file", "esewa"],
    PAYOUT_WEBHOOK_SECRETS={"esewa": SECRET},
    ESEWA_MERCHANT_CODE="EPAYTEST",
    ESEWA_SECRET_KEY="secret",
)
URL = "/api/v1/webhooks/payouts/esewa"


def _sig(message: bytes) -> str:
    return hmac.new(SECRET.encode(), message, hashlib.sha256).hexdigest()


@override_settings(**WALLET)
def test_webhook_raw_body_signature_and_exact_replay_409(api):
    cache.clear()
    body = json.dumps({"items": [{"reference": "nope-1", "status": "COMPLETE"}]}).encode()
    first = api.post(URL, body, content_type="application/json", HTTP_X_SIGNATURE=_sig(body))
    assert first.status_code == 200 and first.json() == {"received": 1, "applied": 0}
    again = api.post(URL, body, content_type="application/json", HTTP_X_SIGNATURE=_sig(body))
    assert again.status_code == 409 and again.json()["error"]["code"] == "webhook_replayed"


@override_settings(**WALLET)
def test_webhook_timestamped_signature_and_skew(api):
    cache.clear()
    body = json.dumps({"items": [{"reference": "nope-2", "status": "failed"}]}).encode()
    ts = str(int(time.time()))
    ok = api.post(
        URL,
        body,
        content_type="application/json",
        HTTP_X_TIMESTAMP=ts,
        HTTP_X_SIGNATURE=_sig(f"{ts}.".encode() + body),
    )
    assert ok.status_code == 200
    # raw-body signature is not valid once a timestamp is sent
    bad = api.post(
        URL,
        body,
        content_type="application/json",
        HTTP_X_TIMESTAMP=str(int(ts) + 1),
        HTTP_X_SIGNATURE=_sig(body),
    )
    assert bad.status_code == 403 and bad.json()["error"]["code"] == "invalid_signature"
    old = str(int(time.time()) - 301)
    stale = api.post(
        URL,
        body,
        content_type="application/json",
        HTTP_X_TIMESTAMP=old,
        HTTP_X_SIGNATURE=_sig(f"{old}.".encode() + body),
    )
    assert stale.status_code == 403
    junk = api.post(URL, body, content_type="application/json", HTTP_X_TIMESTAMP="abc", HTTP_X_SIGNATURE="x")
    assert junk.status_code == 403


@override_settings(**WALLET)
def test_webhook_failed_processing_does_not_burn_the_signature(api, monkeypatch):
    cache.clear()
    from apps.payouts import services

    body = json.dumps({"items": [{"reference": "nope-3", "status": "paid"}]}).encode()

    def boom(*a, **k):
        raise RuntimeError("db down")

    monkeypatch.setattr(services, "apply_updates", boom)
    failed = api.post(URL, body, content_type="application/json", HTTP_X_SIGNATURE=_sig(body))
    assert failed.status_code == 500
    monkeypatch.undo()
    retry = api.post(URL, body, content_type="application/json", HTTP_X_SIGNATURE=_sig(body))
    assert retry.status_code == 200


# ================================================================ KYC four-eyes


def _verifiable_worker():
    w = f.WorkerFactory(verification_status="pending", citizenship_no="55-66-77")
    w.id_front.save("front.jpg", ContentFile(b"img"), save=True)
    return w


def _verifier():
    user = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=user, roles=["verifier"])
    return auth_client(user)


def test_four_eyes_off_by_default_single_verifier_finalises(staff_client):
    w = _verifiable_worker()
    res = staff_client.post(f"/api/v1/ops/workers/{w.id}/verify", {"status": "verified"}, format="json")
    assert res.status_code == 200 and res.json()["kyc_review"] is None
    w.refresh_from_db()
    assert w.verification_status == "verified"
    assert VerificationReview.objects.get(worker=w).stage == "final"


def test_four_eyes_requires_a_second_different_verifier():
    FeatureFlag.objects.create(key="kyc_four_eyes", enabled=True)
    first, second = _verifier(), _verifier()
    w = _verifiable_worker()
    url = f"/api/v1/ops/workers/{w.id}/verify"

    res = first.post(url, {"status": "verified", "note": "ID matches"}, format="json")
    assert res.status_code == 200, res.json()
    assert res.json()["verification_status"] == "pending"
    review = res.json()["kyc_review"]
    assert review["required"] is True and review["first_review_by"]["id"]
    w.refresh_from_db()
    assert w.verification_status == "pending"

    same = first.post(url, {"status": "verified"}, format="json")
    assert same.status_code == 400 and same.json()["error"]["code"] == "invalid_state"
    w.refresh_from_db()
    assert w.verification_status == "pending"

    done = second.post(url, {"status": "verified"}, format="json")
    assert done.status_code == 200 and done.json()["kyc_review"] is None
    w.refresh_from_db()
    assert w.verification_status == "verified"
    stages = list(
        VerificationReview.objects.filter(worker=w).order_by("created_at").values_list("stage", flat=True)
    )
    assert stages == ["first", "final"]


@override_settings(KYC_FOUR_EYES=True)
def test_four_eyes_via_setting_and_rejection_is_final():
    first, second = _verifier(), _verifier()
    w = _verifiable_worker()
    url = f"/api/v1/ops/workers/{w.id}/verify"
    assert first.post(url, {"status": "verified"}, format="json").json()["verification_status"] == "pending"
    res = second.post(url, {"status": "rejected", "note": "photo mismatch"}, format="json")
    assert res.status_code == 200 and res.json()["verification_status"] == "rejected"
    # a later verification starts a fresh two-person review
    w.verification_status = "pending"
    w.save(update_fields=["verification_status"])
    assert second.post(url, {"status": "verified"}, format="json").json()["verification_status"] == "pending"
