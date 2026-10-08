"""Employer verification (KYB) — docs/CONTRACT-EXTENSIONS.md §2."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from apps.audit.models import AuditLog
from apps.hiring.models import Application
from apps.orgs.models import Organization
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


def pdf(name="doc.pdf"):
    return SimpleUploadedFile(name, PDF, content_type="application/pdf")


@pytest.fixture
def unverified_org(org):
    org.verification_status = "unverified"
    org.save(update_fields=["verification_status"])
    return org


def submit(client, **extra):
    data = {"registration_no": "61234/076/077", "registration_doc": pdf("reg.pdf"), "pan_doc": pdf("pan.pdf")}
    data.update(extra)
    return client.post("/api/v1/org/verification", data, format="multipart")


def test_owner_submits_documents_status_pending(owner_client, unverified_org):
    res = owner_client.get("/api/v1/org/verification")
    assert res.status_code == 200
    assert res.json()["verification_status"] == "unverified"

    res = submit(owner_client, pan_no="301234567")
    assert res.status_code == 201, res.content
    body = res.json()
    assert body["verification_status"] == "pending"
    assert body["has_registration_doc"] and body["has_pan_doc"]
    assert "/files/" in body["registration_doc_url"]
    assert body["pan_no"] is None and body["pan_no_masked"].endswith("567")
    unverified_org.refresh_from_db()
    assert unverified_org.registration_no == "61234/076/077"
    assert unverified_org.pan_no == "301234567"
    assert AuditLog.objects.filter(action="organization.kyb_submit").exists()


def test_submit_requires_documents(owner_client, unverified_org):
    res = owner_client.post("/api/v1/org/verification", {"registration_no": "1"}, format="multipart")
    assert res.status_code == 400
    assert set(res.json()["error"]["fields"]) == {"registration_doc", "pan_doc"}


def test_resubmit_after_rejection_keeps_existing_docs(owner_client, unverified_org):
    submit(owner_client)
    Organization.objects.filter(pk=unverified_org.pk).update(verification_status="rejected")
    res = owner_client.post("/api/v1/org/verification", {"registration_no": "99/080"}, format="multipart")
    assert res.status_code == 201, res.content
    assert res.json()["verification_status"] == "pending"


def test_cannot_resubmit_when_verified(owner_client, org):
    assert org.verification_status == "verified"
    res = submit(owner_client)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_state"


@pytest.mark.parametrize("role", ["hr", "supervisor"])
def test_only_owner_admin_manage_verification(make_member, role):
    _user, client = make_member(role)
    assert client.get("/api/v1/org/verification").status_code == 403


def test_organization_payload_exposes_verification_status(owner_client, org):
    data = owner_client.get("/api/v1/org").json()
    assert data["verification_status"] == "verified"
    assert data["verification_status_label"]


def test_ops_queue_and_verify(staff_client, owner_client, unverified_org):
    submit(owner_client)
    res = staff_client.get("/api/v1/ops/employers", {"verification_status": "pending"})
    assert res.status_code == 200
    rows = res.json()["results"]
    assert [r["id"] for r in rows] == [str(unverified_org.id)]
    assert rows[0]["registration_doc_url"] and rows[0]["pan_doc_url"]
    assert rows[0]["owner"] is not None

    # reject needs a note
    res = staff_client.post(
        f"/api/v1/ops/employers/{unverified_org.id}/verify", {"status": "rejected"}, format="json"
    )
    assert res.status_code == 400
    res = staff_client.post(
        f"/api/v1/ops/employers/{unverified_org.id}/verify",
        {"status": "verified", "note": "Checked with OCR"},
        format="json",
    )
    assert res.status_code == 200
    assert res.json()["verification_status"] == "verified"
    assert res.json()["verified_by"] is not None
    assert AuditLog.objects.filter(action="ops.employer.verify", object_id=str(unverified_org.id)).exists()


def test_ops_employers_requires_staff(owner_client):
    assert owner_client.get("/api/v1/ops/employers").status_code == 403


def test_signed_doc_url_downloads_for_owner_only(owner_client, unverified_org, api):
    url = submit(owner_client).json()["registration_doc_url"]
    path = url[url.index("/api/v1/") :]
    assert api.get(path).status_code == 200  # token carries the issuing owner
    # another org's owner cannot obtain a URL at all
    other = f.MembershipFactory(role="owner")
    other_client = auth_client(other.user, other.organization)
    assert other_client.get("/api/v1/org/verification").json()["registration_doc_url"] is None


def test_shortlist_blocked_for_unverified_employer(staff_client, unverified_org):
    job = f.JobFactory(organization=unverified_org)
    w = f.WorkerFactory()
    res = staff_client.post(
        f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(w.id)]}, format="json"
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_state"
    assert "not verified" in res.json()["error"]["message"]
    assert not Application.objects.filter(job=job).exists()


@override_settings(KYB_REQUIRED_FOR_SHORTLIST=False)
def test_shortlist_gate_can_be_disabled(staff_client, unverified_org):
    job = f.JobFactory(organization=unverified_org)
    w = f.WorkerFactory()
    res = staff_client.post(
        f"/api/v1/ops/jobs/{job.id}/shortlist", {"worker_ids": [str(w.id)]}, format="json"
    )
    assert res.status_code == 201


def test_ops_jobs_and_worker_employments_show_employer_verified(staff_client, org):
    job = f.JobFactory(organization=org)
    data = staff_client.get(f"/api/v1/ops/jobs/{job.id}").json()
    assert data["employer_verified"] is True

    worker = f.WorkerFactory()
    worker.user = f.UserFactory(phone=worker.phone)
    worker.save(update_fields=["user"])
    f.EmploymentFactory(organization=org, worker=worker)
    rows = auth_client(worker.user).get("/api/v1/me/employments").json()["results"]
    assert rows[0]["employer_verified"] is True
