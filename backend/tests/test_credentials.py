"""Credentials: worker upload, ops verification queue, assessments, expiring, expiry task."""

import datetime as dt

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.bs import today_ad
from apps.credentials import services, tasks
from apps.credentials.models import Credential, SkillAssessment
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


@pytest.fixture
def worker_user(db):
    user = f.UserFactory()
    worker = f.WorkerFactory(user=user)
    return user, worker


@pytest.fixture
def worker_client(worker_user):
    return auth_client(worker_user[0])


@pytest.fixture
def trust_calls(monkeypatch):
    calls = []
    monkeypatch.setattr(services, "trust_call", lambda name, *a, **k: calls.append((name, a, k)))
    return calls


def make_cred(worker, **kw):
    defaults = {"kind": "nstb", "title": "Cook Level 2", "issuer": "NSTB", "status": "verified"}
    defaults.update(kw)
    return Credential.objects.create(worker=worker, **defaults)


def test_worker_uploads_credential_with_document(worker_client, worker_user):
    doc = SimpleUploadedFile("cert.pdf", b"%PDF-1.4 test", content_type="application/pdf")
    res = worker_client.post(
        "/api/v1/me/credentials",
        {
            "kind": "nstb",
            "title": "Cook",
            "issuer": "NSTB",
            "level": "Level 2",
            "issued_on": "2024-01-10",
            "document": doc,
        },
        format="multipart",
    )
    assert res.status_code == 201, res.content
    body = res.json()
    assert body["status"] == "pending"
    assert body["kind_label"] == "NSTB skill certificate"
    assert body["issued_on_bs"].startswith("2080-")
    assert "/files/" in body["document_url"]
    assert body["document_type"] == "pdf"
    listed = worker_client.get("/api/v1/me/credentials").json()
    assert listed["count"] == 1


def test_upload_rejects_bad_file_type_and_dates(worker_client):
    bad = SimpleUploadedFile("cert.exe", b"MZ", content_type="application/octet-stream")
    res = worker_client.post(
        "/api/v1/me/credentials",
        {"kind": "nstb", "title": "X", "issuer": "Y", "document": bad},
        format="multipart",
    )
    assert res.status_code == 400
    assert "document" in res.json()["error"]["fields"]
    res = worker_client.post(
        "/api/v1/me/credentials",
        {
            "kind": "license",
            "title": "X",
            "issuer": "Y",
            "issued_on": "2024-05-01",
            "expires_on": "2024-01-01",
        },
        format="json",
    )
    assert res.status_code == 400
    assert "expires_on" in res.json()["error"]["fields"]


def test_worker_can_delete_only_pending(worker_client, worker_user):
    _, worker = worker_user
    pending = make_cred(worker, status="pending")
    verified = make_cred(worker, title="Other")
    assert (
        worker_client.delete(f"/api/v1/me/credentials/{verified.id}").json()["error"]["code"]
        == "invalid_state"
    )
    assert worker_client.delete(f"/api/v1/me/credentials/{pending.id}").status_code == 204
    assert not Credential.objects.filter(pk=pending.pk).exists()


def test_worker_cannot_see_other_workers_credentials(worker_client):
    other = make_cred(f.WorkerFactory())
    assert worker_client.get(f"/api/v1/me/credentials/{other.id}").status_code == 404
    assert worker_client.delete(f"/api/v1/me/credentials/{other.id}").status_code == 404


def test_user_without_worker_profile_gets_404(db):
    client = auth_client(f.UserFactory())
    assert client.get("/api/v1/me/credentials").status_code == 404


def test_ops_queue_requires_staff(owner_client, worker_client):
    assert owner_client.get("/api/v1/ops/credentials").status_code == 403
    assert worker_client.get("/api/v1/ops/credentials").status_code == 403


def test_ops_verify_flow_and_trust_recompute(staff_client, trust_calls, django_capture_on_commit_callbacks):
    worker = f.WorkerFactory()
    cred = make_cred(worker, status="pending")
    make_cred(worker, title="Done")
    queue = staff_client.get("/api/v1/ops/credentials?status=pending").json()
    assert [c["id"] for c in queue["results"]] == [str(cred.id)]
    assert queue["results"][0]["worker"]["id"] == str(worker.id)

    with django_capture_on_commit_callbacks(execute=True):
        res = staff_client.post(
            f"/api/v1/ops/credentials/{cred.id}/verify",
            {"status": "verified", "method": "ops_call", "note": "Called NSTB"},
        )
    assert res.status_code == 200, res.content
    cred.refresh_from_db()
    assert cred.status == "verified"
    assert cred.verification_method == "ops_call"
    assert cred.verified_by is not None and cred.verified_at is not None
    assert ("recompute_trust", (worker,), {}) in trust_calls

    res = staff_client.post(
        f"/api/v1/ops/credentials/{cred.id}/verify", {"status": "rejected", "note": "Fake"}
    )
    assert res.json()["status"] == "rejected"


def test_registry_verifier_not_configured(staff_client):
    cred = make_cred(f.WorkerFactory(), status="pending")
    res = staff_client.post(
        f"/api/v1/ops/credentials/{cred.id}/verify", {"status": "verified", "method": "issuer_registry"}
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_state"
    cred.refresh_from_db()
    assert cred.status == "pending"


def test_verify_already_expired_certificate_marks_expired(staff_client):
    cred = make_cred(f.WorkerFactory(), status="pending", expires_on=today_ad() - dt.timedelta(days=1))
    res = staff_client.post(f"/api/v1/ops/credentials/{cred.id}/verify", {"status": "verified"})
    assert res.json()["status"] == "expired"


def test_ops_assessments(staff_client, trust_calls):
    worker = f.WorkerFactory()
    res = staff_client.post(
        "/api/v1/ops/assessments",
        {
            "worker_id": str(worker.id),
            "trade": "cook",
            "assessed_on": "2026-09-01",
            "result": "pass",
            "score": 82,
            "level": "Level 2",
        },
    )
    assert res.status_code == 201, res.content
    body = res.json()
    assert body["trade"]["code"] == "cook"
    assert body["result_label"] == "Passed"
    assert body["assessor_user"] is not None
    assert ("recompute_trust", (worker,), {}) in trust_calls
    assert staff_client.get(f"/api/v1/ops/assessments?worker={worker.id}").json()["count"] == 1
    res = staff_client.post(
        "/api/v1/ops/assessments",
        {"worker_id": str(worker.id), "trade": "cook", "assessed_on": "2099-01-01", "result": "pass"},
    )
    assert res.status_code == 400


def test_ops_worker_credentials_panel(staff_client):
    worker = f.WorkerFactory()
    make_cred(worker)
    SkillAssessment.objects.create(
        worker=worker, trade=f.trade("cook"), assessed_on=today_ad(), result="fail"
    )
    body = staff_client.get(f"/api/v1/ops/workers/{worker.id}/credentials").json()
    assert len(body["credentials"]) == 1
    assert len(body["assessments"]) == 1
    assert body["passport"] is None
    assert body["active_shares"] == 0


def test_org_expiring_only_active_workers_of_org(owner_client, org):
    today = today_ad()
    mine = f.EmploymentFactory(organization=org)
    ended = f.EmploymentFactory(organization=org, status="ended", end_date=today)
    other = f.EmploymentFactory()
    soon = make_cred(mine.worker, kind="license", title="Licence", expires_on=today + dt.timedelta(days=10))
    make_cred(mine.worker, kind="safety", title="Later", expires_on=today + dt.timedelta(days=60))
    make_cred(
        mine.worker,
        kind="safety",
        title="Rejected",
        status="rejected",
        expires_on=today + dt.timedelta(days=5),
    )
    make_cred(ended.worker, kind="license", title="Ended", expires_on=today + dt.timedelta(days=5))
    make_cred(other.worker, kind="license", title="Other", expires_on=today + dt.timedelta(days=5))

    body = owner_client.get("/api/v1/org/credentials/expiring?days=30").json()
    assert [r["id"] for r in body["results"]] == [str(soon.id)]
    assert body["results"][0]["days_to_expiry"] == 10
    assert body["results"][0]["worker"]["full_name"] == mine.worker.full_name
    assert owner_client.get("/api/v1/org/credentials/expiring?days=90").json()["count"] == 2
    assert owner_client.get("/api/v1/org/credentials/expiring?days=abc").status_code == 400


def test_expiring_requires_manager_role(make_member):
    _, client = make_member("supervisor")
    assert client.get("/api/v1/org/credentials/expiring").status_code == 403


def test_expiry_task_marks_expired_and_sends_reminders(monkeypatch, trust_calls):
    sent = []
    monkeypatch.setattr(
        "apps.notifications.services.send_sms",
        lambda phone, body, kind="generic", **k: sent.append((phone, body, kind)),
    )
    today = today_ad()
    w = f.WorkerFactory()
    past = make_cred(w, title="Old", expires_on=today - dt.timedelta(days=1))
    pending_past = make_cred(
        w, title="Pending old", status="pending", expires_on=today - dt.timedelta(days=3)
    )
    in30 = make_cred(w, title="In 30", expires_on=today + dt.timedelta(days=30))
    in7 = make_cred(w, title="In 7", expires_on=today + dt.timedelta(days=7))
    make_cred(w, title="In 8", expires_on=today + dt.timedelta(days=8))
    make_cred(w, title="Rejected 7", status="rejected", expires_on=today + dt.timedelta(days=7))

    result = tasks.expiry_reminders()
    assert result == {"expired": 2, "reminded": 2}
    past.refresh_from_db()
    pending_past.refresh_from_db()
    assert past.status == "expired" and pending_past.status == "expired"
    assert {s[2] for s in sent} == {"credential_expiry"}
    assert all(s[0] == w.phone for s in sent)
    bodies = " ".join(s[1] for s in sent)
    assert in30.title in bodies and in7.title in bodies
    assert ("recompute_trust", (w,), {}) in trust_calls
    # Idempotent for expiry: second run expires nothing new.
    assert tasks.expiry_reminders()["expired"] == 0


def test_trust_call_is_noop_when_trust_function_missing(monkeypatch):
    import apps.trust as trust_pkg

    monkeypatch.setitem(__import__("sys").modules, "apps.trust.services", None)
    monkeypatch.delattr(trust_pkg, "services", raising=False)
    assert services.trust_call("recompute_trust", f.WorkerFactory()) is None


def test_trust_call_swallows_errors(monkeypatch):
    import types

    fake = types.ModuleType("apps.trust.services")

    def boom(*a, **k):
        raise RuntimeError("x")

    fake.recompute_trust = boom
    monkeypatch.setitem(__import__("sys").modules, "apps.trust.services", fake)
    import apps.trust as trust_pkg

    monkeypatch.setattr(trust_pkg, "services", fake, raising=False)
    assert services.trust_call("recompute_trust", f.WorkerFactory()) is None


def test_labels_localised_in_nepali(worker_client, worker_user):
    make_cred(worker_user[1])
    row = worker_client.get("/api/v1/me/credentials", HTTP_ACCEPT_LANGUAGE="ne").json()["results"][0]
    assert row["kind_label"] == "राष्ट्रिय सीप परीक्षण प्रमाणपत्र (NSTB)"
    assert row["status_label"] == "प्रमाणित"
