"""Employer→worker rating API (N003), comment moderation + voiding (N004), dispute evidence (N006),
dispute appeals (N008) and credential resubmission (G012)."""

import datetime as dt
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from apps.audit.models import AuditLog
from apps.trust.models import Dispute, DisputeEvidence
from apps.trust.services import employer_reputation, recompute_trust
from apps.workers.models import Rating
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def png(name="e.png"):
    out = io.BytesIO()
    Image.new("RGB", (8, 8)).save(out, format="PNG")
    return SimpleUploadedFile(name, out.getvalue(), content_type="image/png")


@pytest.fixture
def worker_user():
    user = f.UserFactory()
    return user, f.WorkerFactory(user=user, phone=user.phone)


# --------------------------------------------------------------------------- N003
def test_employer_rates_worker(owner_client, org, worker_user):
    _, w = worker_user
    emp = f.EmploymentFactory(organization=org, worker=w)
    r = owner_client.post(
        f"/api/v1/org/employments/{emp.id}/rate",
        {"score_a": 4, "score_b": 5, "comment": "Reliable"},
        format="json",
    )
    assert r.status_code == 201, r.json()
    assert r.json()["rater"] == "employer" and r.json()["score_b"] == 5
    assert AuditLog.objects.filter(action="employment.rate").exists()
    # once per employment
    r = owner_client.post(
        f"/api/v1/org/employments/{emp.id}/rate", {"score_a": 3, "score_b": 3}, format="json"
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "duplicate"
    # feeds reliability (employer feedback component)
    trust = recompute_trust(w)
    assert trust.breakdown["employer_feedback"] == pytest.approx(0.9)


@pytest.mark.parametrize(
    "payload", [{"score_a": 0, "score_b": 3}, {"score_a": 6, "score_b": 3}, {"score_a": 3}]
)
def test_employer_rate_validation(owner_client, org, payload):
    emp = f.EmploymentFactory(organization=org)
    assert (
        owner_client.post(f"/api/v1/org/employments/{emp.id}/rate", payload, format="json").status_code == 400
    )


def test_employer_rate_permissions(org, make_member):
    emp = f.EmploymentFactory(organization=org)
    _, sup = make_member("supervisor")
    assert sup.post(f"/api/v1/org/employments/{emp.id}/rate", {"score_a": 3, "score_b": 3}).status_code == 403
    other = f.MembershipFactory(role="owner")
    client = auth_client(other.user, other.organization)
    assert (
        client.post(f"/api/v1/org/employments/{emp.id}/rate", {"score_a": 3, "score_b": 3}).status_code == 404
    )
    from rest_framework.test import APIClient

    assert APIClient().post(f"/api/v1/org/employments/{emp.id}/rate", {}).status_code == 401


# --------------------------------------------------------------------------- N004
def test_worker_flags_employer_comment_and_ops_hides(org, worker_user, staff_client):
    user, w = worker_user
    emp = f.EmploymentFactory(organization=org, worker=w)
    rating = Rating.objects.create(
        employment=emp, rater="employer", score_a=2, score_b=2, comment="Lazy liar"
    )
    client = auth_client(user)
    mine = client.get("/api/v1/me/ratings").json()
    assert mine["received"][0]["comment"] == "Lazy liar" and mine["received"][0]["can_flag"]
    r = client.post(f"/api/v1/me/ratings/{rating.id}/flag", {"reason": "Untrue and insulting"}, format="json")
    assert r.status_code == 200 and r.json()["comment_status"] == "flagged"
    assert client.post(f"/api/v1/me/ratings/{rating.id}/flag", {"reason": "again"}).status_code == 400

    q = staff_client.get("/api/v1/ops/ratings", {"status": "flagged"}).json()
    assert q["count"] == 1 and q["results"][0]["flag_reason"] == "Untrue and insulting"
    r = staff_client.post(f"/api/v1/ops/ratings/{rating.id}/hide", {"note": "Abusive"}, format="json")
    assert r.status_code == 200 and r.json()["comment_status"] == "hidden"
    assert client.get("/api/v1/me/ratings").json()["received"][0]["comment"] is None
    # score still counts when only the comment is hidden
    assert recompute_trust(w).breakdown["employer_feedback"] == pytest.approx(0.4)
    r = staff_client.post(f"/api/v1/ops/ratings/{rating.id}/restore", {}, format="json")
    assert r.json()["comment_status"] == "visible"
    assert (
        AuditLog.objects.filter(action__in=["rating.flag", "ops.rating.hide", "ops.rating.restore"]).count()
        == 3
    )


def test_ops_void_excludes_rating_from_scores(org, worker_user, staff_client):
    _, w = worker_user
    emp = f.EmploymentFactory(organization=org, worker=w)
    rating = Rating.objects.create(employment=emp, rater="employer", score_a=1, score_b=1)
    assert recompute_trust(w).breakdown["employer_feedback"] == pytest.approx(0.2)
    assert staff_client.post(f"/api/v1/ops/ratings/{rating.id}/void", {}, format="json").status_code == 400
    r = staff_client.post(f"/api/v1/ops/ratings/{rating.id}/void", {"reason": "Retaliation"}, format="json")
    assert r.status_code == 200 and r.json()["voided"] is True
    assert recompute_trust(w).breakdown["employer_feedback"] == pytest.approx(0.7)  # neutral again
    assert AuditLog.objects.filter(action="ops.rating.void").exists()
    assert staff_client.post(f"/api/v1/ops/ratings/{rating.id}/void", {"reason": "x"}).status_code == 400


def test_employer_sees_anonymised_comments_and_flags(owner_client, org, make_member):
    emps = [f.EmploymentFactory(organization=org) for _ in range(3)]
    first = Rating.objects.create(
        employment=emps[0], rater="worker", score_a=1, score_b=1, comment="Pay late"
    )
    r = owner_client.get("/api/v1/org/ratings/received").json()
    assert r["count"] == 1 and r["results"] == []  # below the 3-rating threshold
    for e in emps[1:]:
        Rating.objects.create(employment=e, rater="worker", score_a=4, score_b=4)
    rows = owner_client.get("/api/v1/org/ratings/received").json()["results"]
    assert len(rows) == 3 and "worker" not in rows[0] and len(rows[0]["created_at"]) == 7
    r = owner_client.post(f"/api/v1/org/ratings/{first.id}/flag", {"reason": "Paid on time"}, format="json")
    assert r.status_code == 200 and r.json()["comment_status"] == "flagged"
    _, sup = make_member("supervisor")
    assert sup.get("/api/v1/org/ratings/received").status_code == 403
    # void excluded from reputation
    Rating.objects.filter(pk=first.pk).update(voided=True)
    assert employer_reputation(org) is None


def test_other_org_cannot_flag(org):
    emp = f.EmploymentFactory(organization=org)
    rating = Rating.objects.create(employment=emp, rater="worker", score_a=1, score_b=1, comment="x")
    other = f.MembershipFactory(role="owner")
    client = auth_client(other.user, other.organization)
    assert client.post(f"/api/v1/org/ratings/{rating.id}/flag", {"reason": "x"}).status_code == 404


def test_ops_ratings_role(db):
    from apps.accounts.models import StaffProfile

    support = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=support, roles=["support"])
    verifier = f.UserFactory(is_staff=True)
    StaffProfile.objects.create(user=verifier, roles=["verifier"])
    assert auth_client(support).get("/api/v1/ops/ratings").status_code == 200
    assert auth_client(verifier).get("/api/v1/ops/ratings").status_code == 403


# --------------------------------------------------------------------------- N006 evidence
@pytest.fixture
def dispute(org, worker_user):
    _, w = worker_user
    emp = f.EmploymentFactory(organization=org, worker=w)
    return Dispute.objects.create(
        worker=w, organization=org, employment=emp, kind="wage", description="Short paid"
    )


def test_evidence_upload_and_access(dispute, worker_user, owner_client, staff_client, api):
    user, _ = worker_user
    wc = auth_client(user)
    r = wc.post(
        f"/api/v1/me/disputes/{dispute.id}/evidence",
        {"file": png(), "note": "Payslip photo"},
        format="multipart",
    )
    assert r.status_code == 201, r.json()
    assert r.json()["party"] == "worker" and r.json()["file_type"] == "image" and r.json()["file_url"]
    url = r.json()["file_url"]
    assert api.get(url).status_code == 200  # signed URL works without auth header
    pdf = SimpleUploadedFile("p.pdf", b"%PDF-1.4 test", content_type="application/pdf")
    r = owner_client.post(f"/api/v1/org/disputes/{dispute.id}/evidence", {"file": pdf}, format="multipart")
    assert r.status_code == 201 and r.json()["party"] == "employer" and r.json()["file_type"] == "pdf"
    r = staff_client.post(
        f"/api/v1/ops/disputes/{dispute.id}/evidence", {"file": png("o.png")}, format="multipart"
    )
    assert r.status_code == 201 and r.json()["party"] == "ops"
    assert len(wc.get(f"/api/v1/me/disputes/{dispute.id}/evidence").json()) == 3
    assert owner_client.get(f"/api/v1/org/disputes/{dispute.id}").json()["evidence_count"] == 3
    assert AuditLog.objects.filter(action="dispute.evidence.add").count() == 3
    # bad file type
    bad = SimpleUploadedFile("x.exe", b"MZ", content_type="application/octet-stream")
    assert (
        wc.post(f"/api/v1/me/disputes/{dispute.id}/evidence", {"file": bad}, format="multipart").status_code
        == 400
    )


def test_evidence_isolation(dispute):
    other_user = f.UserFactory()
    f.WorkerFactory(user=other_user, phone=other_user.phone)
    assert auth_client(other_user).get(f"/api/v1/me/disputes/{dispute.id}/evidence").status_code == 404
    other = f.MembershipFactory(role="owner")
    client = auth_client(other.user, other.organization)
    assert (
        client.post(
            f"/api/v1/org/disputes/{dispute.id}/evidence", {"file": png()}, format="multipart"
        ).status_code
        == 404
    )
    # download re-check denies an unrelated user holding a leaked token
    ev = DisputeEvidence.objects.create(dispute=dispute, file=png(), party="worker")
    from apps.trust.disputes import can_download_evidence

    assert not can_download_evidence(str(ev.pk), other_user, ev.file.name)


def test_evidence_closed_and_limit(dispute, owner_client):
    for _ in range(10):
        DisputeEvidence.objects.create(dispute=dispute, file=png(), party="worker")
    assert (
        owner_client.post(
            f"/api/v1/org/disputes/{dispute.id}/evidence", {"file": png()}, format="multipart"
        ).status_code
        == 400
    )
    DisputeEvidence.objects.all().delete()
    dispute.status = "resolved"
    dispute.save()
    assert (
        owner_client.post(
            f"/api/v1/org/disputes/{dispute.id}/evidence", {"file": png()}, format="multipart"
        ).status_code
        == 400
    )


# --------------------------------------------------------------------------- N008 appeal
def _resolve(staff_client, dispute, status="rejected"):
    r = staff_client.post(
        f"/api/v1/ops/disputes/{dispute.id}/resolve", {"status": status, "note": "No proof"}
    )
    assert r.status_code == 200
    return r


def test_worker_appeal_and_second_staff_decides(dispute, worker_user, staff_client):
    user, _ = worker_user
    wc = auth_client(user)
    # cannot appeal an open dispute
    assert wc.post(f"/api/v1/me/disputes/{dispute.id}/appeal", {"reason": "x"}).status_code == 400
    r = _resolve(staff_client, dispute)
    assert r.json()["can_appeal"] is True and r.json()["appeal_deadline"]
    r = wc.post(
        f"/api/v1/me/disputes/{dispute.id}/appeal", {"reason": "I have the payslip now"}, format="json"
    )
    assert r.status_code == 200 and r.json()["status"] == "appealed"
    assert r.json()["appeal"]["party"] == "worker" and r.json()["sla_due_at"]
    # once only
    assert wc.post(f"/api/v1/me/disputes/{dispute.id}/appeal", {"reason": "again"}).status_code == 400
    # evidence allowed while appealed
    assert (
        wc.post(f"/api/v1/me/disputes/{dispute.id}/evidence", {"file": png()}, format="multipart").status_code
        == 201
    )
    # the first decider can't decide the appeal
    r = staff_client.post(
        f"/api/v1/ops/disputes/{dispute.id}/appeal-decision",
        {"outcome": "overturned", "note": "x"},
        format="json",
    )
    assert r.status_code == 403
    # nor can resolve be used again
    assert (
        staff_client.post(
            f"/api/v1/ops/disputes/{dispute.id}/resolve", {"status": "resolved", "note": "x"}
        ).status_code
        == 400
    )
    second = auth_client(f.UserFactory(is_staff=True))
    r = second.post(
        f"/api/v1/ops/disputes/{dispute.id}/appeal-decision",
        {"outcome": "overturned", "note": "Payslip shows short pay"},
        format="json",
    )
    assert r.status_code == 200, r.json()
    d = r.json()
    assert d["status"] == "appeal_resolved" and d["appeal"]["outcome"] == "overturned"
    assert d["appeal"]["resolved_by"] and d["can_appeal"] is False
    assert AuditLog.objects.filter(action="ops.dispute.appeal_decision").exists()


def test_employer_appeal_and_deadline(dispute, owner_client, staff_client, make_member):
    _resolve(staff_client, dispute, "resolved")
    _, sup = make_member("supervisor")
    assert sup.post(f"/api/v1/org/disputes/{dispute.id}/appeal", {"reason": "x"}).status_code == 403
    Dispute.objects.filter(pk=dispute.pk).update(resolved_at=timezone.now() - dt.timedelta(days=15))
    r = owner_client.post(f"/api/v1/org/disputes/{dispute.id}/appeal", {"reason": "late"}, format="json")
    assert r.status_code == 400
    Dispute.objects.filter(pk=dispute.pk).update(resolved_at=timezone.now() - dt.timedelta(days=13))
    r = owner_client.post(
        f"/api/v1/org/disputes/{dispute.id}/appeal", {"reason": "Worker was absent"}, format="json"
    )
    assert r.status_code == 200 and r.json()["appeal"]["party"] == "employer"


# --------------------------------------------------------------------------- G012
def test_credential_resubmission(worker_user, staff_client):
    from apps.credentials.models import Credential

    user, w = worker_user
    wc = auth_client(user)
    r = wc.post(
        "/api/v1/me/credentials",
        {
            "kind": "nstb",
            "title": "Cook L1",
            "issuer": "NSTB",
            "document": SimpleUploadedFile("c.pdf", b"%PDF-1.4 a", content_type="application/pdf"),
        },
        format="multipart",
    )
    cred_id = r.json()["id"]
    # pending → cannot resubmit
    assert wc.post(f"/api/v1/me/credentials/{cred_id}/resubmit", {}).status_code == 400
    staff_client.post(
        f"/api/v1/ops/credentials/{cred_id}/verify",
        {"status": "rejected", "method": "document", "note": "Blurry"},
    )
    listed = wc.get("/api/v1/me/credentials").json()["results"][0]
    assert listed["status"] == "rejected" and listed["can_resubmit"] is True
    r = wc.post(
        f"/api/v1/me/credentials/{cred_id}/resubmit", {"certificate_no": "NSTB-123"}, format="multipart"
    )
    assert r.status_code == 201, r.json()
    new = r.json()
    assert new["status"] == "pending" and new["resubmission_of"]["id"] == cred_id
    assert new["resubmission_of"]["note"] == "Blurry" and new["title"] == "Cook L1"
    copy = Credential.objects.get(pk=new["id"])
    assert copy.document and copy.document.name != Credential.objects.get(pk=cred_id).document.name
    # only once while the resubmission is pending
    assert wc.post(f"/api/v1/me/credentials/{cred_id}/resubmit", {}).status_code == 400
    q = staff_client.get("/api/v1/ops/credentials", {"status": "pending"}).json()["results"]
    assert q[0]["resubmission_of"]["id"] == cred_id
    assert AuditLog.objects.filter(action="credential.resubmit").exists()
