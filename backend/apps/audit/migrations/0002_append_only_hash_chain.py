"""Audit log becomes append-only and hash-chained (docs/CONTRACT-EXTENSIONS.md §1).

1. actor/organization lose their FK constraints (DO_NOTHING) so user/org deletion never rewrites rows;
2. seq/prev_hash/hash added and back-filled in (created_at, id) order;
3. a trigger rejects UPDATE and DELETE on audit_auditlog (reversible: dropped on migrate back).
"""

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

TRIGGER_SQL = """
CREATE OR REPLACE FUNCTION audit_auditlog_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_auditlog is append-only (% blocked)', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_auditlog_no_update_delete ON audit_auditlog;
CREATE TRIGGER audit_auditlog_no_update_delete
    BEFORE UPDATE OR DELETE ON audit_auditlog
    FOR EACH ROW EXECUTE FUNCTION audit_auditlog_append_only();
"""
DROP_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS audit_auditlog_no_update_delete ON audit_auditlog;
DROP FUNCTION IF EXISTS audit_auditlog_append_only();
"""


def backfill(apps, schema_editor):
    from apps.audit.models import GENESIS, compute_hash

    AuditLog = apps.get_model("audit", "AuditLog")
    prev = GENESIS
    seq = 0
    for row in AuditLog.objects.order_by("created_at", "id").iterator(chunk_size=2000):
        seq += 1
        row.seq = seq
        row.prev_hash = prev
        row.hash = compute_hash(row)
        AuditLog.objects.filter(pk=row.pk).update(seq=seq, prev_hash=prev, hash=row.hash)
        prev = row.hash


def trigger(sql):
    def run(apps, schema_editor):
        if schema_editor.connection.vendor == "postgresql":
            schema_editor.execute(sql, params=None)

    return run


class Migration(migrations.Migration):
    dependencies = [
        ("audit", "0001_initial"),
        ("orgs", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(trigger(DROP_TRIGGER_SQL), migrations.RunPython.noop),
        migrations.AlterField(
            model_name="auditlog",
            name="actor",
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="auditlog",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name="+",
                to="orgs.organization",
            ),
        ),
        migrations.AlterField(
            model_name="auditlog",
            name="created_at",
            field=models.DateTimeField(db_index=True, default=django.utils.timezone.now, editable=False),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="seq",
            field=models.BigIntegerField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="prev_hash",
            field=models.CharField(default="", editable=False, max_length=64),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="auditlog",
            name="hash",
            field=models.CharField(default="", editable=False, max_length=64),
            preserve_default=False,
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="auditlog",
            name="seq",
            field=models.BigIntegerField(editable=False, unique=True),
        ),
        migrations.RunPython(trigger(TRIGGER_SQL), trigger(DROP_TRIGGER_SQL)),
    ]
