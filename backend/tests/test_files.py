"""Private documents: signed, short-lived URLs; no public media (Privacy Act 2075)."""

import time
from unittest import mock

import pytest
from django.core.files.base import ContentFile
from django.test import override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.core import files
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

JPEG = b"\xff\xd8\xff\xe0fake-jpeg-bytes"


@pytest.fixture
def worker(db):
    w = f.WorkerFactory()
    w.id_front.save("front.jpg", ContentFile(JPEG), save=False)
    w.id_back.save("back.jpg", ContentFile(JPEG), save=False)
    w.photo.save("face.jpg", ContentFile(JPEG), save=False)
    w.save()
    return w


def _path(url):
    """Signed URLs are absolute; the test client wants the path."""
    assert url and "/api/v1/files/" in url
    return url[url.index("/api/v1/files/") :]


def test_media_is_not_served_publicly(api, worker):
    assert api.get(f"/media/{worker.id_front.name}").status_code == 404
    assert api.get(f"/media/{worker.photo.name}").status_code == 404
    # public prefix cannot be abused for traversal
    assert api.get(f"/media/org-logos/../{worker.id_front.name}").status_code == 404


def test_ops_gets_signed_id_urls_and_can_download(staff_client, worker):
    data = staff_client.get(f"/api/v1/ops/workers/{worker.id}").json()
    for field in ("id_front", "id_back", "photo"):
        assert "/media/" not in data[field]
    res = APIClient().get(_path(data["id_front"]))  # no auth header needed: capability URL
    assert res.status_code == 200
    assert b"".join(res.streaming_content) == JPEG
    assert res["Cache-Control"].startswith("private")
    assert res["X-Content-Type-Options"] == "nosniff"
    assert AuditLog.objects.filter(action="worker.id_document.view", object_id=str(worker.id)).exists()


def test_worker_sees_own_documents(worker):
    user = f.UserFactory(phone=worker.phone)
    worker.user = user
    worker.save()
    data = auth_client(user).get("/api/v1/me/worker").json()
    assert data["id_front"] and data["photo"]
    assert APIClient().get(_path(data["id_back"])).status_code == 200


def test_tampered_or_garbage_token_is_rejected(api, staff_client, worker):
    url = _path(staff_client.get(f"/api/v1/ops/workers/{worker.id}").json()["id_front"])
    assert api.get(url[:-3] + ("aaa" if not url.endswith("aaa") else "bbb")).status_code == 404
    assert api.get("/api/v1/files/not-a-token").status_code == 404
    # A token for another file name cannot be forged without SECRET_KEY.
    forged = files.make_token(worker.id_front.name).replace("a", "b", 1)
    assert api.get(f"/api/v1/files/{forged}").status_code == 404


def test_token_expires(api, staff_client, worker):
    url = _path(staff_client.get(f"/api/v1/ops/workers/{worker.id}").json()["id_front"])
    later = time.time() + files.ttl_seconds() + 5
    with mock.patch("django.core.signing.time.time", return_value=later):
        res = api.get(url)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "permission_denied"


def test_employer_without_relationship_sees_no_photo_and_cannot_reuse_token(org, owner_client, worker):
    # Ops staff link is bound to the staff user; another user presenting it is refused.
    staff = f.UserFactory(is_staff=True)
    url = _path(files.worker_file_url(_req(staff), worker, "id_front"))
    assert owner_client.get(url).status_code == 403
    # Other-org owner cannot get a URL for the ID at all.
    other = f.MembershipFactory(role="owner").user
    assert files.worker_file_url(_req(other), worker, "id_front") is None
    assert files.worker_file_url(_req(other), worker, "photo") is None


def test_employer_member_gets_photo_of_employee_but_never_id(org, owner, owner_client, worker):
    f.EmploymentFactory(organization=org, worker=worker)
    data = owner_client.get("/api/v1/org/employments").json()["results"][0]["worker"]
    assert data["photo"]
    assert "id_front" not in data
    assert owner_client.get(_path(data["photo"])).status_code == 200
    assert files.worker_file_url(_req(owner), worker, "id_front") is None


def test_shortlisted_worker_photo_visible_sourced_not(org, owner, worker):
    job = f.JobFactory(organization=org)
    app = f.ApplicationFactory(job=job, worker=worker, stage="sourced")
    assert files.worker_file_url(_req(owner), worker, "photo") is None
    app.stage = "shortlisted"
    app.save()
    assert files.worker_file_url(_req(owner), worker, "photo")


def test_access_revoked_after_issue(org, owner, worker):
    emp = f.EmploymentFactory(organization=org, worker=worker)
    url = _path(files.worker_file_url(_req(owner), worker, "photo"))
    emp.delete()
    assert APIClient().get(url).status_code == 403


def test_replaced_document_kills_old_link(staff_client, worker):
    url = _path(staff_client.get(f"/api/v1/ops/workers/{worker.id}").json()["id_front"])
    worker.id_front.save("front2.jpg", ContentFile(JPEG), save=True)
    assert APIClient().get(url).status_code == 403


def test_inactive_user_token_rejected(worker):
    staff = f.UserFactory(is_staff=True)
    url = _path(files.worker_file_url(_req(staff), worker, "photo"))
    staff.is_active = False
    staff.save()
    assert APIClient().get(url).status_code == 403


def test_generic_signed_url_private_storage(db):
    from django.core.files.storage import storages

    name = storages["private"].save("exports/x.json", ContentFile(b"{}"))
    holder = type("F", (), {"name": name, "storage": files.private_storage()})()
    user = f.UserFactory()
    url = files.signed_url(holder, user)
    res = APIClient().get(_path(url))
    assert res.status_code == 200
    assert "attachment" in res["Content-Disposition"]


@override_settings(API_PUBLIC_URL="https://api.example.com")
def test_public_api_origin_used(worker):
    staff = f.UserFactory(is_staff=True)
    assert files.worker_file_url(_req(staff), worker, "photo").startswith(
        "https://api.example.com/api/v1/files/"
    )


def _req(user):
    return type("R", (), {"user": user, "build_absolute_uri": lambda self, p: "http://testserver" + p})()
