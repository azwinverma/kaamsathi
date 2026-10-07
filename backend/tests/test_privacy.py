"""§11 privacy: export bundle, anonymising deletion, ops workflow, retention."""

import datetime as dt
import io
import json
import zipfile

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.payroll.models import Payslip
from apps.payroll.services import create_run
from apps.privacy.models import PrivacyRequest
from apps.privacy.services import purge_expired_exports
from apps.workers.models import Consent, Worker
from apps.workforce.models import Attendance, Employment
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def run_on_commit_now(monkeypatch):
    """Celery is eager in tests; run on_commit-enqueued tasks immediately too."""
    from apps.notifications import services as notifications

    monkeypatch.setattr(notifications.transaction, "on_commit", lambda fn, *a, **k: fn())


@pytest.fixture
def worker_user(org):
    w = f.WorkerFactory(full_name="Sita Tamang", citizenship_no="12-01-75-00001", address="Kalanki")
    user = f.UserFactory(phone=w.phone, full_name=w.full_name)
    w.user = user
    w.id_front.save("front.jpg", ContentFile(b"jpeg"), save=False)
    w.save()
    f.WorkerSkillFactory(worker=w)
    emp = f.EmploymentFactory(organization=org, worker=w)
    f.AttendanceFactory(employment=emp, date=dt.date(2026, 7, 20), status="present")
    Attendance.objects.filter(employment=emp).update(check_in_lat="27.700000", check_in_lng="85.300000")
    Consent.objects.create(worker=w, organization=org, scope="profile_share", granted=True)
    return user


def _zip(content: bytes) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BytesIO(content))


def _body(res) -> bytes:
    return b"".join(res.streaming_content)


def test_worker_export_generates_json_and_pdf_bundle(worker_user):
    client = auth_client(worker_user)
    res = client.post("/api/v1/me/privacy-requests", {"kind": "export"})
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["status"] == "completed"  # eager Celery in tests
    assert body["file_available"] is True
    assert body["download_url"]

    dl = client.get(f"/api/v1/me/privacy-requests/{body['id']}/download")
    assert dl.status_code == 200
    zf = _zip(_body(dl))
    assert set(zf.namelist()) == {"data.json", "data.pdf", "README.txt"}
    data = json.loads(zf.read("data.json"))
    assert data["worker_profile"]["citizenship_no"] == "12-01-75-00001"
    assert data["worker_profile"]["id_front"] is True  # presence only, file not bundled
    assert len(data["employments"]) == 1 and len(data["attendance"]) == 1
    assert data["consents"][0]["scope"] == "profile_share"
    assert "ratings" in data
    assert zf.read("data.pdf").startswith(b"%PDF")

    # signed URL works without auth and only for this file
    signed = body["download_url"]
    assert APIClient().get(signed[signed.index("/api/v1/") :]).status_code == 200


def test_duplicate_open_request_rejected(worker_user):
    client = auth_client(worker_user)
    assert client.post("/api/v1/me/privacy-requests", {"kind": "deletion"}).status_code == 201
    res = client.post("/api/v1/me/privacy-requests", {"kind": "deletion"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "duplicate"


def test_correction_requires_details(worker_user):
    res = auth_client(worker_user).post("/api/v1/me/privacy-requests", {"kind": "correction"})
    assert res.status_code == 400


def test_other_users_cannot_see_or_download(worker_user):
    req = auth_client(worker_user).post("/api/v1/me/privacy-requests", {"kind": "export"}).json()
    stranger = auth_client(f.UserFactory())
    assert stranger.get(f"/api/v1/me/privacy-requests/{req['id']}").status_code == 404
    assert stranger.get(f"/api/v1/me/privacy-requests/{req['id']}/download").status_code == 404
    assert APIClient().get("/api/v1/me/privacy-requests").status_code == 401
    # the worker's signed link presented with another user's credentials is refused
    path = req["download_url"][req["download_url"].index("/api/v1/") :]
    assert stranger.get(path).status_code == 403


def test_ops_endpoints_staff_only(owner_client, staff_client, worker_user):
    auth_client(worker_user).post("/api/v1/me/privacy-requests", {"kind": "deletion"})
    assert owner_client.get("/api/v1/ops/privacy-requests").status_code == 403
    res = staff_client.get("/api/v1/ops/privacy-requests?status=received&kind=deletion")
    assert res.status_code == 200
    row = res.json()["results"][0]
    assert row["worker"]["full_name"] == "Sita Tamang"
    assert row["active_employments"] == 1
    assert row["kind_label"]


def test_ops_reject_needs_note_and_is_final(staff_client, worker_user):
    req = auth_client(worker_user).post("/api/v1/me/privacy-requests", {"kind": "deletion"}).json()
    url = f"/api/v1/ops/privacy-requests/{req['id']}/process"
    assert staff_client.post(url, {"action": "reject"}).status_code == 400
    res = staff_client.post(url, {"action": "reject", "note": "Active payroll dispute"})
    assert res.status_code == 200 and res.json()["status"] == "rejected"
    again = staff_client.post(url, {"action": "approve"})
    assert again.status_code == 400 and again.json()["error"]["code"] == "invalid_state"


def test_deletion_anonymises_but_keeps_payroll_and_attendance(org, staff_client, worker_user):
    worker = worker_user.worker
    worker_id, old_phone = worker.id, worker.phone
    run = create_run(org, 2083, 4)
    assert Payslip.objects.filter(run=run, worker=worker).exists()

    req = auth_client(worker_user).post("/api/v1/me/privacy-requests", {"kind": "deletion"}).json()
    res = staff_client.post(f"/api/v1/ops/privacy-requests/{req['id']}/process", {"action": "approve"})
    assert res.status_code == 200, res.json()
    assert res.json()["status"] == "completed"

    w = Worker.objects.get(pk=worker_id)
    assert w.full_name == "Deleted worker"
    assert w.phone != old_phone and len(w.phone) == 10
    assert w.citizenship_no is None and w.address is None
    assert not w.id_front
    assert w.user_id is None
    assert not w.skills.exists()
    # legally required records are kept, linked to the anonymised worker
    assert Employment.objects.filter(worker=w).count() == 1
    assert Payslip.objects.filter(worker=w).count() == 1
    att = Attendance.objects.get(employment__worker=w)
    assert att.status == "present" and att.check_in_lat is None
    # consent withdrawn (new row), history kept
    assert not Consent.is_granted(w, org, "profile_share")
    # login account scrubbed and disabled
    worker_user.refresh_from_db()
    assert worker_user.is_active is False and worker_user.full_name == "Deleted user"
    assert AuditLog.objects.filter(action="privacy.deletion", object_id=req["id"]).exists()


def test_deletion_revokes_lazy_ecosystem_data_when_present(staff_client, worker_user):
    """Partners grants / passport (other apps) are revoked or removed if those models exist."""
    from django.apps import apps

    worker = worker_user.worker
    try:
        Passport = apps.get_model("credentials", "Passport")
    except LookupError:
        pytest.skip("credentials app has no Passport model yet")
    try:
        Passport.objects.create(worker=worker, public_code="abcdefgh12", is_public=True)
    except Exception:  # noqa: BLE001 — schema still evolving in a sibling app
        pytest.skip("Passport schema differs")
    req = auth_client(worker_user).post("/api/v1/me/privacy-requests", {"kind": "deletion"}).json()
    staff_client.post(f"/api/v1/ops/privacy-requests/{req['id']}/process", {"action": "approve"})
    assert not Passport.objects.filter(worker=worker).exists()


def test_expired_exports_are_purged(worker_user):
    req_id = auth_client(worker_user).post("/api/v1/me/privacy-requests", {"kind": "export"}).json()["id"]
    req = PrivacyRequest.objects.get(pk=req_id)
    assert req.file
    assert purge_expired_exports() == 0
    req.file_expires_at = timezone.now() - dt.timedelta(minutes=1)
    req.save()
    assert purge_expired_exports() == 1
    req.refresh_from_db()
    assert not req.file
    res = auth_client(worker_user).get(f"/api/v1/me/privacy-requests/{req_id}/download")
    assert res.status_code == 404


def test_process_requests_task_runs(worker_user):
    from apps.privacy.tasks import process_requests

    result = process_requests()
    assert "exports_purged" in result and "otps" in result


def test_non_worker_user_can_export_account_data(owner):
    res = auth_client(owner).post("/api/v1/me/privacy-requests", {"kind": "export"})
    assert res.status_code == 201
    req = PrivacyRequest.objects.get(pk=res.json()["id"])
    data = json.loads(_zip(req.file.read()).read("data.json"))
    assert data["account"]["phone"] == owner.phone
    assert "worker_profile" not in data


def test_demo_seed_creates_completed_export(db):
    import random

    from apps.privacy import demo

    user = f.UserFactory(phone=demo.WORKER_USER_PHONE)
    w = f.WorkerFactory(phone=demo.WORKER_USER_PHONE)
    w.user = user
    w.save()
    out = io.StringIO()
    demo.seed(out, random.Random(1))
    demo.seed(out, random.Random(1))  # idempotent
    assert PrivacyRequest.objects.filter(user=user, kind="export", status="completed").count() == 1
