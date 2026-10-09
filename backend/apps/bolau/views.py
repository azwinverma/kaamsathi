"""Bolau endpoints (docs/CONTRACT-BOLAU.md). Business logic lives in the service modules
(``profiles``, ``onboarding``, ``bookings``, ``kaam``, ``payments``); views validate input, resolve the
caller's party (non-parties get 404 — no IDOR) and render ``payloads``.

Flag ``bolau`` off → public, discovery, booking and request endpoints 404; Sipalu profile editing,
Ghardhani profile and addresses keep working.
"""

from __future__ import annotations

import json

from django.db import transaction
from django.db.models import Prefetch
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.exceptions import APIError
from apps.core.idempotency import idempotent
from apps.core.pagination import StandardPagination
from apps.core.uploads import validate_upload

from . import bookings, kaam, labels, onboarding, payloads, payments, profiles, search
from .common import error, require_bolau
from .models import (
    Address,
    Booking,
    BookingRating,
    Favourite,
    KaamRequest,
    Offer,
    PortfolioItem,
    SipaluProfile,
    SipaluService,
    TimeOff,
)
from .telemetry import track

MONEY = {"max_digits": 10, "decimal_places": 2}


def paginate(view, request, items, fn):
    paginator = StandardPagination()
    page = paginator.paginate_queryset(items, request, view=view)
    return paginator.get_paginated_response([fn(x) for x in page])


def valid(cls, data, **kw):
    s = cls(data=data, **kw)
    s.is_valid(raise_exception=True)
    return s.validated_data


def my_profile(request) -> SipaluProfile:
    """The caller's SipaluProfile (lazily creating Worker + profile)."""
    profile = profiles.ensure_profile(request.user)
    return SipaluProfile.objects.select_related("worker", "worker__current_district").get(pk=profile.pk)


def existing_profile(request) -> SipaluProfile:
    profile = SipaluProfile.objects.select_related("worker").filter(worker__user=request.user).first()
    if profile is None:
        raise Http404
    return profile


# =========================================================================== input serializers
class SipaluPatch(serializers.Serializer):
    name = serializers.CharField(max_length=150, required=False)
    name_ne = serializers.CharField(max_length=150, required=False, allow_blank=True)
    headline = serializers.CharField(max_length=80, required=False, allow_blank=True)
    headline_ne = serializers.CharField(max_length=80, required=False, allow_blank=True)
    bio = serializers.CharField(max_length=600, required=False, allow_blank=True)
    bio_ne = serializers.CharField(max_length=600, required=False, allow_blank=True)
    bolau_enabled = serializers.BooleanField(required=False)
    instant_booking = serializers.BooleanField(required=False)
    service_districts = serializers.ListField(child=serializers.SlugField(), required=False)
    service_municipality = serializers.CharField(max_length=120, required=False, allow_blank=True)
    service_radius_km = serializers.IntegerField(min_value=1, max_value=100, required=False, allow_null=True)
    base_lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    base_lng = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    gender_visible = serializers.BooleanField(required=False)
    public_indexable = serializers.BooleanField(required=False)
    years_total = serializers.IntegerField(min_value=0, max_value=60, required=False)


class HandleIn(serializers.Serializer):
    handle = serializers.CharField(max_length=40)


class ServiceIn(serializers.Serializer):
    trade = serializers.SlugField()
    title = serializers.CharField(max_length=120)
    title_ne = serializers.CharField(max_length=120, required=False, allow_blank=True)
    description = serializers.CharField(max_length=600, required=False, allow_blank=True)
    price_type = serializers.ChoiceField(choices=list(labels.PRICE_TYPE))
    price = serializers.DecimalField(**MONEY, min_value=0)
    visit_fee = serializers.DecimalField(**MONEY, min_value=0, required=False, allow_null=True)
    estimated_minutes = serializers.IntegerField(min_value=15, max_value=720, required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)
    order = serializers.IntegerField(min_value=0, max_value=100, required=False)

    def validate_trade(self, value):
        from apps.workers.models import Trade

        if not Trade.objects.filter(code=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown trade.")
        return value


class AvailabilityPut(serializers.Serializer):
    rules = onboarding.RuleRow(many=True)


class TimeOffIn(serializers.Serializer):
    from_date = serializers.DateField()
    to_date = serializers.DateField()
    note = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["to_date"] < attrs["from_date"]:
            raise serializers.ValidationError({"to_date": ["Must be on or after the start date."]})
        return attrs


class PortfolioIn(serializers.Serializer):
    caption = serializers.CharField(max_length=200, required=False, allow_blank=True)
    caption_ne = serializers.CharField(max_length=200, required=False, allow_blank=True)
    trade = serializers.SlugField(required=False, allow_null=True)


class OnboardingIn(serializers.Serializer):
    step = serializers.ChoiceField(choices=list(profiles.ONBOARDING_STEPS))


class GhardhaniPatch(serializers.Serializer):
    display_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    preferred_language = serializers.ChoiceField(choices=["en", "ne"], required=False)


class AddressIn(serializers.Serializer):
    label = serializers.ChoiceField(choices=list(labels.ADDRESS_LABEL), required=False)
    line = serializers.CharField(max_length=255)
    ward = serializers.IntegerField(min_value=1, max_value=40, required=False, allow_null=True)
    municipality = serializers.CharField(max_length=120)
    district = serializers.SlugField()
    landmark = serializers.CharField(max_length=200, required=False, allow_blank=True, allow_null=True)
    lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    lng = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    is_default = serializers.BooleanField(required=False)

    def validate_district(self, value):
        from apps.geo.models import District

        d = District.objects.filter(code=value).first()
        if d is None:
            raise serializers.ValidationError("Unknown district.")
        return d


class BookingIn(serializers.Serializer):
    sipalu_handle = serializers.CharField(max_length=40)
    service_id = serializers.UUIDField(required=False, allow_null=True)
    trade = serializers.SlugField(required=False, allow_null=True)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    address_id = serializers.UUIDField()
    scheduled_start = serializers.DateTimeField()
    estimated_minutes = serializers.IntegerField(required=False, allow_null=True)


class ReasonIn(serializers.Serializer):
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class ArriveIn(serializers.Serializer):
    code = serializers.RegexField(r"^\d{4}$")


class QuoteIn(serializers.Serializer):
    amount = serializers.DecimalField(**MONEY, min_value=0)


class CompleteIn(serializers.Serializer):
    final_price = serializers.DecimalField(**MONEY, min_value=0, required=False, allow_null=True)
    note = serializers.CharField(max_length=600, required=False, allow_blank=True, default="")


class PaidIn(serializers.Serializer):
    method = serializers.ChoiceField(choices=list(labels.PAY_METHOD))


class RateIn(serializers.Serializer):
    score = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=600, required=False, allow_blank=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False, max_length=8)


class DisputeIn(serializers.Serializer):
    description = serializers.CharField(max_length=2000)


class SafetyIn(serializers.Serializer):
    safety_kind = serializers.ChoiceField(
        choices=["harassment", "unsafe_workplace", "payment_withholding", "other"]
    )
    description = serializers.CharField(max_length=4000)
    emergency = serializers.BooleanField(required=False, default=False)
    anonymous = serializers.BooleanField(required=False, default=False)


class ReportIn(serializers.Serializer):
    reason = serializers.ChoiceField(choices=list(labels.REPORT_REASON))
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class FlagIn(serializers.Serializer):
    reason = serializers.CharField(max_length=500)


class FeePayIn(serializers.Serializer):
    provider = serializers.ChoiceField(choices=list(payments.GATEWAYS))


class RequestIn(serializers.Serializer):
    trade = serializers.SlugField()
    title = serializers.CharField(max_length=120)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    address_id = serializers.UUIDField()
    preferred_window_start = serializers.DateTimeField()
    preferred_window_end = serializers.DateTimeField()
    budget_max = serializers.DecimalField(**MONEY, min_value=0, required=False, allow_null=True)

    def validate_trade(self, value):
        from apps.workers.models import Trade

        if not Trade.objects.filter(code=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown trade.")
        return value


class OfferIn(serializers.Serializer):
    price_type = serializers.ChoiceField(choices=list(labels.PRICE_TYPE))
    price = serializers.DecimalField(**MONEY, min_value=0)
    visit_fee = serializers.DecimalField(**MONEY, min_value=0, required=False, allow_null=True)
    estimated_minutes = serializers.IntegerField(min_value=15, max_value=720, required=False, default=60)
    message = serializers.CharField(max_length=600, required=False, allow_blank=True)
    proposed_start = serializers.DateTimeField()


# =========================================================================== Sipalu (/me/sipalu)
class MeSipaluView(APIView):
    def get(self, request):
        return Response(payloads.own_profile(my_profile(request), request))

    def patch(self, request):
        profile = my_profile(request)
        d = valid(SipaluPatch, request.data, partial=True)
        with transaction.atomic():
            w = profile.worker
            if "name" in d:
                w.full_name = d.pop("name").strip()
                w.save(update_fields=["full_name", "updated_at"])
            if "name_ne" in d:
                w.full_name_ne = d.pop("name_ne").strip() or None
                w.save(update_fields=["full_name_ne", "updated_at"])
            if "bolau_enabled" in d:
                profiles.set_bolau_enabled(profile, d.pop("bolau_enabled"))
            if "service_districts" in d:
                profile.service_districts.set(onboarding._districts(d.pop("service_districts")))
            for key in ("base_lat", "base_lng"):
                if key in d:
                    v = d.pop(key)
                    setattr(profile, key, round(v, 2) if v is not None else None)
            for key, value in d.items():
                setattr(profile, key, value)
            profile.save()
        log(
            request,
            "bolau.sipalu.update",
            profile,
            organization=None,
            changes={"fields": sorted(request.data)},
        )
        return Response(payloads.own_profile(my_profile(request), request))


class MeSipaluOnboardingView(APIView):
    def post(self, request):
        profile = my_profile(request)
        step = valid(OnboardingIn, request.data)["step"]
        data = request.data.get("data") if hasattr(request.data, "get") else None
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except ValueError as exc:
                raise APIError("validation_error", fields={"data": ["Invalid JSON."]}) from exc
        if data is None:  # multipart: the step's fields sit next to ``step``
            data = {k: v for k, v in request.data.items() if k != "step" and k not in request.FILES}
        onboarding.apply_step(profile, step, data, request.FILES)
        track("bolau_onboarding_step", request.user, step=step)
        profile = SipaluProfile.objects.select_related("worker").get(pk=profile.pk)
        return Response(profiles.onboarding_state(profile))


class MeSipaluHandleView(APIView):
    def post(self, request):
        profile = my_profile(request)
        old = profile.handle
        profile = profiles.change_handle(profile, valid(HandleIn, request.data)["handle"])
        log(
            request,
            "bolau.sipalu.handle",
            profile,
            organization=None,
            changes={"from": old, "to": profile.handle},
        )
        return Response({"handle": profile.handle, "handle_change_available_at": payloads.iso(
            profiles.handle_change_available_at(profile))})  # fmt: skip


class MeServicesView(APIView):
    def get(self, request):
        profile = my_profile(request)
        return Response([payloads.service_dict(s) for s in profile.services.select_related("trade")])

    def post(self, request):
        profile = my_profile(request)
        d = valid(ServiceIn, request.data)
        profiles.validate_service_data(d)
        s = SipaluService.objects.create(profile=profile, trade_id=d.pop("trade"), **d)
        return Response(
            payloads.service_dict(SipaluService.objects.select_related("trade").get(pk=s.pk)), status=201
        )


class MeServiceDetailView(APIView):
    def _get(self, request, service_id):
        return get_object_or_404(
            SipaluService.objects.select_related("trade"), pk=service_id, profile=existing_profile(request)
        )

    def get(self, request, service_id):
        return Response(payloads.service_dict(self._get(request, service_id)))

    def patch(self, request, service_id):
        s = self._get(request, service_id)
        d = valid(ServiceIn, request.data, partial=True)
        profiles.validate_service_data(d, s)
        if "trade" in d:
            s.trade_id = d.pop("trade")
        for k, v in d.items():
            setattr(s, k, v)
        s.save()
        return Response(payloads.service_dict(SipaluService.objects.select_related("trade").get(pk=s.pk)))

    def delete(self, request, service_id):
        s = self._get(request, service_id)
        s.is_active = False  # bookings keep their link; inactive services are hidden everywhere
        s.save(update_fields=["is_active"])
        return Response(status=204)


class MeAvailabilityView(APIView):
    def get(self, request):
        profile = my_profile(request)
        return Response({"rules": [payloads.rule_dict(r) for r in profile.availability.all()]})

    def put(self, request):
        profile = my_profile(request)
        d = valid(AvailabilityPut, request.data)
        rules = profiles.set_availability(profile, d["rules"])
        return Response(
            {"rules": [payloads.rule_dict(r) for r in sorted(rules, key=lambda r: (r.weekday, r.start_time))]}
        )


class MeTimeOffView(APIView):
    def get(self, request):
        profile = my_profile(request)
        return Response([payloads.time_off_dict(t) for t in profile.time_off.all()])

    def post(self, request):
        profile = my_profile(request)
        d = valid(TimeOffIn, request.data)
        t = TimeOff.objects.create(profile=profile, **d)
        return Response(payloads.time_off_dict(t), status=201)


class MeTimeOffDetailView(APIView):
    def delete(self, request, time_off_id):
        get_object_or_404(TimeOff, pk=time_off_id, profile=existing_profile(request)).delete()
        return Response(status=204)


class MePortfolioView(APIView):
    def get(self, request):
        profile = my_profile(request)
        return Response(
            [payloads.portfolio_dict(i, request) for i in profile.portfolio.select_related("trade")]
        )

    def post(self, request):
        profile = my_profile(request)
        if profiles.portfolio_full(profile):
            raise error("invalid_state", "portfolio_full")
        d = valid(PortfolioIn, request.data)
        f = request.FILES.get("image")
        if f is None:
            raise APIError("validation_error", fields={"image": ["Add a photo."]})
        f = validate_upload(f, kinds={"image"}, max_mb=8)
        item = PortfolioItem(
            profile=profile, caption=d.get("caption") or "", caption_ne=d.get("caption_ne") or ""
        )
        if d.get("trade"):
            item.trade_id = d["trade"]
        item.image.save(getattr(f, "name", "work.jpg"), f, save=False)
        item.save()
        return Response(payloads.portfolio_dict(item, request), status=201)


class MePortfolioDetailView(APIView):
    def _get(self, request, item_id):
        return get_object_or_404(PortfolioItem, pk=item_id, profile=existing_profile(request))

    def patch(self, request, item_id):
        item = self._get(request, item_id)
        d = valid(PortfolioIn, request.data, partial=True)
        for k in ("caption", "caption_ne"):
            if k in d:
                setattr(item, k, d[k] or "")
        if "trade" in d:
            item.trade_id = d["trade"]
        item.save()
        return Response(payloads.portfolio_dict(item, request))

    def delete(self, request, item_id):
        item = self._get(request, item_id)
        item.image.delete(save=False)
        item.delete()
        return Response(status=204)


# =========================================================================== public + discovery
class _Public(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "public"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_bolau()


class PublicSipaluView(_Public):
    def get(self, request, handle):
        profile = SipaluProfile.objects.select_related("worker").filter(handle=(handle or "").lower()).first()
        if profile is None or not profiles.is_public(profile):
            raise Http404
        try:
            from apps.trust.services import log_profile_view

            log_profile_view(profile.worker, context="passport")
        except Exception:  # noqa: BLE001
            pass
        resp = Response(payloads.public_profile(profile, request))
        resp["X-Robots-Tag"] = "index, follow" if profile.public_indexable else "noindex, nofollow"
        return resp


class SearchParams(serializers.Serializer):
    trade = serializers.SlugField(required=False)
    district = serializers.SlugField(required=False)
    q = serializers.CharField(max_length=80, required=False, allow_blank=True)
    date = serializers.DateField(required=False)
    time = serializers.TimeField(required=False)
    max_price = serializers.DecimalField(**MONEY, required=False)
    instant = serializers.BooleanField(required=False, default=False)
    min_rating = serializers.DecimalField(max_digits=3, decimal_places=2, required=False)
    language = serializers.CharField(max_length=8, required=False)
    gender = serializers.ChoiceField(choices=["male", "female", "other"], required=False)
    lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    lng = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)


class SearchView(_Public):
    def get(self, request):
        params = valid(SearchParams, request.query_params)
        results = search.search(params)
        return paginate(
            self,
            request,
            results,
            lambda r: {
                **payloads.card(r[1]["profile"], request, next_slot=r[1]["next"], distance_band=r[1]["band"],
                                top_trade=r[1]["top_trade"]),
                "score": r[0],
            },
        )  # fmt: skip


class TradesView(_Public):
    def get(self, request):
        return Response(search.trades_summary())


# =========================================================================== Ghardhani
class MeGhardhaniView(APIView):
    def _payload(self, g):
        return {
            "id": str(g.id),
            "display_name": g.display_name or None,
            "preferred_language": g.preferred_language,
            "phone": g.user.phone,
            "rating": profiles.ghardhani_rating(g.user),
            "created_at": payloads.iso(g.created_at),
        }

    def get(self, request):
        return Response(self._payload(profiles.ensure_ghardhani(request.user)))

    def patch(self, request):
        g = profiles.ensure_ghardhani(request.user)
        d = valid(GhardhaniPatch, request.data, partial=True)
        for k, v in d.items():
            setattr(g, k, v)
        g.save()
        return Response(self._payload(g))


def _set_default(user, address):
    if address.is_default:
        Address.objects.filter(ghardhani=user, is_active=True).exclude(pk=address.pk).update(is_default=False)


class MeAddressesView(APIView):
    def get(self, request):
        qs = Address.objects.filter(ghardhani=request.user, is_active=True).select_related("district")
        return Response([payloads.address_dict(a) for a in qs])

    def post(self, request):
        d = valid(AddressIn, request.data)
        profiles.ensure_ghardhani(request.user)
        with transaction.atomic():
            first = not Address.objects.filter(ghardhani=request.user, is_active=True).exists()
            a = Address.objects.create(
                ghardhani=request.user,
                label=d.get("label") or "home",
                line=d["line"],
                ward=d.get("ward"),
                municipality=d["municipality"],
                district=d["district"],
                landmark=d.get("landmark") or None,
                lat=d.get("lat"),
                lng=d.get("lng"),
                is_default=d.get("is_default", first) or first,
            )
            _set_default(request.user, a)
        return Response(payloads.address_dict(a), status=201)


class MeAddressDetailView(APIView):
    def _get(self, request, address_id):
        return get_object_or_404(
            Address.objects.select_related("district"), pk=address_id, ghardhani=request.user, is_active=True
        )

    def get(self, request, address_id):
        return Response(payloads.address_dict(self._get(request, address_id)))

    def patch(self, request, address_id):
        a = self._get(request, address_id)
        d = valid(AddressIn, request.data, partial=True)
        with transaction.atomic():
            for k, v in d.items():
                setattr(a, k, v)
            a.save()
            _set_default(request.user, a)
        return Response(payloads.address_dict(a))

    def delete(self, request, address_id):
        a = self._get(request, address_id)
        a.is_active = False  # bookings and requests keep their address
        a.is_default = False
        a.save(update_fields=["is_active", "is_default"])
        return Response(status=204)


class MeFavouritesView(APIView):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_bolau()

    def get(self, request):
        qs = (
            Favourite.objects.filter(ghardhani=request.user)
            .select_related("profile__worker")
            .prefetch_related("profile__services", "profile__worker__skills__trade")
        )
        return Response([payloads.card(f.profile, request) for f in qs if profiles.is_public(f.profile)])

    def post(self, request):
        handle = valid(HandleIn, request.data)["handle"].lower()
        profile = SipaluProfile.objects.select_related("worker").filter(handle=handle).first()
        if profile is None or not profiles.is_public(profile):
            raise Http404
        Favourite.objects.get_or_create(ghardhani=request.user, profile=profile)
        return Response(payloads.card(profile, request), status=201)


class MeFavouriteDetailView(APIView):
    def delete(self, request, handle):
        require_bolau()
        Favourite.objects.filter(ghardhani=request.user, profile__handle=handle.lower()).delete()
        return Response(status=204)


# =========================================================================== bookings
def booking_qs():
    return Booking.objects.select_related(
        "sipalu", "sipalu__sipalu", "ghardhani", "trade", "address__district", "service"
    ).prefetch_related("ratings", "events")


def party_booking(request, booking_id, *, party: str | None = None) -> tuple[Booking, str]:
    """The booking if the caller is a party (optionally a specific one); otherwise 404."""
    require_bolau()
    b = booking_qs().filter(pk=booking_id).first()
    who = bookings.party_of(b, request.user) if b else None
    if b is None or who is None or (party and who != party):
        raise Http404
    return b, who


def booking_response(request, b: Booking, viewer: str, status=200):
    b = booking_qs().get(pk=b.pk)
    return Response(payloads.booking_dict(b, viewer, request, events=True), status=status)


class BookingsView(APIView):
    @idempotent
    def post(self, request):
        require_bolau()
        d = valid(BookingIn, request.data)
        b = bookings.create_booking(request.user, d, request=request)
        log(
            request,
            "bolau.booking.create",
            b,
            organization=None,
            changes={"code": b.code, "status": b.status},
        )
        return booking_response(request, b, "ghardhani", status=201)


class BookingDetailView(APIView):
    def get(self, request, booking_id):
        b, who = party_booking(request, booking_id)
        return Response(payloads.booking_dict(b, who, request, events=True))


class BookingContactView(APIView):
    def get(self, request, booking_id):
        b, who = party_booking(request, booking_id)
        visible = bookings.contact_visible(b)
        other = b.sipalu.phone if who == "ghardhani" else b.ghardhani.phone
        from apps.core.phone import mask_phone

        if visible:
            log(request, "bolau.booking.contact", b, organization=None, changes={"party": who})
        return Response(
            {
                "visible": visible,
                "phone": other if visible else None,
                "phone_masked": mask_phone(other),
                "visible_until": payloads.iso(bookings.contact_visible_until(b)),
                "emergency_line": labels.EMERGENCY["line"],
            }
        )


GHARDHANI_ACTIONS = {"approve-quote", "reject-quote", "confirm", "cancel", "report-no-show"}
SHARED_ACTIONS = {"paid", "rate", "dispute", "safety-report", "report"}


class BookingActionView(APIView):
    """``POST /bolau/bookings/{id}/{action}`` — Ghardhani actions + actions open to either party."""

    def post(self, request, booking_id, action):
        if action not in GHARDHANI_ACTIONS | SHARED_ACTIONS:
            raise Http404
        b, who = party_booking(request, booking_id)
        if action in GHARDHANI_ACTIONS and who != "ghardhani":
            raise Http404
        user = request.user
        if action == "approve-quote":
            bookings.decide_quote(b, user, True)
        elif action == "reject-quote":
            bookings.decide_quote(b, user, False)
        elif action == "confirm":
            bookings.confirm(b, user)
        elif action == "cancel":
            bookings.cancel(b, user, "ghardhani", valid(ReasonIn, request.data)["reason"])
        elif action == "report-no-show":
            bookings.report_no_show(b, user, valid(ReasonIn, request.data)["reason"])
        elif action == "paid":
            bookings.mark_paid(b, user, who, valid(PaidIn, request.data)["method"])
        elif action == "rate":
            r = bookings.rate(b, user, who, valid(RateIn, request.data), request=request)
            log(request, "bolau.booking.rate", b, organization=None, changes={"side": who, "score": r.score})
            return Response(payloads.rating_dict(r), status=201)
        elif action == "dispute":
            from apps.trust.serializers import DisputeSerializer

            dispute = bookings.raise_dispute(b, user, who, valid(DisputeIn, request.data)["description"])
            log(
                request,
                "bolau.booking.dispute",
                b,
                organization=None,
                changes={"dispute_id": str(dispute.id)},
            )
            return Response(DisputeSerializer(dispute).data, status=201)
        elif action == "safety-report":
            return self._safety(request, b, who)
        elif action == "report":
            d = valid(ReportIn, request.data)
            rep = bookings.report(b, user, who, d["reason"], d.get("note") or "")
            return Response(
                {"id": str(rep.id), "reason": rep.reason, "created_at": payloads.iso(rep.created_at)},
                status=201,
            )
        log(request, f"bolau.booking.{action}", b, organization=None, changes={"party": who})
        return booking_response(request, b, who)

    def _safety(self, request, b, who):
        """Confidential safety report through the existing support ``safety`` category."""
        from apps.support.services import create_case

        d = valid(SafetyIn, request.data)
        case = create_case(
            requester=request.user,
            subject=f"Bolau booking {b.code}: safety report ({who})",
            description=f"Booking {b.code} · reported by the {who}.\n\n{d['description']}",
            category="safety",
            worker=b.sipalu if who == "sipalu" else None,
            safety_kind=d["safety_kind"],
            anonymous=d["anonymous"],
            emergency=d["emergency"],
        )
        log(request, "bolau.booking.safety_report", b, organization=None, changes={"case": case.number})
        return Response(
            {
                "case_id": str(case.id),
                "case_number": case.number,
                "emergency_line": labels.EMERGENCY["line"],
                "emergency_en": labels.EMERGENCY["en"],
                "emergency_ne": labels.EMERGENCY["ne"],
            },
            status=201,
        )


class BookingFeePayView(APIView):
    def post(self, request, booking_id):
        b, _who = party_booking(request, booking_id, party="ghardhani")
        return Response(payments.start_payment(b, valid(FeePayIn, request.data)["provider"]))


class BookingReceiptView(APIView):
    def get(self, request, booking_id):
        b, _who = party_booking(request, booking_id, party="ghardhani")
        if b.booking_fee_status != "paid":
            raise error("invalid_state", "receipt_unavailable")
        resp = HttpResponse(payments.receipt_pdf(b), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="receipt-{b.code}.pdf"'
        return resp


class RatingFlagView(APIView):
    """The rated party flags a rating comment for ops moderation."""

    def post(self, request, rating_id):
        require_bolau()
        r = get_object_or_404(BookingRating.objects.select_related("booking__sipalu"), pk=rating_id)
        rated = r.booking.sipalu.user_id if r.side == "ghardhani" else r.booking.ghardhani_id
        if rated != request.user.pk:
            raise Http404
        from . import ops

        r = ops.flag_rating(r, request.user, valid(FlagIn, request.data)["reason"])
        log(request, "bolau.rating.flag", r, organization=None, changes={"side": r.side})
        return Response(payloads.rating_dict(r))


def _status_filter(qs, request):
    status = request.query_params.get("status")
    if status:
        qs = qs.filter(status__in=[s for s in status.split(",") if s])
    return qs


class MeBookingsView(APIView):
    """Ghardhani: my bookings."""

    def get(self, request):
        require_bolau()
        qs = _status_filter(booking_qs().filter(ghardhani=request.user), request).order_by("-scheduled_start")
        return paginate(self, request, qs, lambda b: payloads.booking_dict(b, "ghardhani", request))


class MeJobsView(APIView):
    """Sipalu: incoming + upcoming (``?scope=incoming|upcoming|past``, ``?status=``)."""

    def get(self, request):
        require_bolau()
        profile = existing_profile(request)
        qs = booking_qs().filter(sipalu=profile.worker)
        scope = request.query_params.get("scope")
        if scope == "incoming":
            qs = qs.filter(status="requested").order_by("scheduled_start")
        elif scope == "upcoming":
            qs = qs.filter(status__in=("accepted", "on_the_way", "arrived", "in_progress")).order_by(
                "scheduled_start"
            )
        elif scope == "past":
            qs = qs.exclude(status__in=Booking.ACTIVE).order_by("-scheduled_start")
        else:
            qs = qs.order_by("-scheduled_start")
        qs = _status_filter(qs, request)
        return paginate(self, request, qs, lambda b: payloads.booking_dict(b, "sipalu", request))


SIPALU_ACTIONS = {"accept", "decline", "on-the-way", "arrive", "quote", "start", "complete", "cancel"}


class MeJobActionView(APIView):
    """``POST /me/bolau/bookings/{id}/{action}`` — Sipalu actions."""

    def post(self, request, booking_id, action):
        if action not in SIPALU_ACTIONS:
            raise Http404
        b, _who = party_booking(request, booking_id, party="sipalu")
        user = request.user
        if action == "accept":
            bookings.accept(b, user)
        elif action == "decline":
            bookings.decline(b, user, valid(ReasonIn, request.data)["reason"])
        elif action == "on-the-way":
            bookings.on_the_way(b, user)
        elif action == "arrive":
            bookings.arrive(b, user, valid(ArriveIn, request.data)["code"])
        elif action == "quote":
            bookings.propose_quote(b, user, valid(QuoteIn, request.data)["amount"])
        elif action == "start":
            bookings.start(b, user)
        elif action == "complete":
            d = valid(CompleteIn, request.data)
            bookings.complete(b, user, d.get("final_price"), d.get("note") or "")
        elif action == "cancel":
            bookings.cancel(b, user, "sipalu", valid(ReasonIn, request.data)["reason"])
        log(request, f"bolau.job.{action}", b, organization=None)
        return booking_response(request, b, "sipalu")


# =========================================================================== Kaam requests
def request_qs():
    return KaamRequest.objects.select_related("trade", "address__district").prefetch_related(
        "photos", Prefetch("offers", queryset=Offer.objects.select_related("sipalu", "sipalu__sipalu"))
    )


class RequestsView(APIView):
    @idempotent
    def post(self, request):
        require_bolau()
        d = valid(RequestIn, request.data)
        photos = [validate_upload(f, kinds={"image"}, max_mb=8) for f in request.FILES.getlist("photos")]
        req = kaam.create_request(request.user, d, photos)
        log(request, "bolau.request.create", req, organization=None, changes={"code": req.code})
        req = request_qs().get(pk=req.pk)
        return Response(
            payloads.request_dict(req, "ghardhani", request, offers=list(req.offers.all())), status=201
        )


def own_request(request, request_id) -> KaamRequest:
    require_bolau()
    return get_object_or_404(request_qs(), pk=request_id, ghardhani=request.user)


class RequestDetailView(APIView):
    def get(self, request, request_id):
        req = own_request(request, request_id)
        return Response(payloads.request_dict(req, "ghardhani", request, offers=list(req.offers.all())))


class RequestCancelView(APIView):
    def post(self, request, request_id):
        req = kaam.cancel_request(own_request(request, request_id))
        log(request, "bolau.request.cancel", req, organization=None)
        req = request_qs().get(pk=req.pk)
        return Response(payloads.request_dict(req, "ghardhani", request, offers=list(req.offers.all())))


class OfferAcceptView(APIView):
    @idempotent
    def post(self, request, request_id, offer_id):
        req = own_request(request, request_id)
        offer = get_object_or_404(Offer, pk=offer_id, request=req)
        b = kaam.accept_offer(request.user, req, offer)
        log(request, "bolau.offer.accept", b, organization=None, changes={"offer_id": str(offer.id)})
        return booking_response(request, b, "ghardhani", status=201)


class MeRequestsView(APIView):
    def get(self, request):
        require_bolau()
        qs = _status_filter(request_qs().filter(ghardhani=request.user), request)
        return paginate(
            self,
            request,
            qs,
            lambda r: payloads.request_dict(r, "ghardhani", request, offers=list(r.offers.all())),
        )


class NearbyRequestsView(APIView):
    def get(self, request):
        require_bolau()
        profile = existing_profile(request)
        if not profiles.is_bookable(profile):
            return paginate(self, request, [], lambda r: r)
        rows = kaam.nearby(profile, request.query_params.get("trade"))
        mine = {
            o.request_id: o
            for o in Offer.objects.filter(sipalu=profile.worker, request__in=[r.pk for r in rows])
        }
        return paginate(
            self,
            request,
            rows,
            lambda r: payloads.request_dict(r, "sipalu", request, my_offer=mine.get(r.pk)),
        )


def sipalu_request(request, request_id) -> tuple[SipaluProfile, KaamRequest]:
    require_bolau()
    profile = existing_profile(request)
    req = request_qs().filter(pk=request_id).first()
    if req is None:
        raise Http404
    has_offer = Offer.objects.filter(request=req, sipalu=profile.worker).exists()
    if not has_offer and not kaam.can_see_request(profile, req):
        raise Http404
    return profile, req


class MeRequestDetailView(APIView):
    def get(self, request, request_id):
        profile, req = sipalu_request(request, request_id)
        mine = Offer.objects.filter(request=req, sipalu=profile.worker).first()
        return Response(payloads.request_dict(req, "sipalu", request, my_offer=mine))


class MeRequestOffersView(APIView):
    @idempotent
    def post(self, request, request_id):
        profile, req = sipalu_request(request, request_id)
        offer = kaam.make_offer(profile, req, valid(OfferIn, request.data))
        log(request, "bolau.offer.create", offer, organization=None, changes={"request": req.code})
        return Response(payloads.offer_dict(offer, request, for_ghardhani=False), status=201)


class MeOffersView(APIView):
    def get(self, request):
        require_bolau()
        profile = existing_profile(request)
        qs = _status_filter(
            Offer.objects.filter(sipalu=profile.worker).select_related("request"), request
        ).order_by("-created_at")
        return paginate(self, request, qs, lambda o: {**payloads.offer_dict(o, request, for_ghardhani=False),
                                                      "request_code": o.request.code,
                                                      "request_title": o.request.title})  # fmt: skip


class MeOfferWithdrawView(APIView):
    def post(self, request, offer_id):
        require_bolau()
        profile = existing_profile(request)
        offer = get_object_or_404(Offer, pk=offer_id, sipalu=profile.worker)
        offer = kaam.withdraw_offer(offer)
        log(request, "bolau.offer.withdraw", offer, organization=None)
        return Response(payloads.offer_dict(offer, request, for_ghardhani=False))


# =========================================================================== gateway webhook
class FeeWebhookView(APIView):
    """``POST /webhooks/bolau/{provider}`` — no auth; HMAC (``X-Signature`` over ``X-Timestamp.body``),
    skew window, exact replays → 409 ``webhook_replayed``."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = None

    def post(self, request, provider):
        gw = payments.GATEWAYS.get(provider)
        if gw is None:
            raise Http404
        _ = request.body
        replay_key = gw.verify_signature(request)
        try:
            result = payments.apply_webhook(provider, gw.parse(request))
        except Exception:
            from django.core.cache import cache

            cache.delete(replay_key)
            raise
        log(None, "bolau.fee.webhook", None, object_type="booking", changes={"provider": provider, **result})
        return Response(result)
