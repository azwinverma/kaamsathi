"""Skill Passport: lazy creation, public visibility, verified-only payload, shares, PDF."""

import datetime as dt

import pytest
from django.utils import timezone

from apps.core.bs import today_ad
from apps.credentials import services
from apps.credentials.models import Credential, Passport, PassportShare, SkillAssessment
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


@pytest.fixture
def worker(db):
    user = f.UserFactory()
    w = f.WorkerFactory(
        user=user, citizenship_no="12-01-77-01234", address="Gorkha-4", expected_monthly_wage="25000"
    )
    f.WorkerSkillFactory(worker=w, trade=f.trade("cook"), years_experience=8, nstb_level="level2")
    return w


@pytest.fixture
def client(worker):
    return auth_client(worker.user)


@pytest.fixture
def views(monkeypatch):
    calls = []
    monkeypatch.setattr(services, "log_profile_view", lambda w, **k: calls.append((w, k)))
    return calls


def cred(worker, **kw):
    data = {"kind": "nstb", "title": "Cook", "issuer": "NSTB", "level": "Level 2", "status": "verified"}
    data.update(kw)
    return Credential.objects.create(worker=worker, **data)


def test_passport_created_lazily_private_by_default(client, worker):
    body = client.get("/api/v1/me/passport").json()
    assert len(body["public_code"]) == 10 and body["public_code"].isalnum() and body["public_code"].islower()
    assert body["is_public"] is False and body["show_contact"] is False
    assert body["public_url"].endswith(f"/p/{body['public_code']}")
    assert body["payload"]["name"] == worker.full_name
    assert "contact" not in body["payload"]
    # Stable on re-read
    assert client.get("/api/v1/me/passport").json()["public_code"] == body["public_code"]


def test_public_passport_only_when_public(api, client, worker, views):
    code = client.get("/api/v1/me/passport").json()["public_code"]
    res = api.get(f"/api/v1/public/passport/{code}")
    assert res.status_code == 404
    unknown = api.get("/api/v1/public/passport/zzzzzzzzzz")
    malformed = api.get("/api/v1/public/passport/NOT-A-CODE")

    # 404s look identical whether the code exists or not (request_id differs per request, §1).
    def body(r):
        data = r.json()
        data["error"].pop("request_id", None)
        return data

    assert body(res) == body(unknown) == body(malformed)
    assert views == []

    client.patch("/api/v1/me/passport", {"is_public": True}, format="json")
    res = api.get(f"/api/v1/public/passport/{code}", HTTP_AUTHORIZATION="Bearer garbage")
    assert res.status_code == 200
    assert res["X-Robots-Tag"].startswith("noindex")
    assert res.json()["verify_url"].endswith(f"/p/{code}")
    assert views and views[0][1]["context"] == "passport"


def test_payload_is_verified_only_and_contact_hidden(api, client, worker):
    today = today_ad()
    cred(worker, title="Verified NSTB")
    cred(worker, title="Pending", status="pending")
    cred(worker, title="Rejected", status="rejected")
    cred(worker, title="Expired", status="expired")
    cred(worker, title="Lapsed", kind="license", expires_on=today - dt.timedelta(days=1))
    SkillAssessment.objects.create(
        worker=worker, trade=f.trade("cook"), assessed_on=today, result="pass", level="L2"
    )
    SkillAssessment.objects.create(worker=worker, trade=f.trade("waiter"), assessed_on=today, result="fail")
    client.patch("/api/v1/me/passport", {"is_public": True}, format="json")
    code = Passport.objects.get(worker=worker).public_code

    body = api.get(f"/api/v1/public/passport/{code}").json()
    assert [c["title"] for c in body["credentials"]] == ["Verified NSTB"]
    assert all(c["verified"] is True for c in body["credentials"])
    assert len(body["assessments"]) == 1
    assert "contact" not in body
    assert body["identity"] == {"citizenship": True, "phone": True, "address": True}
    assert body["skills"][0]["nstb_level"] == "level2"  # shown because an NSTB cert is verified
    assert body["trade_primary"]["code"] == "cook"
    assert body["availability"]["expected_monthly_wage"] == "25000.00"
    for key in ("phone", "citizenship_no", "address", "date_of_birth", "bank_account_no"):
        assert key not in body

    client.patch("/api/v1/me/passport", {"show_contact": True}, format="json")
    assert api.get(f"/api/v1/public/passport/{code}").json()["contact"] == {"phone": worker.phone}


def test_unverified_identity_and_declared_nstb_not_shown(api, worker):
    worker.verification_status = "pending"
    worker.save()
    p = services.get_passport(worker)
    p.is_public = True
    p.save()
    body = api.get(f"/api/v1/public/passport/{p.public_code}").json()
    assert body["identity"]["citizenship"] is False
    assert body["skills"][0]["nstb_level"] is None
    assert body["verification_level"] == 0


def test_work_summary(api, worker):
    today = today_ad()
    org = f.OrganizationFactory()
    emp = f.EmploymentFactory(worker=worker, organization=org, start_date=today - dt.timedelta(days=400))
    f.EmploymentFactory(
        worker=worker,
        start_date=today - dt.timedelta(days=900),
        end_date=today - dt.timedelta(days=500),
        status="ended",
        end_reason="resigned",
    )
    for i in range(12):
        f.AttendanceFactory(
            employment=emp, date=today - dt.timedelta(days=i + 1), status="present" if i < 9 else "absent"
        )
    work = services.passport_payload(worker, include_contact=False, verify_url="x")["work"]
    assert work["verified_employers"] == 2
    assert work["completed_jobs"] == 1
    assert work["total_months"] == (400 + 400) // 30
    assert work["attendance_rate"] == 0.75


def test_share_lifecycle(api, client, worker, views):
    res = client.post(
        "/api/v1/me/passport/shares",
        {"audience_label": "Hotel HR", "purpose": "job", "days": 7, "include_contact": True},
        format="json",
    )
    assert res.status_code == 201, res.content
    share = res.json()
    token = share["url"].rsplit("/", 1)[-1]
    assert "/p/s/" in share["url"] and len(token) == 32
    assert share["is_active"] is True and share["views"] == 0

    body = api.get(f"/api/v1/public/passport/s/{token}").json()
    assert body["contact"] == {"phone": worker.phone}
    assert body["share"]["audience_label"] == "Hotel HR"
    api.get(f"/api/v1/public/passport/s/{token}")
    assert PassportShare.objects.get(token=token).views == 2
    assert len(views) == 2 and views[0][1]["context"] == "passport"

    listed = client.get("/api/v1/me/passport/shares").json()
    assert listed["results"][0]["views"] == 2

    assert client.post(f"/api/v1/me/passport/shares/{share['id']}/revoke").json()["is_active"] is False
    assert api.get(f"/api/v1/public/passport/s/{token}").status_code == 404


def test_share_expiry_and_limits(api, client, worker):
    assert (
        client.post(
            "/api/v1/me/passport/shares",
            {"audience_label": "Bank", "purpose": "bank", "days": 91},
            format="json",
        ).status_code
        == 400
    )
    share = services.create_share(
        worker, audience_label="Bank", purpose="bank", days=30, include_contact=False
    )
    assert "contact" not in api.get(f"/api/v1/public/passport/s/{share.token}").json()
    PassportShare.objects.filter(pk=share.pk).update(expires_at=timezone.now() - dt.timedelta(minutes=1))
    assert api.get(f"/api/v1/public/passport/s/{share.token}").status_code == 404
    assert PassportShare.objects.get(pk=share.pk).views == 1
    assert api.get("/api/v1/public/passport/s/short").status_code == 404


def test_cannot_revoke_someone_elses_share(client):
    other = services.create_share(
        f.WorkerFactory(), audience_label="X", purpose="other", days=5, include_contact=False
    )
    assert client.post(f"/api/v1/me/passport/shares/{other.id}/revoke").status_code == 404


def test_passport_pdf(client, worker):
    cred(worker, title="Verified NSTB", issued_on=dt.date(2024, 1, 1))
    res = client.get("/api/v1/me/passport.pdf")
    assert res.status_code == 200
    assert res["Content-Type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")


def test_passport_requires_worker_login(api):
    assert api.get("/api/v1/me/passport").status_code == 401
    assert api.get("/api/v1/me/passport.pdf").status_code == 401


def test_public_qr_svg(api, worker):
    p = services.get_passport(worker)
    assert api.get(f"/api/v1/public/passport/{p.public_code}/qr.svg").status_code == 404
    p.is_public = True
    p.save()
    res = api.get(f"/api/v1/public/passport/{p.public_code}/qr.svg")
    assert res.status_code == 200 and res["Content-Type"] == "image/svg+xml"
    assert b"<svg" in res.content
    share = services.create_share(worker, audience_label="X", purpose="job", days=3, include_contact=False)
    assert api.get(f"/api/v1/public/passport/s/{share.token}/qr.svg").status_code == 200
    assert PassportShare.objects.get(pk=share.pk).views == 0
