"""Input validation for mobility endpoints (outputs are plain dicts in services.py)."""

from __future__ import annotations

from django.utils.translation import pgettext_lazy
from rest_framework import serializers

from apps.core.bs import today_ad
from apps.core.crypto import normalise_identifier
from apps.core.serializers import FlexibleDateField

from . import labels


class DocumentWriteSerializer(serializers.Serializer):
    """Create (``partial=False``) or edit (``partial=True``) a travel or clearance document."""

    kind_group = serializers.ChoiceField(choices=list(labels.KIND_GROUP.keys()))
    kind = serializers.ChoiceField(choices=list(labels.KIND.keys()))
    number = serializers.CharField(max_length=40, required=False, allow_blank=True)
    issuing_country = serializers.RegexField(r"^[A-Za-z]{2}$", required=False)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    issuer = serializers.CharField(max_length=200, required=False, allow_blank=True)
    reference_no = serializers.CharField(max_length=60, required=False, allow_blank=True, allow_null=True)
    score_or_level = serializers.CharField(max_length=40, required=False, allow_blank=True, allow_null=True)
    issued_on = FlexibleDateField(required=False, allow_null=True)
    expires_on = FlexibleDateField(required=False, allow_null=True)
    document = serializers.FileField(required=False, allow_null=True)

    def __init__(self, *args, instance_group=None, **kwargs):
        self.instance_group = instance_group
        super().__init__(*args, **kwargs)
        if self.partial:
            self.fields["kind_group"].required = False
            self.fields["kind"].required = False

    def validate(self, attrs):
        group = attrs.get("kind_group") or self.instance_group
        if self.instance_group and attrs.get("kind_group") and attrs["kind_group"] != self.instance_group:
            raise serializers.ValidationError(
                {"kind_group": [pgettext_lazy("mobility", "The document group cannot be changed.")]}
            )
        kind = attrs.get("kind")
        group_kinds = labels.TRAVEL_KIND if group == "travel" else labels.CLEARANCE_KIND
        if kind and kind not in group_kinds:
            raise serializers.ValidationError(
                {"kind": [pgettext_lazy("mobility", "This kind does not belong to the chosen group.")]}
            )
        errors = {}
        if not self.partial:
            if group == "travel" and not (attrs.get("number") or "").strip():
                errors["number"] = [pgettext_lazy("mobility", "Enter the document number.")]
            if group == "clearance":
                if not (attrs.get("issuer") or "").strip():
                    errors["issuer"] = [pgettext_lazy("mobility", "Enter who issued it.")]
            if not attrs.get("document"):
                errors["document"] = [pgettext_lazy("mobility", "Upload a photo or PDF of the document.")]
        issued, expires = attrs.get("issued_on"), attrs.get("expires_on")
        if issued and expires and expires < issued:
            errors["expires_on"] = [pgettext_lazy("mobility", "Expiry date cannot be before the issue date.")]
        if issued and issued > today_ad():
            errors["issued_on"] = [pgettext_lazy("mobility", "Issue date cannot be in the future.")]
        if errors:
            raise serializers.ValidationError(errors)
        if "number" in attrs:
            attrs["number"] = normalise_identifier(attrs["number"])
        if "issuing_country" in attrs:
            attrs["issuing_country"] = attrs["issuing_country"].upper()
        return attrs


class VerifySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["verified", "rejected"])
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        if attrs["status"] == "rejected" and not (attrs.get("note") or "").strip():
            raise serializers.ValidationError(
                {"note": [pgettext_lazy("mobility", "Tell the worker why it was rejected.")]}
            )
        return attrs


class ShareCreateSerializer(serializers.Serializer):
    partner_id = serializers.UUIDField()
    days = serializers.IntegerField(min_value=1, max_value=90, required=False, default=30)


class ComplianceSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["unverified", "verified", "suspended"])
    license_valid_until = FlexibleDateField(required=False, allow_null=True)
    license_no = serializers.CharField(max_length=100, required=False, allow_blank=True)
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        if attrs["status"] == "suspended" and not (attrs.get("note") or "").strip():
            raise serializers.ValidationError(
                {"note": [pgettext_lazy("mobility", "Record why the agency is suspended.")]}
            )
        return attrs
