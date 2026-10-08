"""Inbox + device registration (/me/notifications, /me/devices) for any signed-in user."""

from __future__ import annotations

from django.db import transaction
from django.db.models import OuterRef, Subquery
from django.utils import timezone
from django.utils.translation import pgettext
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.exceptions import APIError
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsOpsStaff

from .models import DeviceToken, Notification, NotificationPreference, NotificationTemplate


def notification_dict(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "kind": n.kind,
        "title": n.title,
        "title_ne": n.title_ne,
        "body": n.body,
        "body_ne": n.body_ne,
        "data": n.data or {},
        "link": n.link,
        "read_at": timezone.localtime(n.read_at).isoformat() if n.read_at else None,
        "created_at": timezone.localtime(n.created_at).isoformat(),
    }


class MeNotificationsView(APIView):
    def get(self, request):
        qs = Notification.objects.filter(user=request.user).order_by("-created_at")
        if request.query_params.get("unread") in ("1", "true"):
            qs = qs.filter(read_at__isnull=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([notification_dict(n) for n in page])


class MeNotificationsUnreadCountView(APIView):
    def get(self, request):
        count = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({"count": count})


class MeNotificationReadView(APIView):
    def post(self, request, notification_id):
        n = Notification.objects.filter(user=request.user, pk=notification_id).first()
        if n is None:
            raise NotFound()
        if n.read_at is None:
            n.read_at = timezone.now()
            n.save(update_fields=["read_at"])
        return Response(notification_dict(n))


class MeNotificationsReadAllView(APIView):
    def post(self, request):
        updated = Notification.objects.filter(user=request.user, read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return Response({"updated": updated})


class DeviceSerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=[c for c, _ in DeviceToken.PLATFORMS])
    token = serializers.CharField(max_length=512, min_length=10)


class MeDevicesView(APIView):
    def post(self, request):
        s = DeviceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        # A token moves with the device: re-registering under another user re-assigns it.
        device, created = DeviceToken.objects.update_or_create(
            token=d["token"],
            defaults={"user": request.user, "platform": d["platform"], "last_seen_at": timezone.now()},
        )
        return Response(
            {"id": str(device.id), "platform": device.platform, "created": created},
            status=201 if created else 200,
        )


class MeDeviceDeleteView(APIView):
    def delete(self, request, token):
        deleted, _ = DeviceToken.objects.filter(user=request.user, token=token).delete()
        if not deleted:
            raise APIError("not_found", status_code=404)
        return Response(status=204)


# --------------------------------------------------------------------------- preferences
class PreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "sms_enabled",
            "push_enabled",
            "email_enabled",
            "marketing_opt_in",
            "job_alert_frequency",
            "quiet_hours_start",
            "quiet_hours_end",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for f in ("quiet_hours_start", "quiet_hours_end"):
            if data.get(f):
                data[f] = data[f][:5]
        return data

    def validate(self, attrs):
        start = attrs.get("quiet_hours_start", getattr(self.instance, "quiet_hours_start", None))
        end = attrs.get("quiet_hours_end", getattr(self.instance, "quiet_hours_end", None))
        if (start is None) != (end is None):
            raise serializers.ValidationError(
                {"quiet_hours_end": [pgettext("enterprise", "Set both start and end, or neither.")]}
            )
        return attrs


class MeNotificationPreferencesView(APIView):
    def get(self, request):
        from .services import preferences_for

        return Response(PreferenceSerializer(preferences_for(request.user)).data)

    def patch(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        s = PreferenceSerializer(pref, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(PreferenceSerializer(pref).data)


# --------------------------------------------------------------------------- ops templates
class TemplateSerializer(serializers.ModelSerializer):
    key = serializers.RegexField(r"^[a-z0-9_.]{2,60}$")

    class Meta:
        model = NotificationTemplate
        fields = ["id", "key", "channel", "language", "version", "subject", "body", "is_active", "updated_at"]
        read_only_fields = ["id", "version", "updated_at"]


class PreviewSerializer(serializers.Serializer):
    subject = serializers.CharField(required=False, allow_blank=True, default="")
    body = serializers.CharField(required=False, allow_blank=True, default="")
    template_id = serializers.IntegerField(required=False)
    context = serializers.DictField(required=False, default=dict)


class OpsTemplateViewSet(viewsets.GenericViewSet):
    """List/create/edit notification templates. Any edit of wording creates a new version."""

    permission_classes = [IsAuthenticated, IsOpsStaff]
    serializer_class = TemplateSerializer

    def get_queryset(self):
        qs = NotificationTemplate.objects.all()
        p = self.request.query_params
        for f in ("channel", "language"):
            if p.get(f):
                qs = qs.filter(**{f: p[f]})
        if p.get("key"):
            qs = qs.filter(key__icontains=p["key"])
        if p.get("latest") in ("1", "true"):
            latest = (
                NotificationTemplate.objects.filter(
                    key=OuterRef("key"), channel=OuterRef("channel"), language=OuterRef("language")
                )
                .order_by("-version")
                .values("pk")[:1]
            )
            qs = qs.filter(pk=Subquery(latest))
        return qs.order_by("key", "channel", "language", "-version")

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(TemplateSerializer(page, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(TemplateSerializer(self.get_object()).data)

    def _next_version(self, key, channel, language) -> int:
        top = (
            NotificationTemplate.objects.filter(key=key, channel=channel, language=language)
            .order_by("-version")
            .values_list("version", flat=True)
            .first()
        )
        return (top or 0) + 1

    def create(self, request):
        s = TemplateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        with transaction.atomic():
            tpl = NotificationTemplate.objects.create(
                **d,
                version=self._next_version(d["key"], d["channel"], d["language"]),
                created_by=request.user,
            )
        log(request, "notification_template.create", tpl, changes={"key": tpl.key, "version": tpl.version})
        return Response(TemplateSerializer(tpl).data, status=201)

    def partial_update(self, request, pk=None):
        base = self.get_object()
        s = TemplateSerializer(base, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if set(d) <= {"is_active"}:
            base.is_active = d.get("is_active", base.is_active)
            base.save(update_fields=["is_active", "updated_at"])
            log(request, "notification_template.toggle", base, changes={"is_active": base.is_active})
            return Response(TemplateSerializer(base).data)
        values = {
            "key": base.key,
            "channel": base.channel,
            "language": base.language,
            "subject": d.get("subject", base.subject),
            "body": d.get("body", base.body),
            "is_active": d.get("is_active", True),
        }
        with transaction.atomic():
            tpl = NotificationTemplate.objects.create(
                **values,
                version=self._next_version(base.key, base.channel, base.language),
                created_by=request.user,
            )
        log(
            request,
            "notification_template.version",
            tpl,
            changes={"key": tpl.key, "from_version": base.version, "version": tpl.version},
        )
        return Response(TemplateSerializer(tpl).data, status=201)

    @action(detail=False, methods=["post"])
    def preview(self, request):
        from .services import render_text

        s = PreviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        subject, body = d["subject"], d["body"]
        if d.get("template_id"):
            tpl = NotificationTemplate.objects.filter(pk=d["template_id"]).first()
            if tpl is None:
                raise NotFound()
            subject, body = subject or tpl.subject, body or tpl.body
        subj, m1 = render_text(subject, d["context"])
        text, m2 = render_text(body, d["context"])
        return Response(
            {"subject": subj, "body": text, "missing": sorted(set(m1) | set(m2)), "length": len(text)}
        )


class OpsDeliveriesView(APIView):
    """Recent notification deliveries (no message bodies — they can hold salary details)."""

    permission_classes = [IsAuthenticated, IsOpsStaff]

    def get(self, request):
        from .models import NotificationDelivery

        qs = NotificationDelivery.objects.select_related("notification__user").order_by("-created_at")
        p = request.query_params
        for f in ("status", "channel"):
            if p.get(f):
                qs = qs.filter(**{f: p[f]})
        if p.get("kind"):
            qs = qs.filter(notification__kind=p["kind"])
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(
            [
                {
                    "id": str(d.id),
                    "kind": d.notification.kind,
                    "user": {"id": str(d.notification.user_id), "phone": d.notification.user.phone},
                    "channel": d.channel,
                    "status": d.status,
                    "attempts": d.attempts,
                    "provider_ref": d.provider_ref,
                    "error": d.error,
                    "next_attempt_at": timezone.localtime(d.next_attempt_at).isoformat()
                    if d.next_attempt_at
                    else None,
                    "created_at": timezone.localtime(d.created_at).isoformat(),
                }
                for d in page
            ]
        )
