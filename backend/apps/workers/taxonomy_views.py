"""Ops taxonomy: trades CRUD (code immutable; deactivate instead of delete). Audited."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.services import diff, log, snapshot
from apps.core import labels
from apps.core.exceptions import Duplicate
from apps.core.permissions import IsOpsStaff

from . import labels as worker_labels
from .models import Trade, TradeAlias


class AliasSerializer(serializers.ModelSerializer):
    alias = serializers.CharField(max_length=80)
    language = serializers.ChoiceField(choices=list(TradeAlias.LANGUAGES), default="en")

    class Meta:
        model = TradeAlias
        fields = ["id", "alias", "language", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_alias(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Enter at least 2 characters.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["trade"] = instance.trade_id
        data["language_label"] = labels.label(worker_labels.ALIAS_LANGUAGE, instance.language)
        return data


def _count_of(model, field):
    sub = model.objects.filter(**{field: OuterRef("pk")}).values(field).annotate(n=Count("pk")).values("n")
    return Coalesce(Subquery(sub, output_field=IntegerField()), 0)


class TradeSerializer(serializers.ModelSerializer):
    code = serializers.SlugField(max_length=40)

    class Meta:
        model = Trade
        fields = ["code", "name_en", "name_ne", "category", "is_active"]

    def validate_code(self, value):
        value = value.strip().lower().replace("-", "_")
        if self.instance is None and Trade.objects.filter(code=value).exists():
            raise serializers.ValidationError("A trade with this code already exists.", code="unique")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["category_label"] = dict(Trade.CATEGORIES).get(instance.category, instance.category)
        data["workers_count"] = getattr(instance, "workers_count", None)
        data["jobs_count"] = getattr(instance, "jobs_count", None)
        data["aliases"] = [AliasSerializer(a).data for a in instance.aliases.all()]
        return data


class TradeUpdateSerializer(TradeSerializer):
    code = serializers.CharField(read_only=True)  # immutable: jobs, skills and payroll reference it


class OpsTradeViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated, IsOpsStaff]
    serializer_class = TradeSerializer
    http_method_names = ["get", "post", "patch", "delete"]  # delete: aliases only (no trade destroy)
    lookup_field = "code"
    lookup_value_regex = "[a-z0-9_-]+"

    def get_queryset(self):
        from apps.hiring.models import JobOpening

        from .models import WorkerSkill

        qs = Trade.objects.prefetch_related("aliases").annotate(
            workers_count=_count_of(WorkerSkill, "trade_id"), jobs_count=_count_of(JobOpening, "trade_id")
        )
        p = self.request.query_params
        if p.get("q"):
            q = p["q"].strip()
            qs = qs.filter(Q(code__icontains=q) | Q(name_en__icontains=q) | Q(name_ne__icontains=q))
        if p.get("category"):
            qs = qs.filter(category__in=p["category"].split(","))
        if p.get("is_active") in ("true", "false", "1", "0"):
            qs = qs.filter(is_active=p["is_active"] in ("true", "1"))
        return qs.order_by("category", "name_en")

    def get_serializer_class(self):
        return TradeUpdateSerializer if self.action == "partial_update" else TradeSerializer

    def perform_create(self, serializer):
        trade = serializer.save()
        log(
            self.request,
            "ops.taxonomy.trade.create",
            trade,
            organization=None,
            changes={"after": snapshot(trade)},
        )

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        trade = serializer.save()
        log(
            self.request,
            "ops.taxonomy.trade.update",
            trade,
            organization=None,
            changes=diff(before, snapshot(trade)),
        )

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        super().update(request, *args, **kwargs)
        return Response(TradeSerializer(self.get_queryset().get(pk=kwargs["code"])).data)

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        self.perform_create(s)
        return Response(TradeSerializer(self.get_queryset().get(pk=s.instance.pk)).data, status=201)

    # --- aliases (F004): search synonyms used by trade_q / job search / /ref/trades?q= -----------
    @action(detail=True, methods=["get", "post"])
    def aliases(self, request, code=None):
        trade = self.get_object()
        if request.method == "GET":
            return Response(AliasSerializer(trade.aliases.all(), many=True).data)
        s = AliasSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if trade.aliases.filter(alias__iexact=s.validated_data["alias"]).exists():
            raise Duplicate(message="This trade already has this alias.")
        try:
            with transaction.atomic():
                alias = s.save(trade=trade)
        except IntegrityError as exc:
            raise Duplicate(message="This alias is already used.") from exc
        log(
            request,
            "ops.taxonomy.alias.create",
            alias,
            organization=None,
            changes={"trade": trade.code, "alias": alias.alias, "language": alias.language},
        )
        return Response(AliasSerializer(alias).data, status=201)

    @action(detail=True, methods=["delete"], url_path=r"aliases/(?P<alias_id>[0-9a-f-]{36})")
    def delete_alias(self, request, code=None, alias_id=None):
        trade = self.get_object()
        alias = trade.aliases.filter(pk=alias_id).first()
        if alias is None:
            from rest_framework.exceptions import NotFound

            raise NotFound()
        log(
            request,
            "ops.taxonomy.alias.delete",
            alias,
            organization=None,
            changes={"trade": trade.code, "alias": alias.alias},
        )
        alias.delete()
        return Response(status=204)
