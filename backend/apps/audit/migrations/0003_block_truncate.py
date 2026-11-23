"""Audit log: block TRUNCATE too (docs/CONTRACT-EXTENSIONS.md §1).

The row-level trigger from 0002 never fires for TRUNCATE, and an emptied table verifies as a
fresh chain, so a full wipe went unnoticed. A statement-level trigger refuses it.
"""

from django.db import migrations

TRIGGER_SQL = """
DROP TRIGGER IF EXISTS audit_auditlog_no_truncate ON audit_auditlog;
CREATE TRIGGER audit_auditlog_no_truncate
    BEFORE TRUNCATE ON audit_auditlog
    FOR EACH STATEMENT EXECUTE FUNCTION audit_auditlog_append_only();
"""
DROP_TRIGGER_SQL = "DROP TRIGGER IF EXISTS audit_auditlog_no_truncate ON audit_auditlog;"


def trigger(sql):
    def run(apps, schema_editor):
        if schema_editor.connection.vendor == "postgresql":
            schema_editor.execute(sql, params=None)

    return run


class Migration(migrations.Migration):
    dependencies = [("audit", "0002_append_only_hash_chain")]

    operations = [migrations.RunPython(trigger(TRIGGER_SQL), trigger(DROP_TRIGGER_SQL))]
