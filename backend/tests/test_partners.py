"""Partner API: key auth, scopes, consent grants, access log, referral status, webhooks."""

import datetime as dt
import hashlib
import hmac
import json

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.finance.models import Offer, Referral
from apps.partners.auth import hash_key
from apps.partners.models import ConsentGrant, Partner, PartnerAccessLog, PartnerAPIKey
from apps.partners.services import create_api_key, create_grant, send_webhook, sign_payload
from apps.partners.tasks import expire_grants
from apps.workers.models import Consent
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

ALL_SCOPES = ["profile.read", "earnings.read", "passport.read", "referrals.write"]


@pytest.fixture
def partner():
    return Partner.objects.create(name="Test Bank (sandbox)", kind="bank", regulator="nrb", license_no="T-1")


def partner_client(full_key):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Partner {full_key}")
    return c


@pytest.fixture
def key(partner):
    k, full = create_api_key(partner, ALL_SCOPES)
    return k, full


@pytest.fixture
def worker_user():
    user = f.UserFactory()
    worker = f.WorkerFactory(user=user, phone=user.phone)
    f.WorkerSkillFactory(worker=worker)
    return user, worker


def grant_for(worker, partner, scopes=("profile.read", "earnings.read"), days=30):
    return create_grant(worker, partner, purpose="loan_assessment", scopes=list(scopes), days=days)


# ----------------------------------------------------------------------------- key auth
def test_key_stored_as_hash_only(key):
    k, full = key
    assert full.startswith(f"ks_{k.prefix}_")
    assert len(k.prefix) == 8
    assert k.key_hash == hashlib.sha256(full.encode()).hexdigest() == hash_key(full)
    assert full not in json.dumps(list(PartnerAPIKey.objects.values("prefix", "key_hash", "scopes")))


def test_valid_key_lists_grants(key, partner):
    _k, full = key
    res = partner_client(full).get("/api/v1/partner/grants?status=active")
    assert res.status_code == 200, res.json()
    assert res.json()["count"] == 0
    assert PartnerAPIKey.objects.get(pk=_k.pk).last_used_at is not None


@pytest.mark.parametrize(
    "header",
    ["Partner ks_abcdefgh_nope", "Partner garbage", "Partner", "Partner a b"],
)
def test_invalid_key_is_401(key, header):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=header)
    res = c.get("/api/v1/partner/grants")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "not_authenticated"


def test_wrong_secret_same_prefix_is_401(key):
    k, full = key
    res = partner_client(f"ks_{k.prefix}_wrongsecret").get("/api/v1/partner/grants")
    assert res.status_code == 401


def test_revoked_key_is_401(key):
    k, full = key
    k.revoked_at = timezone.now()
    k.save()
    assert partner_client(full).get("/api/v1/partner/grants").status_code == 401


def test_inactive_partner_is_401(key, partner):
    partner.is_active = False
    partner.save()
    assert partner_client(key[1]).get("/api/v1/partner/grants").status_code == 401


def test_jwt_user_cannot_use_partner_api(worker_user):
    user, _w = worker_user
    assert auth_client(user).get("/api/v1/partner/grants").status_code == 401


def test_wrong_scope_is_403(partner, worker_user):
    _u, worker = worker_user
    _k, full = create_api_key(partner, ["profile.read"])
    grant_for(worker, partner)
    res = partner_client(full).get(f"/api/v1/partner/workers/{worker.id}/earnings")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "permission_denied"


# ----------------------------------------------------------------------------- grants
def test_no_grant_is_403_and_logged(key, partner, worker_user):
    _u, worker = worker_user
    res = partner_client(key[1]).get(f"/api/v1/partner/workers/{worker.id}/profile")
    assert res.status_code == 403
    row = PartnerAccessLog.objects.get()
    assert row.worker == worker and row.status_code == 403 and row.scope == "profile.read"


def test_active_grant_allows_read_and_logs(key, partner, worker_user):
    _u, worker = worker_user
    grant_for(worker, partner)
    c = partner_client(key[1])
    res = c.get(f"/api/v1/partner/workers/{worker.id}/profile")
    assert res.status_code == 200, res.json()
    body = res.json()
    assert body["name"] == worker.full_name
    assert {"verification_level", "skills", "work", "identity"} <= set(body)
    res = c.get(f"/api/v1/partner/workers/{worker.id}/earnings")
    assert res.status_code == 200
    assert res.json()["basis"] == "paid_payslips"
    logs = PartnerAccessLog.objects.filter(worker=worker, status_code=200)
    assert set(logs.values_list("scope", flat=True)) == {"profile.read", "earnings.read"}


def test_grant_scope_must_cover_endpoint(key, partner, worker_user):
    _u, worker = worker_user
    grant_for(worker, partner, scopes=["profile.read"])
    assert partner_client(key[1]).get(f"/api/v1/partner/workers/{worker.id}/earnings").status_code == 403


def test_expired_grant_is_403(key, partner, worker_user):
    _u, worker = worker_user
    g = grant_for(worker, partner)
    g.expires_at = timezone.now() - dt.timedelta(minutes=1)
    g.save()
    assert partner_client(key[1]).get(f"/api/v1/partner/workers/{worker.id}/profile").status_code == 403


def test_grant_of_other_partner_does_not_count(key, worker_user):
    _u, worker = worker_user
    other = Partner.objects.create(name="Other", kind="insurer")
    grant_for(worker, other)
    assert partner_client(key[1]).get(f"/api/v1/partner/workers/{worker.id}/profile").status_code == 403


def test_worker_grant_and_instant_revoke(key, partner, worker_user):
    user, worker = worker_user
    me = auth_client(user)
    res = me.post(
        "/api/v1/me/grants",
        {"partner_id": str(partner.id), "purpose": "loan_assessment", "scopes": ["profile.read"], "days": 10},
        format="json",
    )
    assert res.status_code == 201, res.json()
    grant_id = res.json()["id"]
    assert res.json()["status"] == "active"
    assert Consent.objects.filter(
        worker=worker, scope="history_share", organization=None, granted=True
    ).exists()

    pc = partner_client(key[1])
    assert pc.get(f"/api/v1/partner/workers/{worker.id}/profile").status_code == 200

    res = me.post(f"/api/v1/me/grants/{grant_id}/revoke")
    assert res.status_code == 200 and res.json()["status"] == "revoked"
    assert Consent.objects.filter(worker=worker, scope="history_share", granted=False).exists()
    assert pc.get(f"/api/v1/partner/workers/{worker.id}/profile").status_code == 403

    log = me.get("/api/v1/me/partner-access").json()
    assert log["count"] == 2
    assert {r["status_code"] for r in log["results"]} == {200, 403}
    assert log["results"][0]["partner"]["name"] == partner.name


def test_grant_days_capped(partner, worker_user, settings):
    settings.PARTNER_GRANT_MAX_DAYS = 90
    user, _w = worker_user
    res = auth_client(user).post(
        "/api/v1/me/grants",
        {"partner_id": str(partner.id), "purpose": "insurance", "scopes": ["profile.read"], "days": 91},
        format="json",
    )
    assert res.status_code == 400


def test_grant_rejects_non_data_scope(partner, worker_user):
    user, _w = worker_user
    res = auth_client(user).post(
        "/api/v1/me/grants",
        {"partner_id": str(partner.id), "purpose": "insurance", "scopes": ["referrals.write"]},
        format="json",
    )
    assert res.status_code == 400


def test_cannot_revoke_someone_elses_grant(partner, worker_user):
    _u, worker = worker_user
    g = grant_for(worker, partner)
    other = f.UserFactory()
    f.WorkerFactory(user=other, phone=other.phone)
    assert auth_client(other).post(f"/api/v1/me/grants/{g.id}/revoke").status_code == 404


def test_expire_grants_task(partner, worker_user):
    _u, worker = worker_user
    g = grant_for(worker, partner)
    ConsentGrant.objects.filter(pk=g.pk).update(expires_at=timezone.now() - dt.timedelta(hours=1))
    assert expire_grants() == 1
    g.refresh_from_db()
    assert g.status == "expired"
    assert Consent.objects.filter(worker=worker, granted=False).count() == 1
    assert expire_grants() == 0


def test_me_partners_lists_active(partner, worker_user):
    user, _w = worker_user
    Partner.objects.create(name="Off", kind="bank", is_active=False)
    Offer.objects.create(partner=partner, kind="ewa", title="EWA")
    res = auth_client(user).get("/api/v1/me/partners")
    assert res.status_code == 200
    names = [p["name"] for p in res.json()]
    assert names == [partner.name]
    assert res.json()[0]["offers"][0]["kind"] == "ewa"
    assert res.json()[0]["regulator_label"] == "Nepal Rastra Bank"


def test_partner_grants_hide_name_when_inactive(key, partner, worker_user):
    _u, worker = worker_user
    g = grant_for(worker, partner)
    pc = partner_client(key[1])
    assert (
        pc.get("/api/v1/partner/grants?status=active").json()["results"][0]["worker"]["full_name"]
        == worker.full_name
    )
    g.revoked_at = timezone.now()
    g.save()
    assert pc.get("/api/v1/partner/grants?status=active").json()["count"] == 0
    row = pc.get("/api/v1/partner/grants?status=revoked").json()["results"][0]
    assert "full_name" not in row["worker"]


# ----------------------------------------------------------------------------- referrals
@pytest.fixture
def referral(partner, worker_user):
    _u, worker = worker_user
    offer = Offer.objects.create(partner=partner, kind="tool_finance", title="Tools")
    g = grant_for(worker, partner)
    return Referral.objects.create(worker=worker, offer=offer, partner=partner, grant=g)


def test_partner_updates_referral_status(key, referral):
    pc = partner_client(key[1])
    res = pc.post(
        f"/api/v1/partner/referrals/{referral.id}/status",
        {"status": "approved", "partner_ref": "BANK-1", "amount_approved": "30000"},
        format="json",
    )
    assert res.status_code == 200, res.json()
    referral.refresh_from_db()
    assert (
        referral.status == "approved"
        and referral.amount_approved == 30000
        and referral.partner_ref == "BANK-1"
    )
    assert [h["status"] for h in referral.history] == ["approved"]
    assert pc.get("/api/v1/partner/referrals?status=approved").json()["count"] == 1
    # invalid transition
    res = pc.post(
        f"/api/v1/partner/referrals/{referral.id}/status", {"status": "under_review"}, format="json"
    )
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"


def test_referral_status_needs_referrals_write(partner, referral):
    _k, full = create_api_key(partner, ["profile.read"])
    res = partner_client(full).post(
        f"/api/v1/partner/referrals/{referral.id}/status", {"status": "approved"}, format="json"
    )
    assert res.status_code == 403
    referral.refresh_from_db()
    assert referral.status == "submitted"


def test_other_partner_cannot_touch_referral(referral):
    other = Partner.objects.create(name="Other", kind="bank")
    _k, full = create_api_key(other, ALL_SCOPES)
    res = partner_client(full).post(
        f"/api/v1/partner/referrals/{referral.id}/status", {"status": "approved"}, format="json"
    )
    assert res.status_code == 404


def test_referral_status_not_settable_by_worker_or_ops(referral, worker_user, staff_client):
    user, _w = worker_user
    body = {"status": "approved"}
    url = f"/api/v1/partner/referrals/{referral.id}/status"
    assert auth_client(user).post(url, body, format="json").status_code == 401
    assert staff_client.post(url, body, format="json").status_code == 401
    # no ops/worker endpoint mutates referral status
    assert staff_client.patch(
        f"/api/v1/ops/finance/referrals/{referral.id}", body, format="json"
    ).status_code in (404, 405)
    referral.refresh_from_db()
    assert referral.status == "submitted"


# ----------------------------------------------------------------------------- ops
def test_ops_partner_crud_and_keys(staff_client):
    res = staff_client.post(
        "/api/v1/ops/partners",
        {"name": "New Bank", "kind": "bank", "regulator": "nrb", "contact_email": "a@b.example"},
        format="json",
    )
    assert res.status_code == 201, res.json()
    pid = res.json()["id"]
    assert res.json()["webhook_secret"].startswith("whsec_")
    assert (
        staff_client.patch(f"/api/v1/ops/partners/{pid}", {"license_no": "X"}, format="json").status_code
        == 200
    )

    res = staff_client.post(
        f"/api/v1/ops/partners/{pid}/keys", {"scopes": ["profile.read"], "name": "prod"}, format="json"
    )
    assert res.status_code == 201
    full = res.json()["key"]
    key_id = res.json()["id"]
    listed = staff_client.get(f"/api/v1/ops/partners/{pid}/keys").json()
    assert len(listed) == 1 and "key" not in listed[0] and full not in json.dumps(listed)
    assert partner_client(full).get("/api/v1/partner/grants").status_code == 200

    res = staff_client.post(f"/api/v1/ops/partners/{pid}/keys/{key_id}/revoke")
    assert res.status_code == 200 and res.json()["is_active"] is False
    assert partner_client(full).get("/api/v1/partner/grants").status_code == 401

    detail = staff_client.get(f"/api/v1/ops/partners/{pid}").json()
    assert detail["stats"]["active_keys"] == 0
    log = staff_client.get(f"/api/v1/ops/partners/{pid}/access-log").json()
    assert log["count"] == 1  # the one successful call while the key was valid


def test_ops_partners_requires_staff(worker_user):
    user, _w = worker_user
    assert auth_client(user).get("/api/v1/ops/partners").status_code == 403


# ----------------------------------------------------------------------------- webhooks
def test_webhook_signature(partner, monkeypatch):
    partner.webhook_url = "https://partner.example/hooks"
    partner.save()
    sent = {}

    class Resp:
        status_code = 200

    def fake_post(url, data, headers, timeout):
        sent.update(url=url, data=data, headers=headers, timeout=timeout)
        return Resp()

    monkeypatch.setattr("requests.post", fake_post)
    assert send_webhook(partner, "referral.created", {"referral_id": "x"}) is True
    partner.refresh_from_db()
    ts = sent["headers"]["X-KaamSathi-Timestamp"]
    expected = (
        "sha256="
        + hmac.new(
            partner.webhook_secret.encode(), ts.encode() + b"." + sent["data"], hashlib.sha256
        ).hexdigest()
    )
    assert (
        sent["headers"]["X-KaamSathi-Signature"]
        == expected
        == sign_payload(partner.webhook_secret, ts, sent["data"])
    )
    assert json.loads(sent["data"])["event"] == "referral.created"
    assert sent["timeout"][1] <= 10


def test_referral_apply_fires_webhook_after_commit(
    partner, worker_user, monkeypatch, django_capture_on_commit_callbacks
):
    import requests

    from apps.finance.services import apply_to_offer

    partner.webhook_url = "https://partner.example/hooks"
    partner.save()
    _u, worker = worker_user
    offer = Offer.objects.create(partner=partner, kind="insurance", title="Accident")
    calls = []

    def boom(*a, **kw):
        calls.append(kw)
        raise requests.ConnectionError("down")

    monkeypatch.setattr("requests.post", boom)
    with django_capture_on_commit_callbacks(execute=True):
        referral = apply_to_offer(worker, offer)
    assert len(calls) == 1  # attempted, failure did not break the request
    referral.refresh_from_db()
    assert referral.partner_notified_at is None


def test_partner_profile_uses_full_passport_with_verified_credentials(key, partner, worker_user):
    """Regression: the partner API must use the credentials passport builder, not the fallback."""
    from apps.credentials.models import Credential

    _u, worker = worker_user
    Credential.objects.create(
        worker=worker, kind="nstb", title="Electrician Level 2", issuer="NSTB", status="verified"
    )
    Credential.objects.create(worker=worker, kind="safety", title="Unverified", issuer="X", status="pending")
    grant_for(worker, partner)
    body = partner_client(key[1]).get(f"/api/v1/partner/workers/{worker.id}/profile").json()
    assert [c["title"] for c in body["credentials"]] == ["Electrician Level 2"]
    assert body["verify_url"].endswith(f"/p/{worker.passport.public_code}")
