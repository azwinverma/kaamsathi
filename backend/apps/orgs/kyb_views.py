"""Employer verification (KYB) endpoints (docs/CONTRACT-EXTENSIONS.md §2).

* ``GET|POST /org/verification`` — owner/admin; multipart ``registration_no``, ``registration_doc``,
  ``pan_doc``, ``pan_no?`` → status ``pending``.
* ``GET /ops/employers?verification_status=&q=`` · ``GET /ops/employers/{id}`` (documents as signed
  URLs) · ``POST /ops/employers/{id}/verify {status: verified|rejected, note}``.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.crypto import blind_index
from apps.core.exceptions import InvalidState
from apps.core.permissions import ADMINS, IsOpsStaff, OrgScopedMixin
from apps.support import hooks

from . import kyb
from .models import Membership, Organization
from .serializers import OrganizationSerializer


class KYBSubmitSerializer(serializers.Serializer):
    registration_no = serializers.CharField(max_length=60)
    pan_no = serializers.CharField(max_length=20, required=False, allow_blank=True)
    registration_doc = serializers.FileField(required=False)
    pan_doc = serializers.FileField(required=False)


class OrgVerificationView(OrgScopedMixin, APIView):
    role_rules = {"get": ADMINS, "post": ADMINS}
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        return Response(kyb.verification_payload(self.org, request))

    def post(self, request):
        org = self.org
        if org.verification_status == "verified":
            raise InvalidState(message=str(kyb.MESSAGES["already_verified"]))
        s = KYBSubmitSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        missing = {
            field: [str(kyb.MESSAGES["doc_required"])]
            for field in kyb.DOC_FIELDS
            if not d.get(field) and not getattr(org, field)
        }
        if missing:
            raise serializers.ValidationError(missing)
        files = {}
        for field in kyb.DOC_FIELDS:
            if d.get(field):
                files[field] = hooks.validate_upload(d[field], kinds={"image", "pdf"}, max_mb=8)
        with transaction.atomic():
            org.registration_no = d["registration_no"].strip()
            if d.get("pan_no"):
                org.pan_no = d["pan_no"].strip()
            for field, upload in files.items():
                old = getattr(org, field)
                if old:
                    old.delete(save=False)
                getattr(org, field).save(upload.name, upload, save=False)
            org.verification_status = "pending"
            org.verification_note = ""
            org.verified_by = None
            org.verified_at = None
            org.save()
        log(
            request,
            "organization.kyb_submit",
            org,
            organization=org,
            changes={"registration_no": org.registration_no, "documents": sorted(files)},
        )
        for user in hooks.staff_with_role("verifier"):
            hooks.notify_user(
                user,
                "kyb_submitted",
                kyb.MESSAGES["kyb_submitted_title"],
                kyb.MESSAGES["kyb_submitted_body"],
                fmt={"org": org.name},
                link=f"/ops/employers?id={org.pk}",
                data={"organization_id": str(org.pk)},
            )
        return Response(kyb.verification_payload(org, request), status=201)


class EmployerVerifySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["verified", "rejected"])
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["status"] == "rejected" and not (attrs.get("note") or "").strip():
            raise serializers.ValidationError({"note": [str(kyb.MESSAGES["note_required"])]})
        return attrs


class OpsEmployerViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsOpsStaff]

    def get_queryset(self):
        qs = Organization.objects.select_related("district", "verified_by").annotate(
            members_count=Count("memberships", filter=Q(memberships__is_active=True), distinct=True),
            active_workers=Count("employments", filter=Q(employments__status="active"), distinct=True),
        )
        p = self.request.query_params
        if p.get("verification_status"):
            qs = qs.filter(verification_status__in=p["verification_status"].split(","))
        if p.get("q"):
            q = p["q"].strip()
            qs = qs.filter(
                Q(name__icontains=q) | Q(registration_no__iexact=q) | Q(pan_hash=blind_index(q, "pan"))
            )
        # pending reviews first, then rejected, unverified, verified; by name within a status
        rank = Case(
            When(verification_status="pending", then=Value(0)),
            When(verification_status="rejected", then=Value(1)),
            When(verification_status="unverified", then=Value(2)),
            default=Value(3),
            output_field=IntegerField(),
        )
        return qs.annotate(kyb_rank=rank).order_by("kyb_rank", "name")

    def payload(self, org, request):
        data = OrganizationSerializer(org, context={"request": request}).data
        data.update(kyb.verification_payload(org, request, staff=True))
        data["members_count"] = getattr(org, "members_count", None)
        data["active_workers"] = getattr(org, "active_workers", None)
        owner = (
            Membership.objects.filter(organization=org, role="owner", is_active=True)
            .select_related("user")
            .first()
        )
        data["owner"] = (
            {"id": str(owner.user_id), "full_name": owner.user.full_name, "phone": owner.user.phone}
            if owner
            else None
        )
        return data

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response([self.payload(o, request) for o in page])

    def retrieve(self, request, *args, **kwargs):
        org = self.get_object()
        log(request, "ops.employer.view_documents", org, organization=org, changes={})
        return Response(self.payload(org, request))

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        org = self.get_object()
        s = EmployerVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        old = org.verification_status
        org.verification_status = s.validated_data["status"]
        org.verification_note = (s.validated_data.get("note") or "").strip()
        org.verified_by = request.user
        org.verified_at = timezone.now()
        org.save(update_fields=["verification_status", "verification_note", "verified_by", "verified_at"])
        log(
            request,
            "ops.employer.verify",
            org,
            organization=org,
            changes={
                "verification_status": {"from": old, "to": org.verification_status},
                "note": org.verification_note,
            },
        )
        verified = org.verification_status == "verified"
        for m in Membership.objects.filter(
            organization=org, is_active=True, role__in=["owner", "admin"]
        ).select_related("user"):
            hooks.notify_user(
                m.user,
                "kyb_decision",
                kyb.MESSAGES["kyb_verified_title" if verified else "kyb_rejected_title"],
                kyb.MESSAGES["kyb_verified_body" if verified else "kyb_rejected_body"],
                fmt={"org": org.name},
                link="/app/verification",
                data={"organization_id": str(org.pk), "status": org.verification_status},
                sms=True,
            )
        return Response(self.payload(self.get_queryset().get(pk=org.pk), request))
