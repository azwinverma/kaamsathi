"""Ops staff administration (/ops/staff*, superadmin via ``staff_roles.ROUTE_ROLES``)."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log
from apps.core.exceptions import APIError
from apps.core.permissions import IsOpsStaff

from . import sessions
from .models import StaffProfile, User
from .serializers import StaffCreateSerializer, StaffSerializer, StaffUpdateSerializer

OPS_PERMS = [IsAuthenticated, IsOpsStaff]


def _out(user) -> dict:
    user = User.objects.select_related("staff_profile").get(pk=user.pk)
    return StaffSerializer(user).data


class StaffListView(generics.ListAPIView):
    """GET /ops/staff?q= · POST /ops/staff {phone, full_name, roles} (creates or promotes)."""

    permission_classes = OPS_PERMS
    serializer_class = StaffSerializer

    def get_queryset(self):
        qs = User.objects.filter(is_staff=True).select_related("staff_profile").order_by("full_name", "phone")
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(full_name__icontains=q) | Q(phone__icontains=q))
        return qs

    @extend_schema(request=StaffCreateSerializer, responses={201: StaffSerializer})
    def post(self, request):
        s = StaffCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        with transaction.atomic():
            user, created = User.objects.get_or_create(phone=data["phone"])
            if created:
                user.set_unusable_password()
            if data.get("full_name"):
                user.full_name = data["full_name"]
            was_staff = user.is_staff
            user.is_staff = True
            user.save()
            profile, _ = StaffProfile.objects.get_or_create(user=user)
            before = list(profile.roles or [])
            profile.roles = sorted(set(data["roles"]))
            profile.save(update_fields=["roles", "updated_at"])
        log(
            request,
            "staff.create" if not was_staff else "staff.update",
            user,
            object_type="user",
            changes={
                "roles": {"from": before, "to": profile.roles},
                "is_staff": {"from": was_staff, "to": True},
            },
        )
        return Response(_out(user), status=201)


class StaffDetailView(APIView):
    """PATCH /ops/staff/{user_id} {roles?, is_active?}."""

    permission_classes = OPS_PERMS

    def _get(self, pk) -> User:
        user = User.objects.filter(pk=pk, is_staff=True).first()
        if user is None:
            raise APIError("not_found", status_code=404)
        return user

    @extend_schema(responses=StaffSerializer)
    def get(self, request, pk):
        return Response(_out(self._get(pk)))

    @extend_schema(request=StaffUpdateSerializer, responses=StaffSerializer)
    def patch(self, request, pk):
        user = self._get(pk)
        s = StaffUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        changes = {}
        if user.pk == request.user.pk and (
            data.get("is_active") is False or ("roles" in data and "superadmin" not in data["roles"])
        ):
            raise APIError("invalid_state", message="You cannot remove your own superadmin access.")
        with transaction.atomic():
            if "roles" in data:
                profile, _ = StaffProfile.objects.get_or_create(user=user)
                new = sorted(set(data["roles"]))
                changes["roles"] = {"from": list(profile.roles or []), "to": new}
                profile.roles = new
                profile.save(update_fields=["roles", "updated_at"])
            if "is_active" in data and data["is_active"] != user.is_active:
                changes["is_active"] = {"from": user.is_active, "to": data["is_active"]}
                user.is_active = data["is_active"]
                user.save(update_fields=["is_active"])
                if not user.is_active:
                    sessions.revoke_all(user)
        log(request, "staff.update", user, object_type="user", changes=changes)
        return Response(_out(user))


class StaffResetMFAView(APIView):
    """POST /ops/staff/{user_id}/reset-mfa — clears the authenticator; user re-enrols on next login."""

    permission_classes = OPS_PERMS

    @extend_schema(request=None, responses=StaffSerializer)
    def post(self, request, pk):
        user = User.objects.filter(pk=pk, is_staff=True).first()
        if user is None:
            raise APIError("not_found", status_code=404)
        StaffProfile.objects.filter(user=user).update(
            mfa_enabled=False, mfa_secret=None, mfa_enrolled_at=None, mfa_last_step=None, recovery_codes=[]
        )
        sessions.revoke_all(user)
        log(request, "staff.mfa_reset", user, object_type="user")
        return Response(_out(user))
