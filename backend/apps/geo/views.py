"""Reference data (no auth) and health check."""

import datetime as dt

from django.db import connection
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.bs import BSDateError, bs_str, calendar_info, month_info, parse_bs, today_ad
from apps.core.exceptions import APIError
from apps.hiring.models import MinimumWage
from apps.workers.models import Trade

from .models import District, Province


class PublicView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []


class HealthView(PublicView):
    throttle_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
        except Exception:  # noqa: BLE001
            return Response({"status": "degraded", "database": "unavailable"}, status=503)
        return Response({"status": "ok"})


class ProvinceListView(PublicView):
    def get(self, request):
        return Response(
            [{"code": p.code, "name_en": p.name_en, "name_ne": p.name_ne} for p in Province.objects.all()]
        )


class DistrictListView(PublicView):
    @extend_schema(parameters=[OpenApiParameter("province", int)])
    def get(self, request):
        qs = District.objects.all()
        province = request.query_params.get("province")
        if province:
            if not province.isdigit():
                raise APIError("validation_error", fields={"province": ["Must be 1–7."]})
            qs = qs.filter(province_id=int(province))
        return Response(
            [
                {"code": d.code, "name_en": d.name_en, "name_ne": d.name_ne, "province": d.province_id}
                for d in qs
            ]
        )


class TradeListView(PublicView):
    def get(self, request):
        return Response(
            [
                {
                    "code": t.code,
                    "name_en": t.name_en,
                    "name_ne": t.name_ne,
                    "category": t.category,
                }
                # inactive trades (ops taxonomy) are hidden unless ?all=1
                for t in (
                    Trade.objects.all()
                    if request.query_params.get("all") in ("1", "true")
                    else Trade.objects.filter(is_active=True)
                )
            ]
        )


class MinimumWageView(PublicView):
    def get(self, request):
        mw = MinimumWage.current()
        if mw is None:
            raise APIError("not_found", status_code=404)
        return Response(
            {
                "effective_from": mw.effective_from.isoformat(),
                "effective_from_bs": bs_str(mw.effective_from),
                "monthly_basic": f"{mw.monthly_basic:.2f}",
                "monthly_da": f"{mw.monthly_da:.2f}",
                "monthly_total": f"{mw.monthly_total:.2f}",
                "daily": f"{mw.daily:.2f}",
                "hourly": f"{mw.hourly:.2f}",
                "hourly_part_time": f"{mw.hourly_part_time:.2f}",
            }
        )


class CalendarTodayView(PublicView):
    def get(self, request):
        return Response(calendar_info(today_ad()))


class CalendarConvertView(PublicView):
    @extend_schema(parameters=[OpenApiParameter("ad", str), OpenApiParameter("bs", str)])
    def get(self, request):
        ad, bs = request.query_params.get("ad"), request.query_params.get("bs")
        try:
            if ad:
                day = dt.date.fromisoformat(ad)
            elif bs:
                day = parse_bs(bs)
            else:
                raise APIError(
                    "validation_error", fields={"ad": ["Provide ?ad=YYYY-MM-DD or ?bs=YYYY-MM-DD"]}
                )
            return Response(calendar_info(day))
        except (ValueError, BSDateError) as exc:
            if isinstance(exc, APIError):
                raise
            raise APIError("validation_error", fields={"ad" if ad else "bs": [str(exc)]}) from exc


class CalendarMonthView(PublicView):
    @extend_schema(parameters=[OpenApiParameter("bs_year", int), OpenApiParameter("bs_month", int)])
    def get(self, request):
        try:
            year = int(request.query_params.get("bs_year", ""))
            month = int(request.query_params.get("bs_month", ""))
            return Response(month_info(year, month))
        except (ValueError, BSDateError) as exc:
            raise APIError(
                "validation_error", fields={"bs_month": ["Provide valid bs_year and bs_month (1–12)."]}
            ) from exc
