"""``GET|PATCH /ops/matching/config`` (K001) and ``POST /ops/matching/config/reset``.

Not listed in ``ROUTE_ROLES`` → superadmin only (fail-closed default). Audited.
"""

from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.permissions import IsOpsStaff

from . import matching


class MatchConfigView(APIView):
    permission_classes = [IsAuthenticated, IsOpsStaff]

    def get(self, request):
        return Response(matching.config_payload())

    def patch(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        before = matching.current_weights()
        weights = matching.validate_weights(data.get("weights", {}))
        config = matching.update_config(weights, request.user)
        log(
            request,
            "ops.matching.config",
            config,
            organization=None,
            changes={
                "revision": config.revision,
                "weights": {k: {"from": before[k], "to": v} for k, v in weights.items() if before[k] != v},
            },
        )
        return Response(matching.config_payload(config))


class MatchConfigResetView(APIView):
    permission_classes = [IsAuthenticated, IsOpsStaff]

    def post(self, request):
        config = matching.reset_config(request.user)
        log(
            request,
            "ops.matching.config_reset",
            config,
            organization=None,
            changes={"revision": config.revision},
        )
        return Response(matching.config_payload(config))
