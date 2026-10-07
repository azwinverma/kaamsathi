"""Re-encrypt every encrypted field with the newest FIELD_ENCRYPTION_KEYS entry (docs/RUNBOOK.md)."""

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.crypto import EncryptedCharField, rotate


class Command(BaseCommand):
    help = "Re-encrypt all EncryptedCharField values with the newest key. Safe to re-run."

    def handle(self, *args, **options):
        total = 0
        for model in apps.get_models():
            fields = [f.attname for f in model._meta.concrete_fields if isinstance(f, EncryptedCharField)]
            if not fields:
                continue
            table = model._meta.db_table
            pk = model._meta.pk.column
            from django.db import connection

            with transaction.atomic(), connection.cursor() as cur:
                cur.execute(f'SELECT "{pk}", {", ".join(f'"{f}"' for f in fields)} FROM "{table}"')
                for row in cur.fetchall():
                    new = [rotate(v) for v in row[1:]]
                    if new != list(row[1:]):
                        sets = ", ".join(f'"{f}" = %s' for f in fields)
                        cur.execute(f'UPDATE "{table}" SET {sets} WHERE "{pk}" = %s', [*new, row[0]])
                        total += 1
            self.stdout.write(f"{model._meta.label}: {', '.join(fields)}")
        self.stdout.write(self.style.SUCCESS(f"Re-encrypted {total} rows."))
