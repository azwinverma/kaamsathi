from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as _TokenRefreshView

from apps.audit.services import client_ip
from apps.notifications.services import send_sms

from . import otp
from .models import User
from .serializers import MeSerializer, OTPRequestSerializer, OTPVerifySerializer, RefreshSerializer


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class OTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "otp"

    @extend_schema(request=OTPRequestSerializer, responses={200: dict})
    def post(self, request):
        s = OTPRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        phone = s.validated_data["phone"]
        with transaction.atomic():
            _, code = otp.issue(phone, ip=client_ip(request))
            send_sms(
                phone,
                f"KaamSathi code: {code}. Valid for 5 minutes. Do not share. / कामसाथी कोड: {code}",
                kind="otp",
                log_body="KaamSathi code: ****** (redacted)",
            )
        data = {"sent": True, "expires_in": 300}
        if otp.dev_code():
            data["dev_code"] = otp.dev_code()
        return Response(data)


class OTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "otp"

    @extend_schema(request=OTPVerifySerializer, responses={200: dict})
    def post(self, request):
        s = OTPVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        phone = s.validated_data["phone"]
        otp.verify(phone, s.validated_data["code"])
        user, created = User.objects.get_or_create(phone=phone)
        if created:
            user.set_unusable_password()
            user.save()
        if not user.is_active:
            from apps.core.exceptions import APIError

            raise APIError("permission_denied", status_code=403)
        data = tokens_for(user)
        from django.contrib.auth.models import update_last_login

        update_last_login(None, user)
        data["user"] = MeSerializer(user, context={"request": request}).data
        return Response(data)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=RefreshSerializer, responses={204: None})
    def post(self, request):
        s = RefreshSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        token = RefreshToken(s.validated_data["refresh"])
        token.blacklist()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    @extend_schema(responses=MeSerializer)
    def get(self, request):
        return Response(MeSerializer(request.user, context={"request": request}).data)

    @extend_schema(request=MeSerializer, responses=MeSerializer)
    def patch(self, request):
        s = MeSerializer(request.user, data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class TokenRefreshView(_TokenRefreshView):
    """POST /auth/token/refresh {refresh} → {access, refresh} (rotating, old one blacklisted)."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
