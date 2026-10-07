"""Private file access: short-lived signed URLs instead of public media URLs.

Uploaded documents (citizenship ID photos, worker photos, credential certificates, contract
PDFs, privacy exports) are personal data under the Individual Privacy Act 2075 and must never
be reachable by a guessable or long-lived URL. Serializers return

    signed_url(file_field, user, request=request)

which points at ``GET /api/v1/files/<token>``. The token is a ``django.core.signing`` value
(HMAC with SECRET_KEY) carrying the storage name, the user it was issued to and an optional
re-check rule; it expires after ``FILE_URL_TTL_SECONDS`` (default 10 min). The endpoint needs
no Authorization header (so ``<img src>`` and mobile ``Image.network`` work), but it re-checks
that the issuing user is still active and, for worker documents, still allowed to see them.

Authorisation happens **when the URL is issued**: only call ``signed_url`` for users that may
see the file. For worker files use ``worker_file_url`` which applies the rules below.

Who may see a worker's files:
* ``id_front`` / ``id_back`` (citizenship ID) — ops staff and the worker themself.
* ``photo`` — additionally members of an organisation that employs / employed the worker or
  to which the worker has been shortlisted (application past ``sourced``).
"""

from __future__ import annotations

import mimetypes
from typing import Any

from django.conf import settings
from django.core import signing
from django.core.files.storage import storages
from django.urls import reverse

SALT = "kaamsathi.files.v1"
WORKER_PUBLIC_FIELDS = frozenset({"photo"})  # visible to employers with a relationship
WORKER_FILE_FIELDS = frozenset({"photo", "id_front", "id_back"})


def ttl_seconds() -> int:
    return int(getattr(settings, "FILE_URL_TTL_SECONDS", 600))


def is_public_name(name: str) -> bool:
    """Files under PUBLIC_MEDIA_PREFIXES (e.g. org logos) may use their plain storage URL."""
    return any(name.startswith(p) for p in getattr(settings, "PUBLIC_MEDIA_PREFIXES", ()))


def private_storage():
    """Storage for new sensitive documents (``FileField(storage=private_storage)``)."""
    return storages["private"] if "private" in settings.STORAGES else storages["default"]


def _storage_alias(storage) -> str:
    for alias in settings.STORAGES:
        if alias == "staticfiles":
            continue
        try:
            if storages[alias] is storage:
                return alias
        except Exception:  # noqa: BLE001 - misconfigured alias; ignore
            continue
    return "default"


def _user_id(user) -> str | None:
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return str(user.pk)


def make_token(name: str, *, user=None, storage_alias: str = "default", check: str | None = None) -> str:
    payload: dict[str, Any] = {"n": name, "s": storage_alias}
    uid = _user_id(user)
    if uid:
        payload["u"] = uid
    if check:
        payload["c"] = check
    return signing.dumps(payload, salt=SALT, compress=True)


def read_token(token: str, *, max_age: int | None = None) -> dict:
    """Return the payload or raise ``signing.BadSignature`` / ``signing.SignatureExpired``."""
    return signing.loads(token, salt=SALT, max_age=max_age if max_age is not None else ttl_seconds())


def _absolute(path: str, request=None) -> str:
    base = getattr(settings, "API_PUBLIC_URL", "")
    if base:
        # API_PUBLIC_URL = "https://api.example.com" (no /api/v1); path already starts with /api/v1
        return base.rstrip("/") + path
    if request is not None:
        return request.build_absolute_uri(path)
    return path


def signed_url(file_field, user, request=None, *, check: str | None = None) -> str | None:
    """Short-lived URL for ``file_field`` issued to ``user`` (``None`` = anonymous capability).

    The caller is responsible for deciding that ``user`` may see the file.
    """
    if not file_field:
        return None
    name = getattr(file_field, "name", None)
    if not name:
        return None
    alias = _storage_alias(getattr(file_field, "storage", None))
    token = make_token(name, user=user, storage_alias=alias, check=check)
    return _absolute(reverse("file-download", kwargs={"token": token}), request)


def request_user(request):
    user = getattr(request, "user", None) if request is not None else None
    return user if user is not None and getattr(user, "is_authenticated", False) else None


# --------------------------------------------------------------------------- worker documents
def _employer_worker_ids(user, request=None) -> set:
    """Worker ids whose photo this employer user may see (cached per request)."""
    cache_attr = "_ks_photo_worker_ids"
    if request is not None and getattr(request, cache_attr, None) is not None:
        return getattr(request, cache_attr)
    from apps.hiring.models import Application
    from apps.orgs.models import Membership
    from apps.workforce.models import Employment

    membership = getattr(request, "_ks_membership", None) if request is not None else None
    if membership is not None:
        org_ids = [membership.organization_id]
    else:
        org_ids = list(
            Membership.objects.filter(user=user, is_active=True, organization__is_active=True).values_list(
                "organization_id", flat=True
            )
        )
    ids: set = set()
    if org_ids:
        ids.update(Employment.objects.filter(organization_id__in=org_ids).values_list("worker_id", flat=True))
        ids.update(
            Application.objects.filter(job__organization_id__in=org_ids)
            .exclude(stage="sourced")
            .values_list("worker_id", flat=True)
        )
    if request is not None:
        setattr(request, cache_attr, ids)
    return ids


def employer_can_see_worker(user, worker) -> bool:
    from apps.hiring.models import Application
    from apps.orgs.models import Membership
    from apps.workforce.models import Employment

    org_ids = Membership.objects.filter(user=user, is_active=True, organization__is_active=True).values_list(
        "organization_id", flat=True
    )
    return (
        Employment.objects.filter(organization_id__in=org_ids, worker=worker).exists()
        or Application.objects.filter(job__organization_id__in=org_ids, worker=worker)
        .exclude(stage="sourced")
        .exists()
    )


def can_view_worker_file(user, worker, field: str, request=None) -> bool:
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if field not in WORKER_FILE_FIELDS:
        return False
    if user.is_staff:
        return True
    if worker.user_id and worker.user_id == user.pk:
        return True
    if field not in WORKER_PUBLIC_FIELDS:
        return False
    if request is not None:
        return worker.pk in _employer_worker_ids(user, request)
    return employer_can_see_worker(user, worker)


def worker_file_url(request, worker, field: str) -> str | None:
    """Signed URL for ``worker.<field>`` if the request user may see it, else ``None``."""
    file_field = getattr(worker, field, None)
    if not file_field:
        return None
    user = request_user(request)
    if not can_view_worker_file(user, worker, field, request):
        return None
    return signed_url(file_field, user, request, check=f"worker:{worker.pk}:{field}")


_CHECKS: dict = {}


def register_check(kind: str, fn) -> None:
    """Let other apps re-check access at download time.

    ``fn(rest: str, user, name: str) -> bool`` is called for tokens issued with
    ``signed_url(..., check=f"{kind}:{rest}")``, e.g. ``check=f"credential:{credential.pk}"``.
    """
    _CHECKS[kind] = fn


def recheck(payload: dict, user) -> bool:
    """Re-run the issuing rule at download time (worker documents, registered checks)."""
    check = payload.get("c")
    if not check:
        return True
    kind, _, rest = check.partition(":")
    if kind in _CHECKS:
        return bool(_CHECKS[kind](rest, user, payload.get("n")))
    if kind == "worker":
        from apps.workers.models import Worker

        worker_id, _, field = rest.partition(":")
        worker = Worker.objects.filter(pk=worker_id).first()
        if worker is None or field not in WORKER_FILE_FIELDS:
            return False
        current = getattr(worker, field, None)
        # Replaced or deleted document → old links die immediately.
        if not current or current.name != payload.get("n"):
            return False
        return can_view_worker_file(user, worker, field)
    return False  # unknown rule → deny


def content_type_for(name: str) -> str:
    return mimetypes.guess_type(name)[0] or "application/octet-stream"
