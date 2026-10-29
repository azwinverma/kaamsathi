"""Django storage that keeps uploads in Postgres (``StoredFile``): ``MEDIA_STORAGE=database``.

For serverless hosting (Vercel), where the disk is read-only and wiped between requests and no
object storage is configured. Everything above the storage layer stays the same: private files
are still reached only through signed ``/api/v1/files/<token>`` links (``apps.core.files``), and
``PUBLIC_MEDIA_PREFIXES`` (org logos) are served by ``PublicMediaView``.

Not for large volumes: every byte lives in the database (and its backups). On a VPS use the
default disk storage; at scale use S3-compatible storage.
"""

from __future__ import annotations

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class DatabaseStorage(Storage):
    def __init__(self, location: str = ""):
        self.location = location.strip("/")

    def _key(self, name: str) -> str:
        name = name.replace("\\", "/").lstrip("/")
        return f"{self.location}/{name}" if self.location else name

    @staticmethod
    def _model():
        from .models import StoredFile

        return StoredFile

    def _open(self, name, mode="rb"):
        row = self._model().objects.filter(pk=self._key(name)).only("content").first()
        if row is None:
            raise FileNotFoundError(name)
        f = ContentFile(bytes(row.content))
        f.name = name
        return f

    def _save(self, name, content):
        if hasattr(content, "seek"):
            content.seek(0)
        data = content.read()
        if isinstance(data, str):
            data = data.encode()
        self._model().objects.update_or_create(
            pk=self._key(name), defaults={"content": data, "size": len(data)}
        )
        return name

    def exists(self, name):
        return self._model().objects.filter(pk=self._key(name)).exists()

    def delete(self, name):
        if name:
            self._model().objects.filter(pk=self._key(name)).delete()

    def size(self, name):
        row = self._model().objects.filter(pk=self._key(name)).only("size").first()
        if row is None:
            raise FileNotFoundError(name)
        return row.size

    def url(self, name):
        # Only public prefixes are ever linked directly (apps.core.serializers); served by
        # PublicMediaView. Private files get signed /files/<token> URLs instead.
        return f"{settings.MEDIA_URL.rstrip('/')}/{name.lstrip('/')}"

    def get_created_time(self, name):
        row = self._model().objects.filter(pk=self._key(name)).only("created_at").first()
        if row is None:
            raise FileNotFoundError(name)
        return row.created_at

    get_modified_time = get_created_time

    def listdir(self, path):
        prefix = self._key(path).rstrip("/") + "/" if path else (f"{self.location}/" if self.location else "")
        dirs, files = set(), []
        for key in self._model().objects.filter(pk__startswith=prefix).values_list("pk", flat=True):
            rest = key[len(prefix) :]
            if "/" in rest:
                dirs.add(rest.split("/", 1)[0])
            else:
                files.append(rest)
        return sorted(dirs), sorted(files)
