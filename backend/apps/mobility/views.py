"""Mobility endpoints (docs/CONTRACT-EXTENSIONS.md §5).

Worker: /me/mobility/documents (CRUD), /me/mobility/agencies, /me/mobility/shares.
Ops: /ops/mobility/documents (queue + verify), /ops/mobility/agencies (+ compliance).
Every worker-facing response carries ``safety_guidance``.
"""

from __future__ import annotations

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import pgettext
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.exceptions import APIError, InvalidState
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsOpsStaff
from apps.workers.me_views import current_worker

from . import services
from .models import ClearanceDocument, TravelDocument
from .safety import safety_guidance
from .serializers import (
    ComplianceSerializer,
    DocumentWriteSerializer,
    ShareCreateSerializer,
    VerifySerializer,
)

OPS_PERMS = [IsAuthenticated, IsOpsStaff]
TRAVEL_FIELDS = ("kind", "number", "issuing_country", "issued_on", "expires_on")
CLEARANCE_FIELDS = ("kind", "title", "issuer", "reference_no", "score_or_level", "issued_on", "expires_on")


def with_safety(data: dict) -> dict:
    return {**data, "safety_guidance": safety_guidance()}


def listing(items: list) -> dict:
    return with_safety({"count": len(items), "next": None, "previous": None, "results": items})


def _audit_view(doc) -> dict:
    return {"kind_group": doc.KIND_GROUP, "kind": doc.kind, "status": doc.status}


# =========================================================================== worker
class MeDocumentsView(APIView):
    def get(self, request):
        worker = current_worker(request)
        docs = services.worker_documents(worker)
        return Response(listing([services.document_dict(d, request) for d in docs]))

    def post(self, request):
        worker = current_worker(request)
        s = DocumentWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        file = services.validate_document_upload(d.pop("document", None))
        group = d.pop("kind_group")
        if group == "travel":
            doc = TravelDocument(worker=worker, **{k: d[k] for k in TRAVEL_FIELDS if k in d})
        else:
            fields = {k: d[k] for k in CLEARANCE_FIELDS if k in d}
            fields["title"] = (fields.get("title") or "").strip() or str(
                services.labels.KIND.get(d["kind"], d["kind"])
            )
            doc = ClearanceDocument(worker=worker, **fields)
        doc.status = "pending"
        if file is not None:
            doc.document.save(getattr(file, "name", "document"), file, save=False)
        doc.save()
        log(request, "mobility.document.create", doc, organization=None, changes=_audit_view(doc))
        return Response(with_safety(services.document_dict(doc, request)), status=201)


class MeDocumentDetailView(APIView):
    def _get(self, request, doc_id):
        doc = services.get_document(doc_id, worker=current_worker(request))
        if doc is None:
            raise NotFound()
        return doc

    def get(self, request, doc_id):
        return Response(with_safety(services.document_dict(self._get(request, doc_id), request)))

    def patch(self, request, doc_id):
        doc = self._get(request, doc_id)
        if doc.status == "verified":
            raise InvalidState(
                message=pgettext(
                    "mobility", "A verified document cannot be edited. Add the new document instead."
                )
            )
        s = DocumentWriteSerializer(data=request.data, partial=True, instance_group=doc.KIND_GROUP)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        d.pop("kind_group", None)
        file = services.validate_document_upload(d.pop("document", None))
        allowed = TRAVEL_FIELDS if doc.KIND_GROUP == "travel" else CLEARANCE_FIELDS
        changed = []
        for k in allowed:
            if k in d:
                setattr(doc, k, d[k])
                changed.append(k)
        if file is not None:
            old = doc.document.name if doc.document else None
            doc.document.save(getattr(file, "name", "document"), file, save=False)
            if old:
                doc.document.storage.delete(old)
            changed.append("document")
        # Any edit sends the document back to the verification queue.
        doc.status, doc.verified_at, doc.verified_by = "pending", None, None
        doc.save()
        log(request, "mobility.document.update", doc, organization=None, changes={"fields": changed})
        return Response(with_safety(services.document_dict(doc, request)))

    def delete(self, request, doc_id):
        doc = self._get(request, doc_id)
        log(request, "mobility.document.delete", doc, organization=None, changes=_audit_view(doc))
        if doc.document:
            doc.document.delete(save=False)
        doc.delete()
        return Response(status=204)


class MeAgenciesView(APIView):
    def get(self, request):
        current_worker(request)
        items = [services.agency_public(p) for p in services.eligible_agencies_qs()]
        return Response(listing(items))


class MeSharesView(APIView):
    def get(self, request):
        from apps.partners.serializers import grant_dict

        worker = current_worker(request)
        items = [grant_dict(g) for g in services.worker_shares_qs(worker)]
        return Response(listing(items))

    def post(self, request):
        from apps.partners.models import Partner
        from apps.partners.serializers import grant_dict

        worker = current_worker(request)
        s = ShareCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        partner = Partner.objects.filter(pk=s.validated_data["partner_id"]).first()
        if partner is None:
            raise APIError(
                "validation_error", fields={"partner_id": [pgettext("mobility", "Agency not found.")]}
            )
        grant = services.create_share(worker, partner, s.validated_data["days"])
        log(
            request,
            "mobility.share.create",
            grant,
            organization=None,
            changes={
                "partner": str(partner.pk),
                "scopes": grant.scopes,
                "expires_at": grant.expires_at.isoformat(),
            },
        )
        return Response(with_safety(grant_dict(grant)), status=201)


# =========================================================================== ops
class OpsDocumentsView(APIView):
    permission_classes = OPS_PERMS

    def get(self, request):
        docs = services.ops_documents(request.query_params)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(docs, request, view=self)
        return paginator.get_paginated_response(
            [services.document_dict(d, request, for_ops=True) for d in page]
        )


class OpsDocumentVerifyView(APIView):
    permission_classes = OPS_PERMS

    def post(self, request, doc_id):
        doc = services.get_document(doc_id)
        if doc is None:
            raise NotFound()
        s = VerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        old = doc.status
        services.verify_document(
            doc, status=s.validated_data["status"], note=s.validated_data.get("note") or "", user=request.user
        )
        log(
            request,
            "ops.mobility.document.verify",
            doc,
            organization=None,
            changes={
                "kind_group": doc.KIND_GROUP,
                "kind": doc.kind,
                "worker": str(doc.worker_id),
                "status": {"from": old, "to": doc.status},
                "note": doc.note,
            },
        )
        _notify_result(doc)
        return Response(services.document_dict(doc, request, for_ops=True))


def _notify_result(doc) -> None:
    from .tasks import notify_worker

    if doc.status == "verified":
        en = f"KaamSathi: your {doc.title} has been verified."
        ne = f"कामसाथी: तपाईंको {services.labels.KIND.get(doc.kind, doc.title)} प्रमाणित भयो।"
    else:
        en = f"KaamSathi: your {doc.title} could not be verified. Open the app to see why."
        ne = "कामसाथी: तपाईंको कागजात प्रमाणित हुन सकेन। कारण हेर्न एप खोल्नुहोस्।"
    notify_worker(
        doc.worker, kind="mobility_verification", title_en=en, title_ne=ne, body_en=en, body_ne=ne, sms=False
    )


class OpsAgenciesView(APIView):
    permission_classes = OPS_PERMS

    def get(self, request):
        from apps.partners.models import Partner

        now = timezone.now()
        qs = (
            Partner.objects.filter(kind="recruitment_agency")
            .select_related("compliance_verified_by")
            .annotate(
                n_shares=Count(
                    "grants",
                    filter=Q(
                        grants__purpose="recruitment",
                        grants__revoked_at__isnull=True,
                        grants__expires_at__gt=now,
                    ),
                    distinct=True,
                )
            )
            .order_by("name")
        )
        p = request.query_params
        if p.get("compliance_status"):
            qs = qs.filter(compliance_status__in=p["compliance_status"].split(","))
        if p.get("q"):
            qs = qs.filter(Q(name__icontains=p["q"]) | Q(license_no__icontains=p["q"]))
        paginator = StandardPagination()
        page = paginator.paginate_queryset(list(qs), request, view=self)
        return paginator.get_paginated_response(
            [services.agency_ops_dict(a, active_shares=a.n_shares) for a in page]
        )


class OpsAgencyComplianceView(APIView):
    permission_classes = OPS_PERMS

    def post(self, request, partner_id):
        from apps.partners.models import Partner

        partner = get_object_or_404(Partner, pk=partner_id)
        s = ComplianceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        before = {
            "status": partner.compliance_status,
            "license_valid_until": partner.license_valid_until.isoformat()
            if partner.license_valid_until
            else None,
        }
        services.set_compliance(
            partner,
            status=d["status"],
            license_valid_until=d.get("license_valid_until"),
            license_no=d.get("license_no"),
            note=d.get("note") or "",
            user=request.user,
        )
        log(
            request,
            "ops.mobility.agency.compliance",
            partner,
            organization=None,
            changes={
                "before": before,
                "after": {
                    "status": partner.compliance_status,
                    "license_valid_until": partner.license_valid_until.isoformat()
                    if partner.license_valid_until
                    else None,
                },
                "note": partner.compliance_note,
            },
        )
        return Response(services.agency_ops_dict(partner))
