"""Security §1: TOTP, MFA login step, recovery codes, mfa_required gate, staff roles, sessions."""

from __future__ import annotations

import time

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts import mfa, staff_roles
from apps.accounts.models import SessionDevice, StaffProfile, User
from apps.audit.models import AuditLog
from tests import factories as f
from tests.conftest import auth_client

PHONE = "9841000001"
CODE = "123456"


# --- RFC 6238 ---------------------------------------------------------------------------------
# RFC 6238 Appendix B, SHA1 seed "12345678901234567890" (8 digits).
RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"  # base32("12345678901234567890")


@pytest.mark.parametrize(
    "at,expected",
    [
        (59, "94287082"),
        (1111111109, "07081804"),
        (1111111111, "14050471"),
        (1234567890, "89005924"),
        (2000000000, "69279037"),
        (20000000000, "65353130"),
    ],
)
def test_totp_rfc6238_sha1_vectors(at, expected):
    assert mfa.totp(RFC_SECRET, at=at, digits=8) == expected


def test_verify_totp_window_and_format():
    secret = mfa.generate_secret()
    now = 1_700_000_000
    assert mfa.verify_totp(secret, mfa.totp(secret, at=now), at=now) is not None
    assert mfa.verify_totp(secret, mfa.totp(secret, at=now - 30), at=now) is not None  # -1 step
    assert mfa.verify_totp(secret, mfa.totp(secret, at=now + 30), at=now) is not None  # +1 step
    assert mfa.verify_totp(secret, mfa.totp(secret, at=now - 90), at=now) is None
    assert mfa.verify_totp(secret, "12345", at=now) is None
    assert mfa.verify_totp(secret, "abcdef", at=now) is None
    uri = mfa.otpauth_uri(secret, "9800000003")
    assert uri.startswith("otpauth://totp/KaamSathi%3A9800000003?") and f"secret={secret}" in uri


# --- helpers ----------------------------------------------------------------------------------
def _staff(phone=PHONE, roles=None, mfa_on=False):
    user = f.UserFactory(phone=phone, is_staff=True)
    profile = StaffProfile.objects.create(user=user, roles=roles if roles is not None else ["superadmin"])
    if mfa_on:
        profile.mfa_secret = mfa.generate_secret()
        profile.mfa_enabled = True
        plain, hashes = mfa.generate_recovery_codes()
        profile.recovery_codes = hashes
        profile.save()
        return user, profile, plain
    return user, profile, []


def _otp_login(api, phone=PHONE):
    with override_settings(DEBUG=True, OTP_DEV_CODE=CODE):
        api.post("/api/v1/auth/otp/request", {"phone": phone}, format="json")
        return api.post("/api/v1/auth/otp/verify", {"phone": phone, "code": CODE}, format="json")


# --- login with MFA ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_login_without_mfa_issues_tokens_and_session():
    api = APIClient(HTTP_USER_AGENT="Mozilla/5.0 (Windows NT 10.0)")
    _staff()
    res = _otp_login(api)
    assert res.status_code == 200 and res.json()["access"]
    me = res.json()["user"]
    assert me["staff_roles"] == ["superadmin"] and me["mfa_enabled"] is False
    assert me["mfa_required"] is False
    device = SessionDevice.objects.get(user__phone=PHONE)
    assert device.platform == "web" and device.jti


@pytest.mark.django_db
def test_mfa_login_step_with_code():
    api = APIClient()
    user, profile, _ = _staff(mfa_on=True)
    res = _otp_login(api)
    body = res.json()
    assert res.status_code == 200 and body["mfa_required"] is True and "access" not in body
    bad = api.post(
        "/api/v1/auth/mfa/verify", {"mfa_token": body["mfa_token"], "code": "000000"}, format="json"
    )
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "mfa_invalid"
    code = mfa.totp(profile.mfa_secret)
    ok = api.post("/api/v1/auth/mfa/verify", {"mfa_token": body["mfa_token"], "code": code}, format="json")
    assert ok.status_code == 200, ok.content
    assert ok.json()["access"] and ok.json()["user"]["mfa_enabled"] is True
    # the same code can't be replayed within its window
    again = api.post("/api/v1/auth/mfa/verify", {"mfa_token": body["mfa_token"], "code": code}, format="json")
    assert again.json()["error"]["code"] == "mfa_invalid"
    assert AuditLog.objects.filter(action="auth.mfa.login", actor=user).exists()


@pytest.mark.django_db
def test_mfa_token_invalid_and_lockout():
    api = APIClient()
    _staff(mfa_on=True)
    res = api.post("/api/v1/auth/mfa/verify", {"mfa_token": "garbage", "code": "123456"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "mfa_token_invalid"
    token = _otp_login(api).json()["mfa_token"]
    for _ in range(5):
        api.post("/api/v1/auth/mfa/verify", {"mfa_token": token, "code": "000000"}, format="json")
    locked = api.post("/api/v1/auth/mfa/verify", {"mfa_token": token, "code": "000000"}, format="json")
    assert locked.status_code == 429 and locked.json()["error"]["code"] == "mfa_locked"


@pytest.mark.django_db
def test_recovery_code_is_single_use():
    api = APIClient()
    user, profile, plain = _staff(mfa_on=True)
    token = _otp_login(api).json()["mfa_token"]
    ok = api.post("/api/v1/auth/mfa/verify", {"mfa_token": token, "recovery_code": plain[0]}, format="json")
    assert ok.status_code == 200
    profile.refresh_from_db()
    assert len(profile.recovery_codes) == 9
    token = _otp_login(api).json()["mfa_token"]
    reuse = api.post(
        "/api/v1/auth/mfa/verify", {"mfa_token": token, "recovery_code": plain[0]}, format="json"
    )
    assert reuse.status_code == 400 and reuse.json()["error"]["code"] == "mfa_invalid"
    assert AuditLog.objects.filter(action="auth.mfa.recovery_code_used", actor=user).exists()


@pytest.mark.django_db
def test_enrol_confirm_qr_and_disable():
    user, profile, _ = _staff()
    client = auth_client(user)
    setup = client.post("/api/v1/auth/mfa/setup").json()
    assert setup["secret"] and setup["otpauth_uri"].startswith("otpauth://totp/")
    qr = client.get("/api/v1/auth/mfa/qr.svg")
    assert qr.status_code == 200 and qr["Content-Type"] == "image/svg+xml" and b"<svg" in qr.content
    assert (
        client.post("/api/v1/auth/mfa/confirm", {"code": "000000"}).json()["error"]["code"] == "mfa_invalid"
    )
    res = client.post("/api/v1/auth/mfa/confirm", {"code": mfa.totp(setup["secret"])})
    codes = res.json()["recovery_codes"]
    assert res.status_code == 200 and len(codes) == 10 and len(set(codes)) == 10
    profile.refresh_from_db()
    assert profile.mfa_enabled and profile.mfa_secret == setup["secret"]
    assert all(c not in profile.recovery_codes for c in codes)  # only hashes stored
    assert client.get("/api/v1/auth/mfa/qr.svg").status_code == 404  # secret not re-exposed
    assert client.post("/api/v1/auth/mfa/setup").status_code == 400
    assert client.get("/api/v1/auth/me").json()["mfa_enabled"] is True
    # disable with a recovery code
    res = client.post("/api/v1/auth/mfa/disable", {"code": codes[3]})
    assert res.status_code == 200 and res.json() == {"mfa_enabled": False}
    profile.refresh_from_db()
    assert not profile.mfa_enabled and profile.mfa_secret is None
    assert {"auth.mfa.enable", "auth.mfa.disable"} <= set(
        AuditLog.objects.filter(actor=user).values_list("action", flat=True)
    )


@pytest.mark.django_db
def test_mfa_secret_encrypted_at_rest():
    from django.db import connection

    user, profile, _ = _staff(mfa_on=True)
    with connection.cursor() as cur:
        cur.execute("SELECT mfa_secret FROM accounts_staffprofile WHERE id = %s", [profile.pk])
        raw = cur.fetchone()[0]
    assert raw.startswith("enc1:") and profile.mfa_secret not in raw


# --- mfa_required gate ------------------------------------------------------------------------
@pytest.mark.django_db
def test_mfa_required_gate_blocks_ops_until_enrolled():
    user, profile, _ = _staff()
    client = auth_client(user)
    with override_settings(STAFF_MFA_REQUIRED=True):
        res = client.get("/api/v1/ops/dashboard")
        assert res.status_code == 403 and res.json()["error"]["code"] == "mfa_required"
        assert client.get("/api/v1/auth/me").json()["mfa_required"] is True
        # non-ops endpoints keep working so the user can enrol
        assert client.post("/api/v1/auth/mfa/setup").status_code == 200
        profile.refresh_from_db()
        assert (
            client.post("/api/v1/auth/mfa/confirm", {"code": mfa.totp(profile.mfa_secret)}).status_code == 200
        )
        assert client.get("/api/v1/ops/dashboard").status_code == 200


# --- staff roles ------------------------------------------------------------------------------
@pytest.mark.parametrize(
    "path,role,allowed",
    [
        ("/api/v1/ops/workers", "verifier", True),
        ("/api/v1/ops/workers", "support", False),
        ("/api/v1/ops/workers/123/verify", "verifier", True),
        ("/api/v1/ops/credentials", "verifier", True),
        ("/api/v1/ops/disputes", "support", True),
        ("/api/v1/ops/disputes", "verifier", False),
        ("/api/v1/ops/privacy-requests", "support", True),
        ("/api/v1/ops/finance/summary", "finance_ops", True),
        ("/api/v1/ops/finance/summary", "support", False),
        ("/api/v1/ops/referrals", "finance_ops", True),
        ("/api/v1/ops/partners", "partner_manager", True),
        ("/api/v1/ops/partners", "finance_ops", False),
        ("/api/v1/ops/risk/flags", "risk_analyst", True),
        ("/api/v1/ops/risk/flags", "verifier", False),
        ("/api/v1/ops/audit", "verifier", False),
        ("/api/v1/ops/staff", "support", False),
        ("/api/v1/ops/system/health", "risk_analyst", False),
        ("/api/v1/ops/jobs", "verifier", True),
        ("/api/v1/ops/jobs", "support", True),
        ("/api/v1/ops/jobs", "finance_ops", False),
        ("/api/v1/ops/organizations", "support", True),
        ("/api/v1/ops/dashboard", "finance_ops", True),
        ("/api/v1/ops/insights/labour-market", "partner_manager", True),
        ("/api/v1/ops/kpis", "risk_analyst", True),
        ("/api/v1/ops/unknown-new-thing", "verifier", False),
        ("/api/v1/ops/unknown-new-thing", "superadmin", True),
        ("/api/v1/ops/workersx", "verifier", False),
    ],
)
def test_route_role_map(path, role, allowed):
    roles = staff_roles.roles_for_path(path)
    assert roles is not None
    assert (staff_roles.SUPERADMIN == role or roles == staff_roles.ANY_STAFF or role in roles) is allowed


def test_non_ops_paths_have_no_role_rule():
    assert staff_roles.roles_for_path("/api/v1/org/jobs") is None
    assert staff_roles.roles_for_path("/api/v1/auth/me") is None


@pytest.mark.django_db
def test_role_enforced_on_real_endpoints():
    verifier, _, _ = _staff(phone="9841000011", roles=["verifier"])
    support, _, _ = _staff(phone="9841000012", roles=["support"])
    v, s = auth_client(verifier), auth_client(support)
    assert v.get("/api/v1/ops/workers").status_code == 200
    assert s.get("/api/v1/ops/workers").status_code == 403
    assert s.get("/api/v1/ops/privacy-requests").status_code == 200
    assert v.get("/api/v1/ops/privacy-requests").status_code == 403
    assert v.get("/api/v1/ops/audit").status_code == 403
    assert v.get("/api/v1/ops/dashboard").status_code == 200
    assert v.get("/api/v1/auth/me").json()["staff_roles"] == ["verifier"]


@pytest.mark.django_db
def test_staff_without_profile_has_no_roles_in_production():
    user = f.UserFactory(is_staff=True)
    with override_settings(STAFF_NO_PROFILE_SUPERADMIN=None, DEBUG=False):
        assert staff_roles.user_roles(user) == set()
        assert auth_client(user).get("/api/v1/ops/workers").status_code == 403
    user2 = f.UserFactory(is_staff=True)
    with override_settings(STAFF_NO_PROFILE_SUPERADMIN=None, DEBUG=True):
        assert staff_roles.user_roles(user2) == {"superadmin"}


# --- staff admin ------------------------------------------------------------------------------
@pytest.mark.django_db
def test_staff_admin_create_update_reset_mfa_audited():
    admin, _, _ = _staff(phone="9841000020", roles=["superadmin"])
    client = auth_client(admin)
    res = client.post(
        "/api/v1/ops/staff", {"phone": "9841000021", "full_name": "Sita", "roles": ["verifier"]}
    )
    assert res.status_code == 201, res.content
    body = res.json()
    assert body["roles"] == ["verifier"] and body["mfa_enabled"] is False
    new = User.objects.get(phone="9841000021")
    assert new.is_staff
    res = client.patch(f"/api/v1/ops/staff/{new.pk}", {"roles": ["verifier", "support"]}, format="json")
    assert res.json()["roles"] == ["support", "verifier"]
    assert client.post("/api/v1/ops/staff", {"phone": "9841000022", "roles": ["bogus"]}).status_code == 400
    # reset MFA
    profile = new.staff_profile
    profile.mfa_enabled, profile.mfa_secret = True, mfa.generate_secret()
    profile.save()
    res = client.post(f"/api/v1/ops/staff/{new.pk}/reset-mfa")
    assert res.status_code == 200 and res.json()["mfa_enabled"] is False
    # cannot lock yourself out
    assert (
        client.patch(f"/api/v1/ops/staff/{admin.pk}", {"roles": ["verifier"]}, format="json").status_code
        == 400
    )
    # deactivate
    assert (
        client.patch(f"/api/v1/ops/staff/{new.pk}", {"is_active": False}, format="json").json()["is_active"]
        is False
    )
    actions = list(AuditLog.objects.filter(object_id=str(new.pk)).values_list("action", flat=True))
    assert {"staff.create", "staff.update", "staff.mfa_reset"} <= set(actions)
    listing = client.get("/api/v1/ops/staff", {"q": "Sita"}).json()
    assert listing["count"] == 1


@pytest.mark.django_db
def test_staff_admin_requires_superadmin():
    verifier, _, _ = _staff(roles=["verifier"])
    assert auth_client(verifier).get("/api/v1/ops/staff").status_code == 403


# --- sessions ---------------------------------------------------------------------------------
@pytest.mark.django_db
def test_sessions_list_and_revoke():
    f.UserFactory(phone=PHONE)
    web = APIClient(HTTP_USER_AGENT="Mozilla/5.0 (Macintosh)")
    phone = APIClient(HTTP_USER_AGENT="okhttp/4.9 Android")
    a = _otp_login(web).json()
    b = _otp_login(phone).json()
    web.credentials(HTTP_AUTHORIZATION=f"Bearer {a['access']}")
    phone.credentials(HTTP_AUTHORIZATION=f"Bearer {b['access']}")
    rows = web.get("/api/v1/auth/sessions").json()
    assert len(rows) == 2
    current = [r for r in rows if r["current"]]
    assert len(current) == 1 and current[0]["platform"] == "web"
    other = next(r for r in rows if not r["current"])
    assert other["platform"] == "android"
    # revoke the phone session: its access token stops working immediately, refresh is blacklisted
    assert web.delete(f"/api/v1/auth/sessions/{other['id']}").status_code == 204
    assert phone.get("/api/v1/auth/me").status_code == 401
    assert APIClient().post("/api/v1/auth/token/refresh", {"refresh": b["refresh"]}).status_code == 401
    assert len(web.get("/api/v1/auth/sessions").json()) == 1


@pytest.mark.django_db
def test_refresh_rotation_updates_session_and_revoke_others():
    f.UserFactory(phone=PHONE)
    c1, c2, c3 = APIClient(), APIClient(), APIClient()
    a = _otp_login(c1).json()
    _otp_login(c2)
    _otp_login(c3)
    device = SessionDevice.objects.filter(user__phone=PHONE).order_by("created_at").first()
    old_jti = device.jti
    time.sleep(0.01)
    refreshed = APIClient().post("/api/v1/auth/token/refresh", {"refresh": a["refresh"]}).json()
    device.refresh_from_db()
    assert device.jti != old_jti
    c1.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed['access']}")
    res = c1.post("/api/v1/auth/sessions/revoke-others")
    assert res.json() == {"revoked": 2}
    rows = c1.get("/api/v1/auth/sessions").json()
    assert len(rows) == 1 and rows[0]["current"] is True


@pytest.mark.django_db
def test_logout_revokes_session():
    f.UserFactory(phone=PHONE)
    api = APIClient()
    a = _otp_login(api).json()
    assert APIClient().post("/api/v1/auth/logout", {"refresh": a["refresh"]}).status_code == 204
    assert SessionDevice.objects.get(user__phone=PHONE).revoked_at is not None
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {a['access']}")
    assert api.get("/api/v1/auth/me").status_code == 401


@pytest.mark.django_db
def test_cannot_revoke_someone_elses_session():
    f.UserFactory(phone=PHONE)
    _otp_login(APIClient())
    device = SessionDevice.objects.get(user__phone=PHONE)
    stranger = auth_client(f.UserFactory())
    assert stranger.delete(f"/api/v1/auth/sessions/{device.pk}").status_code == 404


# --- legal acceptance (PRIV-02) ---------------------------------------------------------------
@pytest.mark.django_db
def test_legal_current_pending_and_accept():
    from apps.accounts.models import LegalAcceptance, LegalDocument

    docs = APIClient().get("/api/v1/legal/current").json()
    kinds = {d["kind"]: d for d in docs}
    assert {"terms", "privacy"} <= set(kinds) and kinds["terms"]["url"] == "/terms"
    assert kinds["privacy"]["summary_ne"]
    user = f.UserFactory()
    client = auth_client(user)
    pending = client.get("/api/v1/auth/me").json()["pending_legal"]
    assert {p["kind"] for p in pending} == {"terms", "privacy"}
    bad = client.post("/api/v1/auth/legal/accept", {"document_ids": [str(user.pk)]}, format="json")
    assert bad.status_code == 400
    res = client.post(
        "/api/v1/auth/legal/accept",
        {"document_ids": [p["id"] for p in pending]},
        format="json",
        HTTP_USER_AGENT="Mozilla/5.0",
    )
    assert res.status_code == 200 and res.json()["pending_legal"] == []
    assert client.get("/api/v1/auth/me").json()["pending_legal"] == []
    acc = LegalAcceptance.objects.filter(user=user)
    assert acc.count() == 2 and acc.first().channel == "web"
    assert AuditLog.objects.filter(action="legal.accept", actor=user).count() == 2
    # a new version of the terms makes it pending again
    LegalDocument.objects.filter(kind="terms").update(is_current=False)
    LegalDocument.objects.create(kind="terms", version="2", url="/terms", is_current=True)
    assert [p["version"] for p in client.get("/api/v1/auth/me").json()["pending_legal"]] == ["2"]


@pytest.mark.django_db
def test_employer_agreement_pending_for_owners_only():
    from apps.accounts.models import LegalDocument

    LegalDocument.objects.create(
        kind="employer_agreement", version="1", url="/terms#employers", is_current=True
    )
    org = f.OrganizationFactory()
    owner = f.MembershipFactory(organization=org, role="owner").user
    hr = f.MembershipFactory(organization=org, role="hr").user
    kinds = lambda u: {p["kind"] for p in auth_client(u).get("/api/v1/auth/me").json()["pending_legal"]}  # noqa: E731
    assert "employer_agreement" in kinds(owner)
    assert "employer_agreement" not in kinds(hr)
