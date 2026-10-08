"""Worker financial profile / offers / referrals and the ops finance console."""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import diff, log, snapshot
from apps.core import labels
from apps.core.idempotency import idempotent
from apps.core.money import money_str
from apps.core.permissions import IsOpsStaff
from apps.partners import labels as plabels
from apps.partners.views import paginate
from apps.workers.me_views import current_worker

from .models import FinancialProfile, Offer, Referral
from .serializers import ApplySerializer, OfferSerializer, offer_dict, profile_dict, referral_dict
from .services import apply_to_offer, build_profile, eligibility

OPS_PERMS = [IsAuthenticated, IsOpsStaff]


class MeFinancialProfileView(APIView):
    def get(self, request):
        return Response(profile_dict(build_profile(current_worker(request))))


class MeOffersView(APIView):
    def get(self, request):
        worker = current_worker(request)
        profile = build_profile(worker)
        open_refs = dict(
            Referral.objects.filter(worker=worker, status__in=Referral.OPEN).values_list("offer_id", "id")
        )
        qs = Offer.objects.filter(is_active=True, partner__is_active=True).select_related("partner")
        if request.query_params.get("kind"):
            qs = qs.filter(kind__in=request.query_params["kind"].split(","))
        out = []
        for o in qs:
            data = offer_dict(o)
            data.update(eligibility(o, profile))
            data["open_referral_id"] = str(open_refs[o.id]) if o.id in open_refs else None
            out.append(data)
        return Response(out)


class MeOfferApplyView(APIView):
    @idempotent
    def post(self, request, offer_id):
        worker = current_worker(request)
        offer = get_object_or_404(Offer.objects.select_related("partner"), pk=offer_id)
        s = ApplySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        referral = apply_to_offer(
            worker,
            offer,
            amount_requested=s.validated_data.get("amount_requested"),
            purpose_note=s.validated_data.get("purpose_note", ""),
            days=s.validated_data.get("days"),
        )
        log(request, "finance.referral.create", referral, organization=None)
        return Response(referral_dict(referral), status=201)


class MeReferralsView(APIView):
    def get(self, request):
        worker = current_worker(request)
        qs = Referral.objects.filter(worker=worker).select_related("offer", "partner", "grant")
        return paginate(self, request, qs, referral_dict)


# =========================================================================== ops
class OpsReferralsView(APIView):
    permission_classes = OPS_PERMS

    def get(self, request):
        qs = Referral.objects.select_related("offer", "partner", "worker", "grant")
        p = request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("partner"):
            qs = qs.filter(partner_id=p["partner"])
        if p.get("kind"):
            qs = qs.filter(offer__kind=p["kind"])
        return paginate(self, request, qs, lambda r: referral_dict(r, audience="ops"))


class OpsOfferViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = OPS_PERMS
    serializer_class = OfferSerializer
    http_method_names = ["get", "post", "patch"]
    lookup_value_regex = "[0-9a-f-]{36}"

    def get_queryset(self):
        qs = Offer.objects.select_related("partner")
        p = self.request.query_params
        if p.get("partner"):
            qs = qs.filter(partner_id=p["partner"])
        if p.get("kind"):
            qs = qs.filter(kind__in=p["kind"].split(","))
        if p.get("is_active") in ("true", "false"):
            qs = qs.filter(is_active=p["is_active"] == "true")
        return qs.order_by("partner__name", "title")

    def perform_create(self, serializer):
        offer = serializer.save()
        log(
            self.request,
            "ops.finance.offer.create",
            offer,
            organization=None,
            changes={"after": snapshot(offer)},
        )

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        offer = serializer.save()
        log(
            self.request,
            "ops.finance.offer.update",
            offer,
            organization=None,
            changes=diff(before, snapshot(offer)),
        )


APPROVED_LIKE = ("approved", "disbursed")


def _rate(approved: int, rejected: int):
    decided = approved + rejected
    return round(approved / decided, 3) if decided else None


class OpsFinanceSummaryView(APIView):
    permission_classes = OPS_PERMS

    def get(self, request):
        qs = Referral.objects.all()
        by_status = {k: 0 for k in plabels.REFERRAL_STATUS}
        for row in qs.values("status").annotate(n=Count("id")):
            by_status[row["status"]] = row["n"]
        approved_q = Q(status__in=APPROVED_LIKE) | Q(status="closed", amount_approved__isnull=False)
        approved = qs.filter(approved_q).count()
        rejected = by_status["rejected"]
        disbursed_total = qs.filter(
            Q(status="disbursed") | Q(status="closed", amount_approved__isnull=False)
        ).aggregate(s=Sum("amount_approved"))["s"] or Decimal("0")
        partners = []
        rows = (
            qs.values("partner_id", "partner__name")
            .annotate(
                total=Count("id"),
                approved=Count("id", filter=approved_q),
                rejected=Count("id", filter=Q(status="rejected")),
                open=Count("id", filter=Q(status__in=Referral.OPEN)),
                disbursed=Sum("amount_approved", filter=Q(status__in=["disbursed", "closed"])),
            )
            .order_by("-total")
        )
        for r in rows:
            partners.append(
                {
                    "partner": {"id": str(r["partner_id"]), "name": r["partner__name"]},
                    "total": r["total"],
                    "open": r["open"],
                    "approved": r["approved"],
                    "rejected": r["rejected"],
                    "approval_rate": _rate(r["approved"], r["rejected"]),
                    "disbursed_total": money_str(r["disbursed"] or 0),
                }
            )
        by_kind = [
            {
                "kind": r["offer__kind"],
                "kind_label": labels.label(plabels.OFFER_KIND, r["offer__kind"]),
                "total": r["n"],
            }
            for r in qs.values("offer__kind").annotate(n=Count("id")).order_by("-n")
        ]
        profiles = FinancialProfile.objects.filter(verified_months__gt=0)
        return Response(
            {
                "total": qs.count(),
                "by_status": [
                    {"status": k, "status_label": labels.label(plabels.REFERRAL_STATUS, k), "count": v}
                    for k, v in by_status.items()
                ],
                "by_partner": partners,
                "by_kind": by_kind,
                "approval_rate": _rate(approved, rejected),
                "disbursed_total": money_str(disbursed_total),
                "active_offers": Offer.objects.filter(is_active=True).count(),
                "workers_with_verified_earnings": profiles.count(),
                "note": "KaamSathi never lends or holds funds; amounts are reported by partners.",
            }
        )
