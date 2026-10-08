"""External work history (docs/CONTRACT-EXTENSIONS.md §3): CRUD, reference checks, employer
confirmation, passport ``work.external`` and trust effects."""

import datetime as dt
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection

from apps.audit.models import AuditLog
from apps.core.bs import today_ad
from apps.credentials import services as cred_services
from apps.experience.models import WorkHistoryEntry
from apps.trust.services import _Facts, recompute_trust
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/work-history"


@pytest.fixture
def worker_user():
    return f.UserFactory()


@pytest.fixture
def worker(worker_user):
    return f.WorkerFactory(user=worker_user, phone=worker_user.phone)


@pytest.fixture
def client(worker_user, worker):
    return auth_client(worker_user)


def payload(**kw):
    return {
        "employer_name": "Hotel Everest Pvt. Ltd.",
        "role_title": "Line cook",
        "trade": "cook",
        "district": "kaski",
        "start_date": "2022-01-01",
        "end_date": "2023-06-30",
        "description": "Breakfast and dal-bhat line.",
        **kw,
    }


def with_reference(**kw):
    return payload(reference_name="Hari Sharma (head chef)", reference_phone="9851012345", **kw)


def make_entry(worker, **kw):
    defaults = {
        "employer_name": "Old Hotel",
        "role_title": "Cook",
        "start_date": dt.date(2021, 1, 1),
        "end_date": dt.date(2022, 7, 1),
        "status": "reference_pending",
        "reference_name": "Boss",
        "reference_phone": "9851000000",
    }
    defaults.update(kw)
    return WorkHistoryEntry.objects.create(worker=worker, **defaults)


# --- worker CRUD ----------------------------------------------------------------------------------


def test_create_without_reference_is_self_reported(client):
    res = client.post(URL, payload(), format="json")
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["status"] == "self_reported"
    assert body["trade"]["code"] == "cook" and body["district"]["code"] == "kaski"
    assert body["start_date_bs"] and body["months"] == 18
    assert body["editable"] is True


def test_create_with_reference_is_pending_and_phone_encrypted(client):
    res = client.post(URL, with_reference(), format="json")
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["status"] == "reference_pending"
    assert body["reference_phone"] == "9851012345"  # the worker sees what they entered
    with connection.cursor() as cur:
        cur.execute("SELECT reference_phone FROM experience_workhistoryentry WHERE id = %s", [body["id"]])
        raw = cur.fetchone()[0]
    assert raw.startswith("enc1:") and "9851012345" not in raw
    assert AuditLog.objects.filter(action="work_history.create", object_id=body["id"]).exists()
    log = AuditLog.objects.get(action="work_history.create", object_id=body["id"])
    assert "9851012345" not in str(log.changes)


@pytest.mark.parametrize(
    "kw,field",
    [
        ({"start_date": "2099-01-01", "end_date": None}, "start_date"),
        ({"start_date": "2023-01-01", "end_date": "2022-01-01"}, "end_date"),
        ({"reference_phone": "12"}, "reference_phone"),
        ({"reference_phone": "9851012345"}, "reference_name"),
    ],
)
def test_create_validation(client, kw, field):
    res = client.post(URL, payload(**kw), format="json")
    assert res.status_code == 400
    assert field in res.json()["error"]["fields"]


def test_list_is_own_only(client, worker):
    make_entry(worker)
    make_entry(f.WorkerFactory())
    rows = client.get(URL).json()["results"]
    assert len(rows) == 1


def test_user_without_worker_profile_gets_404():
    res = auth_client(f.UserFactory()).get(URL)
    assert res.status_code == 404


def test_edit_resets_status_and_lock_after_verify(client, worker):
    entry = make_entry(worker, status="rejected", note="Number unreachable")
    res = client.patch(f"{URL}/{entry.id}", {"reference_phone": "9841999999"}, format="json")
    assert res.status_code == 200, res.json()
    assert res.json()["status"] == "reference_pending"

    entry.status = "verified"
    entry.save()
    res = client.patch(f"{URL}/{entry.id}", {"role_title": "Head cook"}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"
    res = client.delete(f"{URL}/{entry.id}")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"
    assert client.get(f"{URL}/{entry.id}").json()["editable"] is False


def test_delete_while_pending(client, worker):
    entry = make_entry(worker)
    assert client.delete(f"{URL}/{entry.id}").status_code == 204
    assert not WorkHistoryEntry.objects.filter(pk=entry.pk).exists()


def test_other_worker_cannot_touch(worker):
    entry = make_entry(worker)
    other = f.UserFactory()
    f.WorkerFactory(user=other, phone=other.phone)
    c = auth_client(other)
    assert c.get(f"{URL}/{entry.id}").status_code == 404
    assert c.patch(f"{URL}/{entry.id}", {"role_title": "x"}, format="json").status_code == 404
    assert c.delete(f"{URL}/{entry.id}").status_code == 404


def _png_bytes():
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (200, 10, 10)).save(buf, format="PNG")
    return buf.getvalue()


def test_document_upload_private(client, worker, owner_client, org):
    doc = SimpleUploadedFile("letter.png", _png_bytes(), content_type="image/png")
    res = client.post(URL, {**payload(), "document": doc}, format="multipart")
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["document_url"] and body["document_type"] == "image"
    # the employer never gets the document (not even for its own confirmation requests)
    entry = WorkHistoryEntry.objects.get(pk=body["id"])
    entry.employer_org = org
    entry.save()
    row = owner_client.get("/api/v1/org/work-history-confirmations").json()["results"][0]
    assert "document_url" not in row and "document" not in row


# --- ops reference checks -----------------------------------------------------------------------------


def test_ops_queue_shows_reference_phone(staff_client, worker):
    entry = make_entry(worker)
    make_entry(worker, status="verified", verification_method="reference_call")
    rows = staff_client.get("/api/v1/ops/work-history", {"status": "reference_pending"}).json()["results"]
    assert [r["id"] for r in rows] == [str(entry.id)]
    assert rows[0]["reference_phone"] == "9851000000"
    assert rows[0]["worker"]["id"] == str(worker.id)


def test_ops_endpoints_require_staff(client, owner_client):
    assert client.get("/api/v1/ops/work-history").status_code == 403
    assert owner_client.get("/api/v1/ops/work-history").status_code == 403


def test_ops_verify_flow(staff_client, worker):
    entry = make_entry(worker)
    url = f"/api/v1/ops/work-history/{entry.id}/verify"
    res = staff_client.post(url, {"status": "verified"}, format="json")
    assert res.status_code == 400 and "method" in res.json()["error"]["fields"]
    res = staff_client.post(url, {"status": "unverifiable"}, format="json")
    assert res.status_code == 400 and "note" in res.json()["error"]["fields"]

    res = staff_client.post(
        url, {"status": "verified", "method": "reference_call", "note": "Chef confirmed"}, format="json"
    )
    assert res.status_code == 200, res.json()
    body = res.json()
    assert body["status"] == "verified" and body["verification_method"] == "reference_call"
    assert body["verified_by"] and body["verified_at"]
    audit = AuditLog.objects.get(action="ops.work_history.verify", object_id=str(entry.id))
    assert audit.changes["status"] == {"from": "reference_pending", "to": "verified"}


# --- on-platform employer confirmation ------------------------------------------------------------------


def test_employer_confirm_flow(client, owner_client, org, worker):
    res = client.post(URL, payload(employer_org_id=str(org.id)), format="json")
    assert res.status_code == 201, res.json()
    assert res.json()["status"] == "reference_pending"
    assert res.json()["employer_org"]["id"] == str(org.id)
    entry_id = res.json()["id"]

    rows = owner_client.get("/api/v1/org/work-history-confirmations").json()["results"]
    assert [r["id"] for r in rows] == [entry_id]
    row = rows[0]
    assert "reference_phone" not in row and "reference_name" not in row
    assert row["worker"]["full_name"] == worker.full_name and "phone" not in row["worker"]

    res = owner_client.post(f"/api/v1/org/work-history/{entry_id}/confirm", {}, format="json")
    assert res.status_code == 200, res.json()
    entry = WorkHistoryEntry.objects.get(pk=entry_id)
    assert entry.status == "verified" and entry.verification_method == "employer_confirmed"
    assert owner_client.get("/api/v1/org/work-history-confirmations").json()["count"] == 0
    assert owner_client.get("/api/v1/org/work-history-confirmations", {"status": "all"}).json()["count"] == 1
    # already decided
    res = owner_client.post(f"/api/v1/org/work-history/{entry_id}/reject", {}, format="json")
    assert res.status_code == 400 and res.json()["error"]["code"] == "invalid_state"


def test_employer_reject_and_scoping(owner_client, org, worker, make_member):
    entry = make_entry(worker, employer_org=org)
    other_org_owner = auth_client(
        f.MembershipFactory(role="owner").user, f.OrganizationFactory()
    )  # wrong X-Org-Id → forbidden
    assert other_org_owner.post(f"/api/v1/org/work-history/{entry.id}/confirm").status_code == 403
    m = f.MembershipFactory(role="owner")
    assert (
        auth_client(m.user, m.organization).post(f"/api/v1/org/work-history/{entry.id}/confirm").status_code
        == 404
    )
    _, supervisor = make_member("supervisor")
    assert supervisor.get("/api/v1/org/work-history-confirmations").status_code == 403

    res = owner_client.post(
        f"/api/v1/org/work-history/{entry.id}/reject", {"note": "Never worked here"}, format="json"
    )
    assert res.status_code == 200
    entry.refresh_from_db()
    assert entry.status == "rejected" and entry.note == "Never worked here"


# --- effects --------------------------------------------------------------------------------------------


def test_passport_work_external(worker):
    make_entry(worker, status="verified", verification_method="employer_confirmed", employer_name="A")
    make_entry(
        worker,
        status="verified",
        verification_method="reference_call",
        employer_name="B",
        start_date=dt.date(2019, 1, 1),
        end_date=dt.date(2020, 1, 1),
    )
    make_entry(worker, status="reference_pending", employer_name="C")
    work = cred_services.passport_payload(worker, include_contact=False, verify_url="x")["work"]
    ext = work["external"]
    assert [e["employer_name"] for e in ext] == ["A", "B"]
    assert ext[0]["verified_by"] == "employer" and ext[1]["verified_by"] == "reference"
    assert ext[1]["from"] == "2019-01-01" and ext[1]["to"] == "2020-01-01"
    assert set(ext[0]) >= {"employer_name", "role_title", "from", "to", "verified_by"}
    assert "reference_phone" not in str(work)
    assert "verified_employers" in work  # on-platform summary still there


def test_verified_external_history_counts_toward_level_2(worker):
    worker.verification_status = "verified"
    worker.save()
    assert recompute_trust(worker).verification_level == 1
    entry = make_entry(worker)
    assert recompute_trust(worker).verification_level == 1  # pending does not count
    entry.status = "verified"
    entry.verification_method = "reference_call"
    entry.save()
    assert recompute_trust(worker).verification_level == 2


def test_verified_external_history_counts_toward_stability(worker):
    today = today_ad()
    f.EmploymentFactory(worker=worker, start_date=today - dt.timedelta(days=90))  # 3 months
    assert _Facts(worker).stability() == pytest.approx(0.25)
    make_entry(
        worker,
        status="verified",
        verification_method="document",
        start_date=today - dt.timedelta(days=900),
        end_date=today - dt.timedelta(days=270),  # 21 months
    )
    assert _Facts(worker).stability() == pytest.approx(1.0)  # (3 + 21) / 2 = 12 months
    make_entry(worker, status="unverifiable")  # ignored
    assert _Facts(worker).stability() == pytest.approx(1.0)
