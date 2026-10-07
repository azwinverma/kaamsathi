"""Shared serializer building blocks."""

from __future__ import annotations

import datetime as dt

from rest_framework import serializers

from .bs import BSDateError, bs_str, parse_date_flexible


class BSDateField(serializers.ReadOnlyField):
    """Read-only ``*_bs`` field: renders the BS date for an AD date attribute."""

    def __init__(self, ad_source: str, **kwargs):
        kwargs["source"] = ad_source
        super().__init__(**kwargs)

    def to_representation(self, value):
        if value is None:
            return None
        if isinstance(value, dt.datetime):
            value = value.date()
        return bs_str(value)


class BSMixin:
    """Adds ``<name>_bs`` next to every DateField in the serialized output."""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for name, field in self.fields.items():
            if field.write_only:
                continue
            if isinstance(field, serializers.DateField) and not isinstance(field, serializers.DateTimeField):
                value = data.get(name)
                try:
                    data[f"{name}_bs"] = bs_str(dt.date.fromisoformat(value)) if value else None
                except (ValueError, BSDateError):
                    data[f"{name}_bs"] = None
        return data


class AliasMixin:
    """Accept alternate input keys: ``aliases = {"site": "site_id"}``."""

    aliases: dict = {}

    def to_internal_value(self, data):
        if self.aliases and hasattr(data, "keys"):
            data = data.copy() if hasattr(data, "copy") else dict(data)
            if hasattr(data, "dict"):
                data = data.dict()
            for alias, target in self.aliases.items():
                if alias in data and target not in data:
                    data[target] = data.pop(alias)
        return super().to_internal_value(data)


class BSModelSerializer(BSMixin, AliasMixin, serializers.ModelSerializer):
    pass


class FlexibleDateField(serializers.DateField):
    """Accepts ISO AD date; also BS when prefixed ``bs:`` (e.g. ``bs:2083-06-01``)."""

    def to_internal_value(self, value):
        if isinstance(value, str) and value.lower().startswith("bs:"):
            try:
                return parse_date_flexible(value[3:], "BS")
            except BSDateError as exc:
                raise serializers.ValidationError(str(exc)) from exc
        return super().to_internal_value(value)


class MoneyField(serializers.DecimalField):
    def __init__(self, **kwargs):
        kwargs.setdefault("max_digits", 12)
        kwargs.setdefault("decimal_places", 2)
        super().__init__(**kwargs)


def ref(obj, *fields):
    """Small nested reference dict, e.g. ``ref(site, "id", "name")``."""
    if obj is None:
        return None
    out = {}
    for f in fields:
        value = getattr(obj, f)
        out[f] = str(value) if f == "id" else value
    return out


def trade_ref(trade):
    if trade is None:
        return None
    return {"code": trade.code, "name_en": trade.name_en, "name_ne": trade.name_ne}


def district_ref(district):
    if district is None:
        return None
    return {"code": district.code, "name_en": district.name_en, "name_ne": district.name_ne}


def file_url(request, field):
    """URL for an uploaded file.

    Files under ``PUBLIC_MEDIA_PREFIXES`` (org logos) use their storage URL; everything else is
    private and gets a short-lived signed ``/files/<token>`` URL bound to the request user (see
    ``apps.core.files``). Callers must only render this for users allowed to see the file; for
    worker documents use ``apps.core.files.worker_file_url`` which applies the access rules.
    """
    if not field:
        return None
    from .files import is_public_name, request_user, signed_url

    if not is_public_name(field.name or ""):
        return signed_url(field, request_user(request), request)
    try:
        url = field.url
    except ValueError:
        return None
    return request.build_absolute_uri(url) if request is not None and url.startswith("/") else url
