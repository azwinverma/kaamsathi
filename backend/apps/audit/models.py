"""Append-only, hash-chained audit trail.

* A Postgres trigger (migration 0002) rejects every UPDATE and DELETE on ``audit_auditlog``.
* Each row stores ``seq`` (gap-free, assigned under an advisory lock), ``prev_hash`` and
  ``hash = sha256(canonical JSON of the row incl. prev_hash)``; ``apps.audit.chain.verify()`` walks
  the chain and reports the first row that was altered, removed or re-ordered.
* ``actor``/``organization`` are kept as plain ids (no FK constraint, ``DO_NOTHING``) so deleting a
  user or organisation never has to rewrite audit rows.
"""

import hashlib
import ipaddress
import json
import uuid
from datetime import UTC

from django.conf import settings
from django.db import connection, models, transaction
from django.utils import timezone

GENESIS = "0" * 64
ADVISORY_LOCK_KEY = 0x4B53_4155  # "KSAU"


def _norm_ip(ip):
    if not ip:
        return None
    try:
        return ipaddress.ip_address(str(ip)).compressed
    except ValueError:
        return None


def canonical(row: dict) -> str:
    return json.dumps(row, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def compute_hash(obj) -> str:
    created = obj.created_at.astimezone(UTC).isoformat(timespec="microseconds") if obj.created_at else None
    row = {
        "id": str(obj.id),
        "seq": obj.seq,
        "actor_id": str(obj.actor_id) if obj.actor_id else None,
        "organization_id": str(obj.organization_id) if obj.organization_id else None,
        "action": obj.action,
        "object_type": obj.object_type,
        "object_id": obj.object_id,
        "changes": obj.changes,
        "ip": _norm_ip(obj.ip),
        "created_at": created,
        "prev_hash": obj.prev_hash,
    }
    return hashlib.sha256(canonical(row).encode()).hexdigest()


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seq = models.BigIntegerField(unique=True, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        null=True,
        blank=True,
        related_name="+",
    )
    organization = models.ForeignKey(
        "orgs.Organization",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        null=True,
        blank=True,
        related_name="+",
    )
    action = models.CharField(max_length=60, db_index=True)
    object_type = models.CharField(max_length=60)
    object_id = models.CharField(max_length=64, blank=True, default="")
    changes = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True, editable=False)
    prev_hash = models.CharField(max_length=64, editable=False)
    hash = models.CharField(max_length=64, editable=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action} {self.object_type}:{self.object_id}"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RuntimeError("AuditLog is append-only")
        # Normalise exactly as the database will return it, so the hash re-computes identically.
        self.changes = json.loads(json.dumps(self.changes or {}, default=str))
        self.ip = _norm_ip(self.ip)
        self.created_at = self.created_at or timezone.now()
        with transaction.atomic(using=kwargs.get("using") or "default"):
            if connection.vendor == "postgresql":
                with connection.cursor() as cur:
                    cur.execute("SELECT pg_advisory_xact_lock(%s)", [ADVISORY_LOCK_KEY])
            last = AuditLog.objects.order_by("-seq").values_list("seq", "hash").first()
            self.seq = (last[0] + 1) if last else 1
            self.prev_hash = last[1] if last else GENESIS
            self.hash = compute_hash(self)
            kwargs["force_insert"] = True
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("AuditLog is append-only")
