"""Employer analytics and ops labour-market intelligence (aggregates only, k-anonymity 5)."""

from __future__ import annotations

import csv
import io

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import APIError
from apps.core.permissions import IsOpsStaff, OrgScopedMixin

from . import services


class OrgAnalyticsView(OrgScopedMixin, APIView):
    def get(self, request):
        try:
            months = int(request.query_params.get("months", 6))
        except ValueError as exc:
            raise APIError("validation_error", fields={"months": ["Must be a number."]}) from exc
        if not 1 <= months <= 24:
            raise APIError("validation_error", fields={"months": ["Must be between 1 and 24."]})
        return Response(services.org_analytics(self.org, months))


def _filters(request):
    p = request.query_params
    return (p.get("district") or None), (p.get("trade") or None)


class OpsLabourMarketView(APIView):
    permission_classes = [IsAuthenticated, IsOpsStaff]

    def get(self, request):
        district, trade = _filters(request)
        return Response(services.labour_market(district, trade))


class OpsInsightsExportView(APIView):
    permission_classes = [IsAuthenticated, IsOpsStaff]

    def get(self, request):
        report = request.query_params.get("report", "wages")
        if report not in services.REPORTS:
            raise APIError("validation_error", fields={"report": [f"One of: {', '.join(services.REPORTS)}."]})
        district, trade = _filters(request)
        rows = services.export_rows(report, district, trade)
        buf = io.StringIO()
        columns: list[str] = []
        for r in rows:
            for k in r:
                if k not in columns:
                    columns.append(k)
        writer = csv.DictWriter(buf, fieldnames=columns or ["no_data"])
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
        resp = HttpResponse("﻿" + buf.getvalue(), content_type="text/csv; charset=utf-8")
        suffix = "-".join(x for x in (district, trade) if x)
        resp["Content-Disposition"] = (
            f'attachment; filename="kaamsathi-{report}{"-" + suffix if suffix else ""}.csv"'
        )
        return resp
