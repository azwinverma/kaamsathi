"""OTP auth, Me, org scoping (X-Org-Id), role permissions, ops staff gate, error envelope."""

import datetime as dt
import uuid

import pytest
from django.utils import timezone

from apps.accounts.models import PhoneOTP, User
from apps.orgs.models import Membership
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

PHONE = "9841234567"


@pytest.fixture
def fixed_code(monkeypatch):
    monkeypatch.setattr("apps.accounts.otp.secrets.randbelow", lambda n: 424242)
    return "424242"


def request_otp(api, phone=PHONE):
    return api.post("/api/v1/auth/otp/request", {"phone": phone}, format="json")


def verify(api, code, phone=PHONE):
    return api.post("/api/v1/auth/otp/verify", {"phone": phone, "code": code}, format="json")


def assert_error(res, status, code):
    assert res.status_code == status, res.content
    body = res.json()
    assert set(body) == {"error"}
    # + request_id (§1); + retry_after on otp_rate_limited
    assert set(body["error"]) - {"request_id", "retry_after"} == {"code", "message", "fields"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]
    return body["error"]


# --- OTP ------------------------------------------------------------------------------


def test_otp_request_and_verify_creates_user(api, fixed_code):
    res = request_otp(api)
    assert res.status_code == 200
    assert res.json() == {"sent": True, "expires_in": 300}  # no dev_code
    otp = PhoneOTP.objects.get(phone=PHONE)
    assert otp.code_hash != fixed_code
    assert dt.timedelta(seconds=290) < otp.expires_at - timezone.now() <= dt.timedelta(seconds=300)

    res = verify(api, fixed_code)
    assert res.status_code == 200, res.json()
    body = res.json()
    assert body["access"] and body["refresh"]
    assert body["user"]["phone"] == PHONE and body["user"]["worker_id"] is None
    assert body["user"]["memberships"] == []
    assert User.objects.filter(phone=PHONE).exists()

    # code is single-use
    assert_error(verify(api, fixed_code), 400, "otp_expired")


def test_otp_phone_normalised_and_validated(api, fixed_code):
    assert request_otp(api, "+977-9841234567").status_code == 200
    assert PhoneOTP.objects.filter(phone=PHONE).exists()
    err = assert_error(request_otp(api, "9612345678"), 400, "validation_error")
    assert "phone" in err["fields"]


def test_otp_wrong_code_and_attempt_limit(api, fixed_code):
    request_otp(api)
    for _ in range(5):
        assert_error(verify(api, "000000"), 400, "otp_invalid")
    assert PhoneOTP.objects.get(phone=PHONE).attempts == 5
    # attempts exhausted: even the right code fails now
    assert_error(verify(api, fixed_code), 400, "otp_invalid")


def test_otp_expired(api, fixed_code):
    request_otp(api)
    PhoneOTP.objects.filter(phone=PHONE).update(expires_at=timezone.now() - dt.timedelta(seconds=1))
    assert_error(verify(api, fixed_code), 400, "otp_expired")


def test_otp_rate_limit_five_per_hour(api):
    for _ in range(5):
        assert request_otp(api).status_code == 200
    assert_error(request_otp(api), 429, "otp_rate_limited")
    # other phones unaffected; old requests fall out of the window
    assert request_otp(api, "9801111111").status_code == 200
    PhoneOTP.objects.filter(phone=PHONE).update(created_at=timezone.now() - dt.timedelta(hours=2))
    assert request_otp(api).status_code == 200


def test_dev_code_only_in_debug_with_setting(api, settings):
    settings.OTP_DEV_CODE = "123456"
    settings.DEBUG = False
    assert "dev_code" not in request_otp(api).json()
    assert_error(verify(api, "123456"), 400, "otp_invalid")

    settings.DEBUG = True
    res = request_otp(api)
    assert res.json()["dev_code"] == "123456"
    assert verify(api, "123456").status_code == 200

    settings.OTP_DEV_CODE = ""
    assert "dev_code" not in request_otp(api, "9801111112").json()


def test_inactive_user_cannot_login(api, fixed_code):
    f.UserFactory(phone=PHONE, is_active=False)
    request_otp(api)
    assert verify(api, fixed_code).status_code == 403


def test_refresh_and_logout(api, fixed_code):
    request_otp(api)
    tokens = verify(api, fixed_code).json()
    res = api.post("/api/v1/auth/token/refresh", {"refresh": tokens["refresh"]}, format="json")
    assert res.status_code == 200 and res.json()["access"]
    new_refresh = res.json()["refresh"]
    assert api.post("/api/v1/auth/logout", {"refresh": new_refresh}, format="json").status_code == 204
    res = api.post("/api/v1/auth/token/refresh", {"refresh": new_refresh}, format="json")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "not_authenticated"


def test_me_get_and_patch(org):
    m = f.MembershipFactory(organization=org, role="supervisor", sites=[f.SiteFactory(organization=org)])
    client = auth_client(m.user)
    me = client.get("/api/v1/auth/me").json()
    assert me["memberships"][0]["role"] == "supervisor"
    assert me["memberships"][0]["organization"]["id"] == str(org.id)
    assert len(me["memberships"][0]["site_ids"]) == 1
    res = client.patch("/api/v1/auth/me", {"preferred_language": "ne", "phone": "9800000000"}, format="json")
    assert res.json()["preferred_language"] == "ne" and res.json()["phone"] == m.user.phone


def test_unauthenticated_envelope(api):
    assert_error(api.get("/api/v1/auth/me"), 401, "not_authenticated")
    assert_error(api.get("/api/v1/org"), 401, "not_authenticated")


# --- org scoping ------------------------------------------------------------------------


def test_missing_or_invalid_org_header(owner):
    client = auth_client(owner)
    assert_error(client.get("/api/v1/org"), 403, "org_forbidden")
    client.credentials(HTTP_AUTHORIZATION=client._credentials["HTTP_AUTHORIZATION"], HTTP_X_ORG_ID="nope")
    assert_error(client.get("/api/v1/org"), 403, "org_forbidden")
    client.credentials(
        HTTP_AUTHORIZATION=client._credentials["HTTP_AUTHORIZATION"], HTTP_X_ORG_ID=str(uuid.uuid4())
    )
    assert_error(client.get("/api/v1/org"), 403, "org_forbidden")


def test_other_org_and_inactive_membership_forbidden(owner, org):
    other = f.OrganizationFactory()
    assert_error(auth_client(owner, other).get("/api/v1/org"), 403, "org_forbidden")
    assert auth_client(owner, org).get("/api/v1/org").status_code == 200
    Membership.objects.filter(user=owner).update(is_active=False)
    assert_error(auth_client(owner, org).get("/api/v1/org"), 403, "org_forbidden")


def test_org_data_is_scoped(owner_client, org):
    f.EmploymentFactory(organization=org)
    other_emp = f.EmploymentFactory()
    assert owner_client.get("/api/v1/org/employments").json()["count"] == 1
    assert_error(owner_client.get(f"/api/v1/org/employments/{other_emp.id}"), 404, "not_found")


def test_create_org_makes_caller_owner(db):
    user = f.UserFactory()
    client = auth_client(user)
    res = client.post(
        "/api/v1/orgs",
        {
            "name": "Shivam Builders",
            "industry": "construction",
            "district": "makwanpur",
            "address": "Hetauda",
            "phone": "057000000",
        },
        format="json",
    )
    assert res.status_code == 201, res.json()
    assert Membership.objects.get(user=user).role == "owner"
    assert client.get("/api/v1/orgs").json()["count"] == 1


# --- roles -------------------------------------------------------------------------------


@pytest.mark.parametrize("role,status", [("owner", 201), ("admin", 201), ("hr", 403), ("supervisor", 403)])
def test_members_create_owner_admin_only(make_member, role, status):
    _, client = make_member(role)
    res = client.post(
        "/api/v1/org/members", {"phone": "9812345678", "full_name": "New", "role": "hr"}, format="json"
    )
    assert res.status_code == status, res.json()


@pytest.mark.parametrize("role,status", [("owner", 200), ("admin", 200), ("hr", 200), ("supervisor", 403)])
def test_members_list(make_member, role, status):
    _, client = make_member(role)
    assert client.get("/api/v1/org/members").status_code == status


@pytest.mark.parametrize("role,status", [("owner", 200), ("admin", 200), ("hr", 403), ("supervisor", 403)])
def test_billing_owner_admin_only(make_member, role, status):
    _, client = make_member(role)
    assert client.get("/api/v1/org/billing/summary").status_code == status
    assert client.get("/api/v1/org/billing/charges").status_code == status


def test_billing_summary_minimum(owner_client, org):
    f.EmploymentFactory(organization=org)
    body = owner_client.get("/api/v1/org/billing/summary").json()
    assert body["active_workers"] == 1 and body["monthly_estimate"] == "3000.00"
    for _ in range(24):
        f.EmploymentFactory(organization=org)
    assert owner_client.get("/api/v1/org/billing/summary").json()["monthly_estimate"] == "3750.00"


def test_cannot_remove_last_owner(owner_client, owner, org):
    m = Membership.objects.get(user=owner, organization=org)
    res = owner_client.delete(f"/api/v1/org/members/{m.id}")
    assert_error(res, 400, "invalid_state")


def test_org_patch_owner_admin_only(make_member):
    _, hr = make_member("hr")
    assert_error(hr.patch("/api/v1/org", {"name": "X"}, format="json"), 403, "permission_denied")
    _, admin = make_member("admin")
    assert admin.patch("/api/v1/org", {"name": "X"}, format="json").json()["name"] == "X"


def test_supervisor_limited_to_own_sites(org, make_member):
    site_a, site_b = f.SiteFactory(organization=org), f.SiteFactory(organization=org)
    emp_a = f.EmploymentFactory(organization=org, site=site_a)
    emp_b = f.EmploymentFactory(organization=org, site=site_b)
    _, sup = make_member("supervisor", sites=[site_a])

    ids = [r["id"] for r in sup.get("/api/v1/org/employments").json()["results"]]
    assert ids == [str(emp_a.id)]
    assert sup.get(f"/api/v1/org/employments/{emp_b.id}").status_code == 404
    # read-only on employments, no hiring, no payroll, no onboarding
    assert_error(
        sup.patch(f"/api/v1/org/employments/{emp_a.id}", {"designation": "x"}, format="json"),
        403,
        "permission_denied",
    )
    assert sup.get("/api/v1/org/jobs").status_code == 403
    assert sup.get("/api/v1/org/applications").status_code == 403
    assert sup.post("/api/v1/org/employments", {}, format="json").status_code == 403
    # sites list restricted
    assert [s["id"] for s in sup.get("/api/v1/org/sites").json()["results"]] == [str(site_a.id)]
    # attendance day view only shows own sites
    rows = sup.get("/api/v1/org/attendance/day", {"date": "2026-08-03"}).json()["rows"]
    assert [r["employment_id"] for r in rows] == [str(emp_a.id)]


def test_supervisor_leave_only_for_own_sites(org, make_member):
    site_a, site_b = f.SiteFactory(organization=org), f.SiteFactory(organization=org)
    emp_a = f.EmploymentFactory(organization=org, site=site_a)
    emp_b = f.EmploymentFactory(organization=org, site=site_b)
    _, sup = make_member("supervisor", sites=[site_a])
    payload = {"leave_type": "sick", "from_date": "2026-08-03", "to_date": "2026-08-04"}
    res = sup.post("/api/v1/org/leaves", {**payload, "employment_id": str(emp_a.id)}, format="json")
    assert res.status_code == 201 and res.json()["days"] == 2
    res = sup.post("/api/v1/org/leaves", {**payload, "employment_id": str(emp_b.id)}, format="json")
    assert res.status_code == 403
    f.LeaveFactory(employment=emp_b)
    assert sup.get("/api/v1/org/leaves").json()["count"] == 1


# --- ops ---------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path", ["/api/v1/ops/dashboard", "/api/v1/ops/workers", "/api/v1/ops/jobs", "/api/v1/ops/organizations"]
)
def test_ops_requires_staff(owner, staff_client, path):
    assert_error(auth_client(owner).get(path), 403, "permission_denied")
    assert staff_client.get(path).status_code == 200


def test_ops_unauthenticated(api):
    assert_error(api.get("/api/v1/ops/dashboard"), 401, "not_authenticated")


def test_ops_verify_worker(staff_client):
    from django.core.files.base import ContentFile

    w = f.WorkerFactory(verification_status="pending", citizenship_no="12-34-56")
    w.id_front.save("front.jpg", ContentFile(b"img"), save=True)
    res = staff_client.post(
        f"/api/v1/ops/workers/{w.id}/verify", {"status": "verified", "note": "ok"}, format="json"
    )
    assert res.status_code == 200
    w.refresh_from_db()
    assert w.verification_status == "verified" and w.verified_at is not None


def test_ops_verify_requires_id_number_and_document(staff_client):
    w = f.WorkerFactory(verification_status="pending")
    res = staff_client.post(f"/api/v1/ops/workers/{w.id}/verify", {"status": "verified"}, format="json")
    assert res.status_code == 400
    assert {"citizenship_no", "id_front"} <= set(res.json()["error"]["fields"])
    # Rejecting needs no documents.
    res = staff_client.post(
        f"/api/v1/ops/workers/{w.id}/verify", {"status": "rejected", "note": "no ID"}, format="json"
    )
    assert res.status_code == 200


def test_ops_verify_blocked_by_open_duplicate_identity_flag(staff_client):
    from django.core.files.base import ContentFile

    from apps.risk.models import FraudFlag

    w = f.WorkerFactory(verification_status="pending", citizenship_no="77-1")
    w.id_front.save("front.jpg", ContentFile(b"img"), save=True)
    FraudFlag.objects.create(
        subject_type="worker", subject_id=str(w.pk), kind="duplicate_identity", severity="high", status="open"
    )
    res = staff_client.post(f"/api/v1/ops/workers/{w.id}/verify", {"status": "verified"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"


# --- envelope -------------------------------------------------------------------------------------


def test_not_found_envelope(api):
    res = api.get("/api/v1/does-not-exist")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_validation_envelope_fields(owner_client):
    err = assert_error(owner_client.post("/api/v1/org/jobs", {}, format="json"), 400, "validation_error")
    assert {"title", "trade", "wage_amount"} <= set(err["fields"])
    assert all(isinstance(v, list) for v in err["fields"].values())


# --------------------------------------------------------------------------- OTP_SHOW_CODE (test sites)
def test_otp_code_hidden_by_default(api):
    res = api.post("/api/v1/auth/otp/request", {"phone": "9800000555"}, format="json")
    assert res.status_code == 200 and "dev_code" not in res.json()


def test_otp_show_code_returns_the_real_code(api, settings):
    from django.core import checks

    settings.OTP_SHOW_CODE = True
    res = api.post("/api/v1/auth/otp/request", {"phone": "9800000556"}, format="json")
    code = res.json()["dev_code"]
    assert len(code) == 6 and code.isdigit()
    ok = api.post("/api/v1/auth/otp/verify", {"phone": "9800000556", "code": code}, format="json")
    assert ok.status_code == 200 and ok.json()["access"]
    assert any(m.id == "kaamsathi.W001" for m in checks.run_checks(include_deployment_checks=True))
