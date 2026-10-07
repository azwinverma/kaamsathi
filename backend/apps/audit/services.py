"""Audit trail helpers."""

from __future__ import annotations

import datetime as dt
import decimal
import uuid

from django.db import models
from django.db.models.fields.files import FieldFile

from .models import AuditLog


def _jsonable(value):
    if isinstance(value, (dt.date, dt.datetime, dt.time)):
        return value.isoformat()
    if isinstance(value, (decimal.Decimal, uuid.UUID)):
        return str(value)
    if isinstance(value, models.Model):
        return str(value.pk)
    if isinstance(value, FieldFile):  # hasattr(value, "url") raises ValueError when empty
        return value.name or None
    return value


def snapshot(instance) -> dict:
    data = {}
    for field in instance._meta.concrete_fields:
        data[field.attname] = _jsonable(getattr(instance, field.attname))
    return data


def diff(before: dict, after: dict) -> dict:
    return {k: {"from": before.get(k), "to": v} for k, v in after.items() if before.get(k) != v}


def client_ip(request):
    """Client IP, trusting X-Forwarded-For only for the configured number of proxies.

    Mirrors DRF throttling (REST_FRAMEWORK["NUM_PROXIES"]): the leftmost entries of the header are
    client-supplied and can be forged, so we take the address appended by our outermost proxy.
    """
    if request is None:
        return None
    from django.conf import settings

    num_proxies = settings.REST_FRAMEWORK.get("NUM_PROXIES")
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded and num_proxies:
        addrs = [a.strip() for a in forwarded.split(",") if a.strip()]
        if addrs:
            return addrs[-min(num_proxies, len(addrs))]
    return request.META.get("REMOTE_ADDR") or None


def log(request, action: str, obj=None, organization=None, changes=None, object_type=None):
    actor = getattr(request, "user", None) if request is not None else None
    if actor is not None and not actor.is_authenticated:
        actor = None
    if organization is None and obj is not None:
        organization = getattr(obj, "organization", None)
    return AuditLog.objects.create(
        actor=actor,
        organization=organization,
        action=action,
        object_type=object_type or (obj._meta.model_name if obj is not None else ""),
        object_id=str(obj.pk) if obj is not None else "",
        changes=changes or {},
        ip=client_ip(request),
    )


class AuditedViewSetMixin:
    """Writes AuditLog rows on create/update/destroy in DRF viewsets."""

    audit_prefix: str | None = None

    def _audit_name(self, verb):
        prefix = self.audit_prefix or self.get_queryset().model._meta.model_name
        return f"{prefix}.{verb}"

    def _audit_org(self, instance):
        org = getattr(instance, "organization", None)
        if org is None and hasattr(instance, "employment"):
            org = instance.employment.organization
        if org is None and hasattr(self, "org"):
            try:
                org = self.org
            except Exception:  # noqa: BLE001
                org = None
        return org

    def perform_create(self, serializer):
        instance = serializer.save(**self.get_create_kwargs())
        log(
            self.request,
            self._audit_name("create"),
            instance,
            organization=self._audit_org(instance),
            changes={"after": snapshot(instance)},
        )

    def get_create_kwargs(self) -> dict:
        return {}

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        instance = serializer.save()
        changes = diff(before, snapshot(instance))
        log(
            self.request,
            self._audit_name("update"),
            instance,
            organization=self._audit_org(instance),
            changes=changes,
        )

    def perform_destroy(self, instance):
        org = self._audit_org(instance)
        before = snapshot(instance)
        pk = instance.pk
        model_name = instance._meta.model_name
        instance.delete()
        AuditLog.objects.create(
            actor=self.request.user if self.request.user.is_authenticated else None,
            organization=org,
            action=self._audit_name("delete"),
            object_type=model_name,
            object_id=str(pk),
            changes={"before": before},
            ip=client_ip(self.request),
        )
