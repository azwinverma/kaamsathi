"""Rating comments: flag, moderation, voiding (N004).

* The rated party may flag a comment: the worker flags an employer's comment about them
  (``POST /me/ratings/{id}/flag``); a manager flags a worker's comment about the organization
  (``POST /org/ratings/{id}/flag``). Flagged comments stay visible until ops decides.
* Ops: ``GET /ops/ratings?status=flagged|hidden|visible&voided=&rater=`` · ``POST …/{id}/hide|restore
  {note}`` (comment only — the score keeps counting) · ``POST …/{id}/void {reason}`` (the whole rating
  stops counting toward reliability / employer reputation). Every action is audited.
* Worker→employer comments are shown to the employer only anonymised and only once the org has
  ≥ 3 ratings (same threshold as ``employer_reputation``), so a single rater can't be identified.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core import labels as core_labels
from apps.core.exceptions import InvalidState
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsOpsStaff, OrgScopedMixin
from apps.workers import labels as worker_labels
from apps.workers.me_views import current_worker
from apps.workers.models import Rating

from . import labels
from .services import REPUTATION_MIN_RATINGS


def _dt(v):
    return timezone.localtime(v).isoformat() if v else None


def rating_payload(r: Rating, *, full: bool = False) -> dict:
    data = {
        "id": str(r.id),
        "rater": r.rater,
        "score_a": r.score_a,
        "score_b": r.score_b,
        "comment": r.comment if full else r.public_comment,
        "comment_status": r.comment_status,
        "comment_status_label": core_labels.label(worker_labels.COMMENT_STATUS, r.comment_status),
        "voided": r.voided,
        "created_at": _dt(r.created_at),
    }
    if full:  # ops view
        emp = r.employment
        data.update(
            {
                "employment_id": str(emp.id),
                "organization": {"id": str(emp.organization_id), "name": emp.organization.name},
                "worker": {"id": str(emp.worker_id), "full_name": emp.worker.full_name},
                "flag_reason": r.flag_reason,
                "flagged_at": _dt(r.flagged_at),
                "flagged_by": {"id": str(r.flagged_by_id), "full_name": r.flagged_by.full_name}
                if r.flagged_by_id
                else None,
                "moderation_note": r.moderation_note,
                "moderated_at": _dt(r.moderated_at),
                "void_reason": r.void_reason,
                "voided_at": _dt(r.voided_at),
            }
        )
    return data


class FlagSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)


class NoteSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class VoidSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)


def _flag(request, rating: Rating, reason: str, organization=None) -> Rating:
    with transaction.atomic():
        rating = Rating.objects.select_for_update().get(pk=rating.pk)
        if not rating.comment or rating.comment_status != "visible" or rating.voided:
            raise InvalidState(message=str(labels.MESSAGES["flag_not_allowed"]))
        rating.comment_status = "flagged"
        rating.flagged_by = request.user
        rating.flagged_at = timezone.now()
        rating.flag_reason = reason
        rating.save(update_fields=["comment_status", "flagged_by", "flagged_at", "flag_reason"])
    log(
        request,
        "rating.flag",
        rating,
        organization=organization,
        changes={"rater": rating.rater, "reason": reason},
    )
    return rating


def _rating_qs():
    return Rating.objects.select_related(
        "employment__organization", "employment__worker", "flagged_by", "moderated_by", "voided_by"
    )


# --------------------------------------------------------------------------- worker
class MeRatingsView(APIView):
    """``GET /me/ratings`` → ``{received: [...employer ratings of me], given: [...my ratings]}``."""

    def get(self, request):
        worker = current_worker(request)
        rows = _rating_qs().filter(employment__worker=worker)

        def row(r):
            d = rating_payload(r)
            d["employment_id"] = str(r.employment_id)
            d["organization"] = {
                "id": str(r.employment.organization_id),
                "name": r.employment.organization.name,
            }
            d["can_flag"] = r.rater == "employer" and bool(r.comment) and r.comment_status == "visible"
            return d

        return Response(
            {
                "received": [row(r) for r in rows if r.rater == "employer"],
                "given": [row(r) for r in rows if r.rater == "worker"],
            }
        )


class MeRatingFlagView(APIView):
    def post(self, request, rating_id):
        worker = current_worker(request)
        rating = _rating_qs().filter(pk=rating_id, employment__worker=worker, rater="employer").first()
        if rating is None:
            raise NotFound()
        s = FlagSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        rating = _flag(
            request, rating, s.validated_data["reason"], organization=rating.employment.organization
        )
        return Response(rating_payload(rating))


# --------------------------------------------------------------------------- employer
class OrgRatingsReceivedView(OrgScopedMixin, APIView):
    """``GET /org/ratings/received`` — anonymised worker ratings of this org (≥ 3 ratings, else empty)."""

    def get(self, request):
        qs = Rating.objects.filter(employment__organization=self.org, rater="worker", voided=False)
        count = qs.count()
        if count < REPUTATION_MIN_RATINGS:
            return Response({"count": count, "min_ratings": REPUTATION_MIN_RATINGS, "results": []})
        rows = []
        for r in qs.order_by("-created_at")[:200]:
            d = rating_payload(r)
            d["created_at"] = r.created_at.strftime("%Y-%m")  # month only — no exact timing
            d["can_flag"] = bool(r.comment) and r.comment_status == "visible"
            rows.append(d)
        return Response({"count": count, "min_ratings": REPUTATION_MIN_RATINGS, "results": rows})


class OrgRatingFlagView(OrgScopedMixin, APIView):
    def post(self, request, rating_id):
        rating = Rating.objects.filter(
            pk=rating_id, employment__organization=self.org, rater="worker", voided=False
        ).first()
        if rating is None:
            raise NotFound()
        s = FlagSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        rating = _flag(request, rating, s.validated_data["reason"], organization=self.org)
        d = rating_payload(rating)
        d["created_at"] = rating.created_at.strftime("%Y-%m")
        return Response(d)


# --------------------------------------------------------------------------- ops
OPS_PERMS = [IsAuthenticated, IsOpsStaff]


class OpsRatingsView(APIView):
    permission_classes = OPS_PERMS

    def get(self, request):
        p = request.query_params
        qs = _rating_qs()
        if p.get("status"):
            qs = qs.filter(comment_status__in=p["status"].split(","))
        if p.get("voided") in ("true", "false", "1", "0"):
            qs = qs.filter(voided=p["voided"] in ("true", "1"))
        if p.get("rater") in ("employer", "worker"):
            qs = qs.filter(rater=p["rater"])
        if p.get("organization"):
            qs = qs.filter(employment__organization_id=p["organization"])
        if p.get("worker"):
            qs = qs.filter(employment__worker_id=p["worker"])
        qs = qs.order_by("-flagged_at", "-created_at")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([rating_payload(r, full=True) for r in page])


class _OpsRatingAction(APIView):
    permission_classes = OPS_PERMS

    def rating(self, rating_id) -> Rating:
        r = _rating_qs().filter(pk=rating_id).first()
        if r is None:
            raise NotFound()
        return r


class OpsRatingModerateView(_OpsRatingAction):
    """``POST /ops/ratings/{id}/hide|restore {note?}``."""

    action_name = "hide"

    def post(self, request, rating_id):
        rating = self.rating(rating_id)
        s = NoteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        old = rating.comment_status
        new = "hidden" if self.action_name == "hide" else "visible"
        if not rating.comment or old == new:
            raise InvalidState()
        rating.comment_status = new
        rating.moderated_by = request.user
        rating.moderated_at = timezone.now()
        rating.moderation_note = s.validated_data.get("note") or None
        rating.save(update_fields=["comment_status", "moderated_by", "moderated_at", "moderation_note"])
        log(
            request,
            f"ops.rating.{self.action_name}",
            rating,
            organization=rating.employment.organization,
            changes={"comment_status": {"from": old, "to": new}, "note": rating.moderation_note},
        )
        return Response(rating_payload(_rating_qs().get(pk=rating.pk), full=True))


class OpsRatingVoidView(_OpsRatingAction):
    """``POST /ops/ratings/{id}/void {reason}`` — the rating stops counting toward any score."""

    def post(self, request, rating_id):
        rating = self.rating(rating_id)
        s = VoidSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if rating.voided:
            raise InvalidState(message=str(labels.MESSAGES["rating_voided"]))
        rating.voided = True
        rating.void_reason = s.validated_data["reason"]
        rating.voided_by = request.user
        rating.voided_at = timezone.now()
        rating.save(update_fields=["voided", "void_reason", "voided_by", "voided_at"])  # → trust recompute
        log(
            request,
            "ops.rating.void",
            rating,
            organization=rating.employment.organization,
            changes={"reason": rating.void_reason, "rater": rating.rater},
        )
        return Response(rating_payload(_rating_qs().get(pk=rating.pk), full=True))
