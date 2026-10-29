"""Copy uploads stored in Postgres (MEDIA_STORAGE=database) into the storages configured now.

Run on the new host (VPS disk or S3) with MEDIA_STORAGE unset, against the same database:

    python manage.py export_db_media            # dry run: counts only
    python manage.py export_db_media --apply    # copy (keeps names; skips files already there)

Rows under ``private/`` go to the "private" storage, the rest to "default". The StoredFile rows
are left in place; delete them yourself once the new storage is verified.
"""

from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.core.management.base import BaseCommand, CommandError

from apps.core.db_storage import DatabaseStorage
from apps.core.models import StoredFile


class Command(BaseCommand):
    help = "Copy database-stored uploads (MEDIA_STORAGE=database) into the current storages."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="copy (default: dry run)")

    def handle(self, *args, apply, **options):
        if isinstance(storages["default"], DatabaseStorage):
            raise CommandError("MEDIA_STORAGE is still 'database'; unset it so files go to disk or S3.")
        copied = skipped = 0
        for name in StoredFile.objects.order_by("name").values_list("name", flat=True).iterator():
            private = name.startswith("private/")
            alias, rel = ("private", name[len("private/") :]) if private else ("default", name)
            target = storages[alias]
            if target.exists(rel):
                skipped += 1
                continue
            if apply:
                content = StoredFile.objects.only("content").get(pk=name).content
                saved = target.save(rel, ContentFile(bytes(content)))
                if saved != rel:
                    raise CommandError(f"{rel} was saved as {saved}; stopping to keep links valid.")
            copied += 1
        verb = "Copied" if apply else "Would copy"
        self.stdout.write(f"{verb} {copied} file(s); {skipped} already present.")
