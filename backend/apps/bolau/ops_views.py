"""``/ops/bolau/*`` — staff role ``support`` (``apps/accounts/staff_roles.py``: "ops/bolau").

Bookings & requests search, disputes / no-shows queue (``?status=disputed,no_show``), Sipalu
suspension (audited), rating moderation, abuse reports, risk flags from the Bolau detectors, KPIs and
the booking-fee ledger. Every write is audited.
"""

from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.permissions import IsOpsStaff

from . import bookings, labels, ops, payloads
from .common import iso, money
from .models import Booking, BookingRating, BookingReport, SipaluProfile
from .views import booking_qs, paginate, request_qs, valid

OPS_PERMS = [IsAuthenticated, IsOpsStaff]


class _Ops(APIView):
    permission_classes = OPS_PERMS


class ReasonRequired(serializers.Serializer):
    reason = serializers.CharField(max_length=500)


class NoteIn(serializers.Serializer):
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


def _search(qs, request, fields):
    q = (request.query_params.get("q") or "").strip()
    if q:
        cond = Q()
        for f in fields:
            cond |= Q(**{f"{f}__icontains": q})
        qs = qs.filter(cond)
    status = request.query_params.get("status")
    if status:
        qs = qs.filter(status__in=status.split(","))
    return qs


class OpsBookingsView(_Ops):
    def get(self, request):
        qs = _search(
            booking_qs(),
            request,
            ["code", "sipalu__full_name", "sipalu__phone", "ghardhani__full_name", "ghardhani__phone"],
        )
        p = request.query_params
        if p.get("from"):
            qs = qs.filter(scheduled_start__date__gte=p["from"])
        if p.get("to"):
            qs = qs.filter(scheduled_start__date__lte=p["to"])
        if p.get("fee_status"):
            qs = qs.filter(booking_fee_status=p["fee_status"])
        return paginate(
            self, request, qs.order_by("-created_at"), lambda b: payloads.booking_dict(b, "ops", request)
        )


class OpsBookingDetailView(_Ops):
    def get(self, request, booking_id):
        b = get_object_or_404(booking_qs(), pk=booking_id)
        log(request, "bolau.ops.booking.view", b, organization=None)
        data = payloads.booking_dict(b, "ops", request, events=True)
        data["ratings"] = [
            payloads.rating_dict(r, full=True) for r in b.ratings.select_related("rater", "booking")
        ]
        data["reports"] = [
            {"id": str(r.id), "reason": r.reason, "reporter_side": r.reporter_side, "note": r.note or None,
             "created_at": iso(r.created_at)}
            for r in b.reports.all()
        ]  # fmt: skip
        data["disputes"] = [{"id": str(d.id), "status": d.status} for d in b.disputes.all()]
        return Response(data)


class OpsBookingCancelView(_Ops):
    def post(self, request, booking_id):
        b = get_object_or_404(Booking, pk=booking_id)
        reason = valid(ReasonRequired, request.data)["reason"]
        bookings.cancel(b, request.user, "ops", reason)
        log(request, "bolau.ops.booking.cancel", b, organization=None, changes={"reason": reason})
        return Response(payloads.booking_dict(booking_qs().get(pk=b.pk), "ops", request, events=True))


class OpsBookingResetArrivalView(_Ops):
    """Unlock the arrival code after 5 wrong tries (after ops spoke to both parties)."""

    def post(self, request, booking_id):
        b = get_object_or_404(Booking, pk=booking_id)
        note = valid(NoteIn, request.data)["note"]
        Booking.objects.filter(pk=b.pk).update(arrival_attempts=0)
        bookings._event(
            b, b.status, b.status, by=request.user, party="ops", note=f"arrival code unlocked {note}".strip()
        )
        log(request, "bolau.ops.booking.reset_arrival", b, organization=None, changes={"note": note})
        return Response(payloads.booking_dict(booking_qs().get(pk=b.pk), "ops", request, events=True))


class OpsRequestsView(_Ops):
    def get(self, request):
        qs = _search(request_qs(), request, ["code", "title", "ghardhani__full_name", "ghardhani__phone"])
        return paginate(
            self,
            request,
            qs.order_by("-created_at"),
            lambda r: {**payloads.request_dict(r, "ops", request, offers=list(r.offers.all())),
                       "ghardhani": {"id": str(r.ghardhani_id), "name": r.ghardhani.full_name}},
        )  # fmt: skip


def _sipalu_row(p: SipaluProfile, request) -> dict:
    return {
        **payloads.card(p, request),
        "worker_id": str(p.worker_id),
        "verification_status": p.worker.verification_status,
        "bolau_enabled": p.bolau_enabled,
        "suspended_at": iso(p.suspended_at),
        "suspension_reason": p.suspension_reason or None,
        "public_consent": p.public_consent_at is not None,
    }


class OpsSipaluView(_Ops):
    def get(self, request):
        qs = SipaluProfile.objects.select_related("worker").prefetch_related(
            "services", "worker__skills__trade"
        )
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(handle__icontains=q) | Q(worker__full_name__icontains=q) | Q(worker__phone__icontains=q)
            )
        if request.query_params.get("suspended") in ("1", "true"):
            qs = qs.filter(suspended_at__isnull=False)
        return paginate(self, request, qs.order_by("handle"), lambda p: _sipalu_row(p, request))


class OpsSipaluSuspendView(_Ops):
    def post(self, request, handle, action):
        profile = get_object_or_404(SipaluProfile.objects.select_related("worker"), handle=handle.lower())
        if action == "suspend":
            reason = valid(ReasonRequired, request.data)["reason"]
            profile = ops.suspend(profile, request.user, reason)
            log(request, "bolau.ops.sipalu.suspend", profile, organization=None, changes={"reason": reason})
        elif action == "unsuspend":
            note = valid(NoteIn, request.data)["note"]
            profile = ops.unsuspend(profile)
            log(request, "bolau.ops.sipalu.unsuspend", profile, organization=None, changes={"note": note})
        else:
            from django.http import Http404

            raise Http404
        return Response(_sipalu_row(profile, request))


class OpsRatingsView(_Ops):
    def get(self, request):
        qs = BookingRating.objects.select_related("booking", "rater").order_by("-created_at")
        p = request.query_params
        if p.get("status"):
            qs = qs.filter(comment_status=p["status"])
        if p.get("voided") in ("1", "true"):
            qs = qs.filter(voided=True)
        if p.get("side"):
            qs = qs.filter(side=p["side"])
        return paginate(self, request, qs, lambda r: payloads.rating_dict(r, full=True))


class OpsRatingModerateView(_Ops):
    def post(self, request, rating_id, action):
        r = get_object_or_404(BookingRating, pk=rating_id)
        if action not in ("hide", "restore", "void"):
            from django.http import Http404

            raise Http404
        if action == "void":
            note = valid(ReasonRequired, request.data)["reason"]
        else:
            note = valid(NoteIn, request.data)["note"]
        r = ops.moderate_rating(r, request.user, action, note)
        log(request, f"bolau.ops.rating.{action}", r, organization=None, changes={"note": note})
        return Response(
            payloads.rating_dict(
                BookingRating.objects.select_related("booking", "rater").get(pk=r.pk), full=True
            )
        )


class OpsReportsView(_Ops):
    def get(self, request):
        qs = BookingReport.objects.select_related("booking", "reporter").order_by("-created_at")
        if request.query_params.get("reason"):
            qs = qs.filter(reason=request.query_params["reason"])
        return paginate(
            self,
            request,
            qs,
            lambda r: {
                "id": str(r.id),
                "booking": {"id": str(r.booking_id), "code": r.booking.code},
                "reason": r.reason,
                "reason_label": labels.label(labels.REPORT_REASON, r.reason),
                "reporter_side": r.reporter_side,
                "note": r.note or None,
                "created_at": iso(r.created_at),
            },
        )


class OpsFlagsView(_Ops):
    def get(self, request):
        from apps.risk.models import FraudFlag

        qs = FraudFlag.objects.filter(
            kind__in=("booking_cancellations", "off_platform_payment", "review_fraud")
        ).order_by("-created_at")
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        return paginate(
            self,
            request,
            qs,
            lambda f: {
                "id": str(f.id),
                "subject_type": f.subject_type,
                "subject_id": f.subject_id,
                "kind": f.kind,
                "severity": f.severity,
                "status": f.status,
                "details": f.details,
                "created_at": iso(f.created_at),
            },
        )


class OpsKpisView(_Ops):
    def get(self, request):
        try:
            days = max(1, min(int(request.query_params.get("days", 30)), 365))
        except ValueError:
            days = 30
        return Response(ops.kpis(days))


class OpsFeesView(_Ops):
    def get(self, request):
        qs = Booking.objects.filter(fee_charge__isnull=False).select_related("ghardhani", "fee_charge")
        if request.query_params.get("status"):
            qs = qs.filter(booking_fee_status=request.query_params["status"])
        page = paginate(
            self,
            request,
            qs.order_by("-created_at"),
            lambda b: {
                "booking_id": str(b.id),
                "code": b.code,
                "charge_id": str(b.fee_charge_id),
                "payer": {"user_id": str(b.ghardhani_id), "name": b.ghardhani.full_name},
                "amount": money(b.booking_fee),
                "status": b.booking_fee_status,
                "status_label": labels.label(labels.FEE_STATUS, b.booking_fee_status),
                "provider": b.fee_provider or None,
                "reference": b.fee_reference or None,
                "paid_at": iso(b.fee_paid_at),
                "refund_manual": b.fee_refund_manual,
                "created_at": iso(b.created_at),
            },
        )
        page.data["totals"] = ops.fee_totals()
        return page
