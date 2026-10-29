"""MEDIA_STORAGE=database: uploads in Postgres (apps/core/db_storage.py) for serverless hosting."""

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.test import RequestFactory

from apps.core.db_storage import DatabaseStorage
from apps.core.models import StoredFile
from apps.core.views import PublicMediaView
from tests import factories as f
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

JPEG = b"\xff\xd8\xff\xe0fake-jpeg-bytes"


@pytest.fixture
def db_storage(monkeypatch):
    """Swap the storage instances, not settings.STORAGES: changing the setting rebuilds every
    storage and would orphan files other tests keep in the in-memory test storages."""
    default, private = DatabaseStorage(), DatabaseStorage(location="private")
    storages["default"], storages["private"]  # make sure the cache exists before patching
    monkeypatch.setitem(storages._storages, "default", default)
    monkeypatch.setitem(storages._storages, "private", private)
    return default


def test_round_trip_and_unique_names(db_storage):
    name = db_storage.save("workers/a.jpg", ContentFile(JPEG))
    assert db_storage.exists(name) and db_storage.size(name) == len(JPEG)
    with db_storage.open(name) as fh:
        assert fh.read() == JPEG
    second = db_storage.save("workers/a.jpg", ContentFile(b"other"))
    assert second != name  # never overwrites
    assert db_storage.listdir("workers") == ([], sorted([name.split("/")[-1], second.split("/")[-1]]))
    db_storage.delete(name)
    assert not db_storage.exists(name)
    with pytest.raises(FileNotFoundError):
        db_storage.open(name)


def test_private_location_is_separate(db_storage):
    private = storages["private"]
    private.save("exports/x.zip", ContentFile(b"zip"))
    assert StoredFile.objects.filter(name="private/exports/x.zip").exists()
    assert private.exists("exports/x.zip") and not db_storage.exists("exports/x.zip")


def test_signed_link_downloads_from_database(db_storage, api):
    from apps.core import files

    user = f.UserFactory()
    name = storages["private"].save("exports/me.zip", ContentFile(b"zip-bytes"))
    token = files.make_token(name, user=user, storage_alias="private")
    res = auth_client(user).get(f"/api/v1/files/{token}")
    assert res.status_code == 200 and b"".join(res.streaming_content) == b"zip-bytes"
    assert api.get(f"/api/v1/files/{token}x").status_code == 404


def test_public_media_view_serves_only_public_prefixes(db_storage, settings):
    settings.PUBLIC_MEDIA_PREFIXES = ["org-logos/"]
    db_storage.save("org-logos/acme.png", ContentFile(b"\x89PNG logo"))
    db_storage.save("workers/id.jpg", ContentFile(JPEG))
    view = PublicMediaView.as_view()
    rf = RequestFactory()
    ok = view(rf.get("/media/org-logos/acme.png"), path="org-logos/acme.png")
    assert ok.status_code == 200 and b"".join(ok.streaming_content) == b"\x89PNG logo"
    assert view(rf.get("/media/workers/id.jpg"), path="workers/id.jpg").status_code == 404
    assert view(rf.get("/x"), path="org-logos/../workers/id.jpg").status_code == 404
    assert view(rf.get("/x"), path="org-logos/missing.png").status_code == 404


def test_storage_is_deconstructible():
    assert DatabaseStorage(location="private").deconstruct()[2] == {"location": "private"}


def test_export_db_media_copies_into_current_storages():
    from io import StringIO

    from django.core.management import call_command

    DatabaseStorage().save("workers/p.jpg", ContentFile(JPEG))
    DatabaseStorage(location="private").save("exports/e.zip", ContentFile(b"zip"))
    out = StringIO()
    call_command("export_db_media", stdout=out)
    assert "Would copy 2" in out.getvalue() and not storages["default"].exists("workers/p.jpg")
    call_command("export_db_media", "--apply", stdout=out)
    with storages["default"].open("workers/p.jpg") as fh:
        assert fh.read() == JPEG
    assert storages["private"].exists("exports/e.zip")
    out = StringIO()
    call_command("export_db_media", "--apply", stdout=out)
    assert "Copied 0 file(s); 2 already present" in out.getvalue()
