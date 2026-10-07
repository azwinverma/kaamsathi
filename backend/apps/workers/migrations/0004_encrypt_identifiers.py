"""Encrypt existing plaintext identifiers and fill blind indexes (see apps/core/crypto.py)."""

from django.db import migrations


def forwards(apps, schema_editor):
    from apps.core.crypto import blind_index

    Worker = apps.get_model("workers", "Worker")
    for w in Worker.objects.all().iterator():
        # Reading legacy plaintext returns it unchanged; saving through EncryptedCharField encrypts it.
        w.citizenship_no_hash = blind_index(w.citizenship_no, "citizenship")
        w.nid_no_hash = blind_index(w.nid_no, "nid")
        w.save(update_fields=["citizenship_no", "nid_no", "bank_account_no", "citizenship_no_hash", "nid_no_hash"])

    Organization = apps.get_model("orgs", "Organization")
    for o in Organization.objects.all().iterator():
        o.pan_hash = blind_index(o.pan_no, "pan")
        o.save(update_fields=["pan_no", "pan_hash"])


class Migration(migrations.Migration):
    dependencies = [
        ("workers", "0003_worker_citizenship_no_hash_worker_nid_no_hash_and_more"),
        ("orgs", "0002_organization_pan_doc_organization_pan_hash_and_more"),
    ]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
