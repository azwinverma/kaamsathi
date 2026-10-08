"""Foreign-employment document wallet: encryption, worker CRUD, agency eligibility, shares,
partner mobility read (masked), ops verification + audit, agency compliance, expiry task."""

import datetime as dt

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.core.crypto import blind_index
from apps.core.files import read_token, recheck
from apps.mobility import tasks as mobility_tasks
from apps.mobility.models import ClearanceDocument, TravelDocument
from apps.partners.models import ConsentGrant, Partner, PartnerAccessLog
from apps.partners.services import create_api_key, create_grant
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

TODAY = timezone.localdate()


def pdf(name="passport.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4\n% demo\n%%EOF\n", content_type="application/pdf")


def make_agency(name="Licensed Agency (test)", status="verified", valid_days=200, **kw):
    return Partner.objects.create(
        name=name,
        kind="recruitment_agency",
        regulator="dofe",
        license_no=kw.pop("license_no", "DOFE-TEST-1"),
        compliance_status=status,
        license_valid_until=TODAY + dt.timedelta(days=valid_days) if valid_days is not None else None,
        **kw,
    )


@pytest.fixture
def worker_user():
    user = f.UserFactory()
    worker = f.WorkerFactory(user=user, phone=user.phone)
    return user, worker


@pytest.fixture
def worker_client(worker_user):
    return auth_client(worker_user[0])


def make_staff(roles=("verifier", "partner_manager")):
    user = f.UserFactory(is_staff=True)
    try:  # staff roles (security area); without a profile only DEBUG grants superadmin
        from apps.accounts.models import StaffProfile

        StaffProfile.objects.create(user=user, roles=list(roles))
    except ImportError:
        pass
    return user


@pytest.fixture
def staff_user():
    return make_staff()


def add_passport(worker, number="PA1234567", status="pending", expires_days=1000, **kw):
    doc = TravelDocument(
        worker=worker,
        kind="passport",
        number=number,
        expires_on=TODAY + dt.timedelta(days=expires_days),
        status=status,
        **kw,
    )
    doc.document.save("p.pdf", pdf(), save=False)
    doc.save()
    return doc


def partner_client(full_key):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Partner {full_key}")
    return c


# ----------------------------------------------------------------------------- worker CRUD
def test_create_travel_document_encrypts_number_and_masks_response(worker_client, worker_user):
    _, worker = worker_user
    r = worker_client.post(
        "/api/v1/me/mobility/documents",
        {
            "kind_group": "travel",
            "kind": "passport",
            "number": "pa 1234567",
            "issued_on": "2020-01-01",
            "expires_on": (TODAY + dt.timedelta(days=900)).isoformat(),
            "document": pdf(),
        },
        format="multipart",
    )
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["status"] == "pending"
    assert body["number_masked"].endswith("567") and "PA1234" not in body["number_masked"]
    assert "number" not in body
    assert body["document_url"] and body["document_type"] == "pdf"
    assert body["safety_guidance"]["dofe_url"].startswith("https://")
    assert body["safety_guidance"]["en"] and body["safety_guidance"]["ne"]

    doc = TravelDocument.objects.get(pk=body["id"])
    assert doc.number == "PA1234567"
    with connection.cursor() as cur:
        cur.execute("SELECT number, number_hash FROM mobility_traveldocument WHERE id = %s", [doc.pk])
        raw, raw_hash = cur.fetchone()
    assert raw.startswith("enc1:") and "1234567" not in raw
    assert raw_hash == blind_index("PA1234567", "travel:passport")


def test_clearance_document_reference_encrypted(worker_client):
    r = worker_client.post(
        "/api/v1/me/mobility/documents",
        {
            "kind_group": "clearance",
            "kind": "medical_fitness",
            "issuer": "Test Clinic",
            "reference_no": "MED-998877",
            "document": pdf("med.pdf"),
        },
        format="multipart",
    )
    assert r.status_code == 201, r.content
    assert r.json()["title"] == "Medical fitness"
    doc = ClearanceDocument.objects.get(pk=r.json()["id"])
    with connection.cursor() as cur:
        cur.execute("SELECT reference_no FROM mobility_clearancedocument WHERE id = %s", [doc.pk])
        assert cur.fetchone()[0].startswith("enc1:")


def test_create_validation(worker_client):
    r = worker_client.post(
        "/api/v1/me/mobility/documents",
        {"kind_group": "travel", "kind": "medical_fitness", "number": "X1", "document": pdf()},
        format="multipart",
    )
    assert r.status_code == 400 and "kind" in r.json()["error"]["fields"]
    r = worker_client.post(
        "/api/v1/me/mobility/documents", {"kind_group": "travel", "kind": "passport"}, format="multipart"
    )
    assert r.status_code == 400
    assert {"number", "document"} <= set(r.json()["error"]["fields"])
    bad = SimpleUploadedFile("x.exe", b"MZ", content_type="application/octet-stream")
    r = worker_client.post(
        "/api/v1/me/mobility/documents",
        {"kind_group": "travel", "kind": "passport", "number": "PA1", "document": bad},
        format="multipart",
    )
    assert r.status_code == 400


def test_list_edit_delete(worker_client, worker_user):
    _, worker = worker_user
    doc = add_passport(worker)
    other = add_passport(f.WorkerFactory(), number="PB000")
    r = worker_client.get("/api/v1/me/mobility/documents")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 1 and data["results"][0]["id"] == str(doc.id)
    assert "safety_guidance" in data
    assert worker_client.get(f"/api/v1/me/mobility/documents/{other.id}").status_code == 404

    r = worker_client.patch(
        f"/api/v1/me/mobility/documents/{doc.id}", {"number": "PA7654321"}, format="multipart"
    )
    assert r.status_code == 200, r.content
    doc.refresh_from_db()
    assert doc.number == "PA7654321" and doc.number_hash == blind_index("PA7654321", "travel:passport")

    doc.status = "verified"
    doc.save()
    r = worker_client.patch(f"/api/v1/me/mobility/documents/{doc.id}", {"number": "X"}, format="multipart")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"

    assert worker_client.delete(f"/api/v1/me/mobility/documents/{doc.id}").status_code == 204
    assert not TravelDocument.objects.filter(pk=doc.pk).exists()


def test_signed_document_url_owner_and_staff_only(worker_user, staff_user):
    _, worker = worker_user
    doc = add_passport(worker)
    from apps.mobility.services import document_dict

    class Req:
        user = worker_user[0]

        def build_absolute_uri(self, p):
            return p

    url = document_dict(doc, Req())["document_url"]
    token = url.rstrip("/").split("/")[-1]
    payload = read_token(token)
    assert payload["c"] == f"mobility:travel:{doc.pk}"
    assert recheck(payload, worker_user[0]) is True
    assert recheck(payload, staff_user) is True
    assert recheck(payload, f.UserFactory()) is False


# ----------------------------------------------------------------------------- agencies + shares
def test_agencies_lists_only_eligible(worker_client):
    ok = make_agency("Good Agency")
    make_agency("Unverified Agency", status="unverified")
    make_agency("Suspended Agency", status="suspended")
    make_agency("Expired Agency", valid_days=-1)
    make_agency("Inactive Agency", is_active=False)
    Partner.objects.create(name="A Bank", kind="bank", compliance_status="verified",
                           license_valid_until=TODAY + dt.timedelta(days=10))  # fmt: skip
    r = worker_client.get("/api/v1/me/mobility/agencies")
    assert r.status_code == 200
    names = [a["name"] for a in r.json()["results"]]
    assert names == ["Good Agency"]
    item = r.json()["results"][0]
    assert item["license_no"] == "DOFE-TEST-1"
    assert item["license_valid_until"] == ok.license_valid_until.isoformat()
    assert "safety_guidance" in r.json()


def test_share_with_eligible_agency_creates_recruitment_grant(worker_client, worker_user):
    _, worker = worker_user
    agency = make_agency()
    r = worker_client.post("/api/v1/me/mobility/shares", {"partner_id": str(agency.id), "days": 30})
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["purpose"] == "recruitment"
    assert set(body["scopes"]) == {"passport.read", "mobility.read"}
    assert "safety_guidance" in body
    grant = ConsentGrant.objects.get(pk=body["id"])
    assert grant.worker == worker and grant.partner == agency
    assert (grant.expires_at - grant.granted_at).days == 30
    assert AuditLog.objects.filter(action="mobility.share.create").exists()

    r = worker_client.get("/api/v1/me/mobility/shares")
    assert r.json()["count"] == 1
    # revoke via the existing grants endpoint
    r = worker_client.post(f"/api/v1/me/grants/{grant.id}/revoke")
    assert r.status_code == 200 and r.json()["status"] == "revoked"


@pytest.mark.parametrize(
    "kw",
    [
        {"status": "unverified"},
        {"status": "suspended"},
        {"valid_days": -1},
        {"valid_days": None},
        {"is_active": False},
    ],
)
def test_share_refused_for_ineligible_agency(worker_client, kw):
    agency = make_agency(**kw)
    r = worker_client.post("/api/v1/me/mobility/shares", {"partner_id": str(agency.id), "days": 30})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_state"
    assert not ConsentGrant.objects.filter(partner=agency).exists()


def test_share_days_capped_and_non_agency_refused(worker_client):
    agency = make_agency()
    r = worker_client.post("/api/v1/me/mobility/shares", {"partner_id": str(agency.id), "days": 91})
    assert r.status_code == 400
    bank = Partner.objects.create(name="Bank", kind="bank")
    r = worker_client.post("/api/v1/me/mobility/shares", {"partner_id": str(bank.id), "days": 10})
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"


def test_generic_grant_endpoint_enforces_agency_eligibility(worker_client):
    bad = make_agency(status="unverified")
    r = worker_client.post(
        "/api/v1/me/grants",
        {"partner_id": str(bad.id), "purpose": "recruitment", "scopes": ["passport.read"], "days": 10},
        format="json",
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"
    bank = Partner.objects.create(name="Bank", kind="bank")
    r = worker_client.post(
        "/api/v1/me/grants",
        {"partner_id": str(bank.id), "purpose": "loan_assessment", "scopes": ["mobility.read"], "days": 10},
        format="json",
    )
    assert r.status_code == 400


# ----------------------------------------------------------------------------- partner API
def test_partner_mobility_read_masked(worker_user):
    _, worker = worker_user
    agency = make_agency()
    add_passport(worker, number="PA5550001", status="verified", expires_days=400)
    add_passport(worker, number="PA0000000", status="rejected")
    _key, full = create_api_key(agency, ["mobility.read", "passport.read"])
    client = partner_client(full)
    url = f"/api/v1/partner/workers/{worker.id}/mobility"

    assert client.get(url).status_code == 403  # no grant yet
    create_grant(worker, agency, purpose="recruitment", scopes=["mobility.read", "passport.read"], days=30)
    r = client.get(url)
    assert r.status_code == 200, r.content
    data = r.json()
    raw = r.content.decode()
    assert "PA5550001" not in raw and "document_url" not in raw and "/files/" not in raw
    assert len(data["documents"]) == 1  # rejected omitted
    item = data["documents"][0]
    assert item["number_masked"].endswith("001") and item["verified"] is True and item["valid"] is True
    assert data["flags"]["passport_valid"] is True and data["flags"]["medical_fitness_valid"] is False
    assert PartnerAccessLog.objects.filter(partner=agency, worker=worker, scope="mobility.read").count() == 2
    assert AuditLog.objects.filter(action="partner.mobility.read", object_id=str(worker.pk)).exists()

    # Suspension cuts access immediately, even with a live grant.
    agency.compliance_status = "suspended"
    agency.save()
    assert client.get(url).status_code == 403


def test_partner_mobility_requires_scope(worker_user):
    _, worker = worker_user
    agency = make_agency()
    create_grant(worker, agency, purpose="recruitment", scopes=["mobility.read", "passport.read"], days=30)
    _key, full = create_api_key(agency, ["passport.read"])
    r = partner_client(full).get(f"/api/v1/partner/workers/{worker.id}/mobility")
    assert r.status_code == 403


# ----------------------------------------------------------------------------- ops
def test_ops_queue_verify_and_audit(staff_user, worker_user):
    _, worker = worker_user
    doc = add_passport(worker)
    client = auth_client(staff_user)
    r = client.get("/api/v1/ops/mobility/documents?status=pending")
    assert r.status_code == 200
    row = r.json()["results"][0]
    assert row["id"] == str(doc.id) and row["number"] == "PA1234567"
    assert row["worker"]["id"] == str(worker.id) and row["document_url"]

    r = client.post(f"/api/v1/ops/mobility/documents/{doc.id}/verify", {"status": "rejected"})
    assert r.status_code == 400  # note required for rejection
    r = client.post(f"/api/v1/ops/mobility/documents/{doc.id}/verify", {"status": "verified", "note": "ok"})
    assert r.status_code == 200, r.content
    doc.refresh_from_db()
    assert doc.status == "verified" and doc.verified_by == staff_user and doc.verified_at
    entry = AuditLog.objects.get(action="ops.mobility.document.verify")
    assert entry.actor == staff_user and entry.object_id == str(doc.pk)
    assert entry.changes["status"] == {"from": "pending", "to": "verified"}


def test_ops_cannot_verify_expired_and_non_staff_forbidden(staff_user, worker_user, worker_client):
    _, worker = worker_user
    doc = add_passport(worker, expires_days=-2)
    r = auth_client(staff_user).post(
        f"/api/v1/ops/mobility/documents/{doc.id}/verify", {"status": "verified"}
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_state"
    assert worker_client.get("/api/v1/ops/mobility/documents").status_code == 403
    assert worker_client.get("/api/v1/ops/mobility/agencies").status_code == 403


def test_ops_duplicate_number_flagged(staff_user):
    a = add_passport(f.WorkerFactory(), number="PZ999")
    add_passport(f.WorkerFactory(), number="pz 999")
    r = auth_client(staff_user).get("/api/v1/ops/mobility/documents")
    rows = {x["id"]: x for x in r.json()["results"]}
    assert rows[str(a.id)]["duplicate_number"] is True


def test_ops_agency_compliance(staff_user):
    agency = make_agency(status="unverified", valid_days=None)
    client = auth_client(staff_user)
    url = f"/api/v1/ops/mobility/agencies/{agency.id}/compliance"
    r = client.post(url, {"status": "verified"})
    assert r.status_code == 400  # needs a valid licence date
    past = (TODAY - dt.timedelta(days=1)).isoformat()
    assert client.post(url, {"status": "verified", "license_valid_until": past}).status_code == 400
    until = (TODAY + dt.timedelta(days=365)).isoformat()
    r = client.post(url, {"status": "verified", "license_valid_until": until, "note": "Checked on DoFE"})
    assert r.status_code == 200, r.content
    assert r.json()["eligible"] is True and r.json()["license_valid"] is True
    agency.refresh_from_db()
    assert agency.compliance_status == "verified" and agency.compliance_verified_by == staff_user
    assert AuditLog.objects.filter(action="ops.mobility.agency.compliance", object_id=str(agency.pk)).exists()

    assert client.post(url, {"status": "suspended"}).status_code == 400  # note required
    r = client.post(url, {"status": "suspended", "note": "Complaint under investigation"})
    assert r.status_code == 200 and r.json()["eligible"] is False

    r = client.get("/api/v1/ops/mobility/agencies")
    assert r.status_code == 200 and r.json()["results"][0]["compliance_status"] == "suspended"

    bank = Partner.objects.create(name="Bank", kind="bank")
    r = client.post(
        f"/api/v1/ops/mobility/agencies/{bank.id}/compliance",
        {"status": "verified", "license_valid_until": until},
    )
    assert r.status_code == 400


def test_ops_partner_serializer_compliance_read_only(staff_user):
    agency = make_agency(status="unverified")
    r = auth_client(staff_user).patch(
        f"/api/v1/ops/partners/{agency.id}", {"compliance_status": "verified"}, format="json"
    )
    assert r.status_code == 200
    agency.refresh_from_db()
    assert agency.compliance_status == "unverified"


# ----------------------------------------------------------------------------- expiry task
def test_expiry_reminders(monkeypatch, worker_user):
    _, worker = worker_user
    calls = []
    monkeypatch.setattr(mobility_tasks, "notify_worker", lambda w, **kw: calls.append((w, kw)))
    expired = add_passport(worker, number="P-OLD", status="verified", expires_days=-1)
    soon = add_passport(f.WorkerFactory(), number="P-SOON", status="verified", expires_days=30)
    add_passport(f.WorkerFactory(), number="P-LATER", status="verified", expires_days=31)
    med = ClearanceDocument.objects.create(
        worker=worker, kind="medical_fitness", title="Medical", issuer="Clinic",
        status="verified", expires_on=TODAY + dt.timedelta(days=7),
    )  # fmt: skip
    ClearanceDocument.objects.create(
        worker=worker, kind="language_test", title="Lang", issuer="X",
        status="verified", expires_on=TODAY + dt.timedelta(days=7),
    )  # fmt: skip
    result = mobility_tasks.expiry_reminders()
    assert result == {"expired": 1, "reminded": 2}
    expired.refresh_from_db()
    assert expired.status == "expired"
    kinds = sorted(kw["data"]["kind"] for _w, kw in calls)
    assert kinds == ["medical_fitness", "passport"]
    by_kind = {kw["data"]["kind"]: (w, kw) for w, kw in calls}
    assert by_kind["passport"][0] == soon.worker and by_kind["passport"][1]["data"]["days"] == 30
    assert by_kind["medical_fitness"][0] == med.worker and "७" in by_kind["medical_fitness"][1]["body_ne"]


def test_notify_worker_falls_back_to_sms(monkeypatch):
    sent = []
    import apps.notifications.services as ns

    monkeypatch.setattr(
        ns, "send_sms", lambda phone, body, kind="generic", **kw: sent.append((phone, body, kind))
    )
    if hasattr(ns, "notify"):
        monkeypatch.delattr(ns, "notify")
    worker = f.WorkerFactory()  # no login → SMS
    mobility_tasks.notify_worker(
        worker, kind="mobility_expiry", title_en="t", title_ne="त", body_en="hello", body_ne="नमस्ते"
    )
    assert sent == [(worker.phone, "नमस्ते", "mobility_expiry")]


def test_demo_seed_idempotent(worker_user):
    import io
    import random

    from apps.mobility import demo

    f.UserFactory(is_staff=True)
    buf = io.StringIO()
    demo.seed(buf, random.Random(1))
    demo.seed(buf, random.Random(1))
    agency = Partner.objects.get(name=demo.AGENCY_NAME)
    assert agency.is_eligible_agency()
    assert (
        TravelDocument.objects.filter(number_hash=blind_index("DEMO0000101", "travel:passport")).count() == 1
    )
