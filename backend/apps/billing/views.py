from rest_framework import mixins, serializers, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core import labels
from apps.core.permissions import ADMINS, OrgScopedMixin

from . import services
from .models import Charge


class ChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Charge
        fields = ["id", "kind", "amount", "description", "bs_year", "bs_month", "status", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["application_id"] = str(instance.application_id) if instance.application_id else None
        data["kind_label"] = labels.label(labels.CHARGE_KIND, instance.kind)
        data["status_label"] = labels.label(labels.CHARGE_STATUS, instance.status)
        return data


class BillingSummaryView(OrgScopedMixin, APIView):
    default_roles = ADMINS

    def get(self, request):
        org = self.org
        return Response(
            {
                "plan": org.plan,
                "active_workers": services.active_worker_count(org),
                "monthly_estimate": f"{services.monthly_estimate(org):.2f}",
                "unpaid_total": f"{services.unpaid_total(org):.2f}",
            }
        )


class ChargeViewSet(OrgScopedMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = ChargeSerializer
    default_roles = ADMINS
    filterset_fields = ["kind", "status"]

    def get_queryset(self):
        return Charge.objects.filter(organization=self.org).order_by("-created_at")
