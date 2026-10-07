"""Field-level encryption and blind indexes for sensitive identifiers.

Citizenship, NID, passport, PAN and bank account numbers are stored encrypted (Fernet, AES-128-CBC +
HMAC) so a database dump alone does not reveal them. Exact-match lookups and duplicate detection use
a keyed HMAC "blind index" of the normalised value, never the plaintext.

Keys (docs/SECURITY.md):
- ``FIELD_ENCRYPTION_KEYS``: comma-separated Fernet keys, newest first. Old keys stay listed until
  ``manage.py rotate_field_keys`` has re-encrypted every row.
- ``FIELD_HASH_KEY``: secret for blind indexes. Changing it requires recomputing every ``*_hash``.
Outside production (``FIELD_KEYS_REQUIRED`` is set only in prod settings) both are derived from
SECRET_KEY so local setups and tests need no extra config.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models

PREFIX = "enc1:"


def _derived_key(purpose: str) -> bytes:
    digest = hashlib.sha256(f"{purpose}:{settings.SECRET_KEY}".encode()).digest()
    return base64.urlsafe_b64encode(digest)


@lru_cache(maxsize=1)
def _fernet() -> MultiFernet:
    keys = [k.strip() for k in getattr(settings, "FIELD_ENCRYPTION_KEYS", []) if k.strip()]
    if not keys:
        if getattr(settings, "FIELD_KEYS_REQUIRED", False):
            raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS must be set in production.")
        keys = [_derived_key("field-encryption").decode()]
    return MultiFernet([Fernet(k.encode()) for k in keys])


@lru_cache(maxsize=1)
def _hash_key() -> bytes:
    key = getattr(settings, "FIELD_HASH_KEY", "")
    if not key:
        if getattr(settings, "FIELD_KEYS_REQUIRED", False):
            raise ImproperlyConfigured("FIELD_HASH_KEY must be set in production.")
        return _derived_key("blind-index")
    return key.encode()


def reset_caches() -> None:
    """For tests and key rotation."""
    _fernet.cache_clear()
    _hash_key.cache_clear()


def encrypt(value: str | None) -> str | None:
    if value in (None, ""):
        return value
    if str(value).startswith(PREFIX):
        return value
    return PREFIX + _fernet().encrypt(str(value).encode()).decode()


def decrypt(value: str | None) -> str | None:
    if value in (None, "") or not str(value).startswith(PREFIX):
        return value  # empty, or legacy plaintext awaiting migration
    try:
        return _fernet().decrypt(value[len(PREFIX) :].encode()).decode()
    except InvalidToken as exc:
        raise ImproperlyConfigured("Cannot decrypt a field: is the right FIELD_ENCRYPTION_KEYS set?") from exc


def rotate(value: str | None) -> str | None:
    """Re-encrypt with the newest key."""
    if value in (None, "") or not str(value).startswith(PREFIX):
        return encrypt(value)
    return PREFIX + _fernet().rotate(value[len(PREFIX) :].encode()).decode()


def normalise_identifier(value: str | None) -> str:
    """Upper-case, Latin digits, no spaces or separators: "५१-०७/८९ 97643" → "51078997643"."""
    if not value:
        return ""
    value = str(value).translate(str.maketrans("०१२३४५६७८९", "0123456789"))
    return re.sub(r"[\s\-/._]", "", value).upper()


def blind_index(value: str | None, purpose: str) -> str | None:
    """Keyed hash for exact-match lookup; ``purpose`` keeps indexes of different fields unrelated."""
    norm = normalise_identifier(value)
    if not norm:
        return None
    return hmac.new(_hash_key(), f"{purpose}:{norm}".encode(), hashlib.sha256).hexdigest()


def mask(value: str | None, visible: int = 3) -> str:
    """For display to non-ops users and logs: "51-07-89-97643" → "•••••••••••643"."""
    if not value:
        return ""
    value = str(value)
    return "•" * max(len(value) - visible, 0) + value[-visible:]


class EncryptedCharField(models.TextField):
    """Text column holding ``enc1:<fernet token>``; Python code sees plaintext.

    Not filterable by value (each encryption differs) — pair it with a ``*_hash`` blind index.
    Legacy plaintext rows still read correctly until migrated.
    """

    description = "Encrypted string"

    def __init__(self, *args, max_length=None, **kwargs):
        # max_length is accepted for drop-in replacement of CharField and validated on the plaintext.
        self.plain_max_length = max_length
        super().__init__(*args, **kwargs)

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        if self.plain_max_length is not None:
            kwargs["max_length"] = self.plain_max_length
        return name, path, args, kwargs

    def from_db_value(self, value, expression, connection):
        return decrypt(value)

    def to_python(self, value):
        return decrypt(value) if isinstance(value, str) else value

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        return encrypt(value) if value not in (None, "") else value

    def formfield(self, **kwargs):
        from django import forms

        return super().formfield(
            **{"form_class": forms.CharField, "max_length": self.plain_max_length, **kwargs}
        )
