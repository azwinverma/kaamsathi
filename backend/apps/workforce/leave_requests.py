"""Worker-requested leave (बिदा).

Worker: ``GET /me/leaves?status=`` (own requests across employers, newest first) ·
``POST /me/leaves {employment_id, leave_type, from_date, to_date, reason?}`` — active employment
only, ``to_date >= from_date``, at most ``MAX_DAYS`` days, not inside an approved/paid payroll
period, and not overlapping another pending/approved leave · ``POST /me/leaves/{id}/cancel``
(own *pending* request only → ``cancelled``).
The request lands as a normal ``LeaveRequest`` (``source="worker"``) in ``/org/leaves``, so the
existing approve/reject actions decide it (approval writes leave days to attendance as before).
Reviewers (managers + the site's supervisors) are notified of a new request; the worker of the
decision (``notify_decision``, called from ``LeaveViewSet``).
"""

from __future__ import annotations

import datetime as dt

from django.db import transaction
from django.db.models import Q
from django.utils import timezone, translation
from django.utils.translation import pgettext
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core import labels
from apps.core.bs import bs_str
from apps.core.exceptions import APIError, Duplicate, InvalidState
from apps.core.pagination import StandardPagination
from apps.core.permissions import MANAGERS
from apps.workers.me_views import current_worker

from .models import Employment, LeaveRequest
from .serializers import LeaveSerializer

MAX_DAYS = 120  # covers maternity leave (98 days) with room; longer gaps go through the employer


def _qs():
    return LeaveRequest.objects.select_related(
        "employment__worker", "employment__organization", "decided_by", "requested_by"
    ).order_by("-created_at")


def leave_payload(leave: LeaveRequest) -> dict:
    return LeaveSerializer(leave).data


class MeLeaveCreateSerializer(serializers.Serializer):
    employment_id = serializers.UUIDField()
    leave_type = serializers.ChoiceField(choices=[k for k, _ in LeaveRequest.TYPES])
    from_date = serializers.DateField()
    to_date = serializers.DateField()
    reason = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        start, end = attrs["from_date"], attrs["to_date"]
        if end < start:
            raise serializers.ValidationError(
                {"to_date": [pgettext("leave", "The last day must be on or after the first day.")]}
            )
        if (end - start).days + 1 > MAX_DAYS:
            raise serializers.ValidationError(
                {"to_date": [pgettext("leave", "Ask your employer directly for leave this long.")]}
            )
        return attrs


def _bilingual(fn):
    """(english, nepali) renderings of ``fn()`` — notifications carry both."""
    with translation.override("en"):
        en = fn()
    with translation.override("ne"):
        ne = fn()
    return str(en), str(ne)


def _range(leave: LeaveRequest, lang: str) -> str:
    if lang == "ne":
        start, end = bs_str(leave.from_date), bs_str(leave.to_date)
    else:
        start, end = leave.from_date.isoformat(), leave.to_date.isoformat()
    return start if start == end else f"{start} – {end}"


def _notify(user, kind, title, body, *, title_ne, body_ne, link, data, sms=False):
    if user is None:
        return
    from apps.notifications.services import notify

    notify(user, kind, title, body, title_ne=title_ne, body_ne=body_ne, link=link, data=data, sms=sms)


def notify_reviewers(leave: LeaveRequest) -> None:
    """Inbox + push to the org's managers and the supervisors of the worker's site (SMS stays off:
    reviewers act from the web or the supervisor app)."""
    from apps.orgs.models import Membership

    emp = leave.employment
    name = emp.worker.full_name
    type_en, type_ne = _bilingual(lambda: labels.label(labels.LEAVE_TYPE, leave.leave_type))
    members = Membership.objects.filter(organization_id=emp.organization_id, is_active=True).filter(
        Q(role__in=MANAGERS) | Q(role="supervisor", sites=emp.site_id)
    )
    for m in members.select_related("user").distinct():
        _notify(
            m.user,
            "leave_request",
            f"Leave request: {name}",
            f"{name} asked for {type_en.lower()} ({_range(leave, 'en')}, {leave.days:g} days).",
            title_ne=f"बिदा अनुरोध: {name}",
            body_ne=f"{name} ले {type_ne} माग्नुभएको छ ({_range(leave, 'ne')}, {leave.days:g} दिन)।",
            link="/app/leave",
            data={"leave_id": str(leave.id), "employment_id": str(emp.id)},
        )


def notify_decision(leave: LeaveRequest) -> None:
    """Tell the worker their leave was approved/rejected. Worker-requested leave also goes out by SMS
    (per the worker's SMS preference); employer-entered leave is inbox/push only."""
    worker = leave.employment.worker
    if not worker.user_id:
        return
    approved = leave.status == "approved"
    verb, verb_ne = ("approved", "स्वीकृत") if approved else ("rejected", "अस्वीकृत")
    type_en, type_ne = _bilingual(lambda: labels.label(labels.LEAVE_TYPE, leave.leave_type))
    note = leave.decision_note
    _notify(
        worker.user,
        "leave_decided",
        f"Leave {verb}",
        f"Your {type_en.lower()} ({_range(leave, 'en')}) was {verb}." + (f" Note: {note}" if note else ""),
        title_ne=f"बिदा {verb_ne}",
        body_ne=f"तपाईंको {type_ne} ({_range(leave, 'ne')}) {verb_ne} भयो।"
        + (f" टिप्पणी: {note}" if note else ""),
        link="/me/leaves",
        data={"leave_id": str(leave.id), "status": leave.status},
        sms=leave.source == "worker",
    )


# --------------------------------------------------------------------------- worker
class MeLeavesView(APIView):
    def get(self, request):
        worker = current_worker(request)
        qs = _qs().filter(employment__worker=worker)
        if request.query_params.get("status"):
            qs = qs.filter(status__in=request.query_params["status"].split(","))
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([leave_payload(lv) for lv in page])

    def post(self, request):
        from apps.payroll.services import is_month_locked

        worker = current_worker(request)
        s = MeLeaveCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        start, end = d["from_date"], d["to_date"]
        emp = (
            Employment.objects.select_related("organization", "worker")
            .filter(pk=d["employment_id"], worker=worker)
            .first()
        )
        if emp is None:
            raise APIError("validation_error", fields={"employment_id": ["This employment is not yours."]})
        if emp.status != "active" or start < emp.start_date or (emp.end_date and end > emp.end_date):
            raise InvalidState(message=pgettext("leave", "You are not employed here for these dates."))
        # same lock the approval path enforces, checked up front so the worker isn't left waiting
        day = start
        while day <= end:
            if is_month_locked(emp.organization, day):
                raise InvalidState(
                    message=pgettext("complete1", "Payroll for this month is approved; ask your employer.")
                )
            day += dt.timedelta(days=1)
        with transaction.atomic():
            Employment.objects.select_for_update().filter(pk=emp.pk).first()  # serialise per employment
            overlap = LeaveRequest.objects.filter(
                employment=emp, status__in=["pending", "approved"], from_date__lte=end, to_date__gte=start
            ).exists()
            if overlap:
                raise Duplicate(message=pgettext("leave", "You already have leave on some of these days."))
            leave = LeaveRequest.objects.create(
                employment=emp,
                leave_type=d["leave_type"],
                from_date=start,
                to_date=end,
                days=(end - start).days + 1,
                reason=d["reason"] or None,
                source="worker",
                requested_by=request.user,
            )
        log(
            request,
            "leave.request",
            leave,
            organization=emp.organization,
            changes={"type": leave.leave_type, "from": start.isoformat(), "to": end.isoformat()},
        )
        leave = _qs().get(pk=leave.pk)
        notify_reviewers(leave)
        return Response(leave_payload(leave), status=201)


class MeLeaveCancelView(APIView):
    def post(self, request, pk):
        worker = current_worker(request)
        with transaction.atomic():
            leave = LeaveRequest.objects.select_for_update().filter(pk=pk, employment__worker=worker).first()
            if leave is None:
                raise NotFound()
            if leave.status != "pending":
                raise InvalidState(message=pgettext("leave", "Only a pending request can be cancelled."))
            leave.status = "cancelled"
            leave.decided_by = request.user
            leave.decided_at = timezone.now()
            leave.save(update_fields=["status", "decided_by", "decided_at"])
        leave = _qs().get(pk=leave.pk)
        log(request, "leave.cancel", leave, organization=leave.employment.organization)
        return Response(leave_payload(leave))
