import pytest
from django.core.management import call_command
from django.db import connection

from apps.core import crypto
from apps.workers.models import Worker
from tests import factories as f

pytestmark = pytest.mark.django_db


def raw(column, pk):
    with connection.cursor() as cur:
        cur.execute(f"SELECT {column} FROM workers_worker WHERE id = %s", [pk])
        return cur.fetchone()[0]


def test_identifiers_encrypted_at_rest_and_readable_in_python():
    w = f.WorkerFactory(citizenship_no="51-07-89-97643", nid_no="123 456 789", bank_account_no="0012345678")
    assert raw("citizenship_no", w.pk).startswith("enc1:")
    assert "97643" not in raw("citizenship_no", w.pk)
    assert raw("bank_account_no", w.pk).startswith("enc1:")
    w = Worker.objects.get(pk=w.pk)
    assert (w.citizenship_no, w.nid_no, w.bank_account_no) == ("51-07-89-97643", "123 456 789", "0012345678")


def test_blind_index_normalises_and_enables_exact_lookup():
    w = f.WorkerFactory(citizenship_no="51-07-89-97643")
    for variant in ("51078997643", "५१-०७-८९-९७६४३", " 51/07/89/97643 "):
        assert (
            Worker.objects.filter(citizenship_no_hash=crypto.blind_index(variant, "citizenship")).get() == w
        )
    # Indexes of different purposes are unrelated.
    assert crypto.blind_index("123", "citizenship") != crypto.blind_index("123", "nid")


def test_update_fields_save_keeps_hash_in_sync():
    w = f.WorkerFactory(citizenship_no="111")
    w.citizenship_no = "222"
    w.save(update_fields=["citizenship_no"])
    w.refresh_from_db()
    assert w.citizenship_no_hash == crypto.blind_index("222", "citizenship")


def test_ops_search_by_citizenship_number(staff_client):
    w = f.WorkerFactory(citizenship_no="51-07-89-97643")
    f.WorkerFactory(citizenship_no="99-99")
    res = staff_client.get("/api/v1/ops/workers", {"q": "51078997643"})
    assert [r["id"] for r in res.json()["results"]] == [str(w.id)]


def test_key_rotation(settings):
    from cryptography.fernet import Fernet

    w = f.WorkerFactory(citizenship_no="A-1")
    old_token = raw("citizenship_no", w.pk)
    settings.FIELD_ENCRYPTION_KEYS = [
        Fernet.generate_key().decode(),
        crypto._derived_key("field-encryption").decode(),
    ]
    crypto.reset_caches()
    try:
        call_command("rotate_field_keys", stdout=open("/dev/null", "w"))
        assert raw("citizenship_no", w.pk) != old_token
        assert Worker.objects.get(pk=w.pk).citizenship_no == "A-1"
    finally:
        crypto.reset_caches()


def test_production_requires_keys(settings):
    from django.core.exceptions import ImproperlyConfigured

    settings.FIELD_KEYS_REQUIRED = True
    settings.FIELD_ENCRYPTION_KEYS = []
    crypto.reset_caches()
    try:
        with pytest.raises(ImproperlyConfigured):
            crypto.encrypt("x")
    finally:
        crypto.reset_caches()
