from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as _TokenRefreshView

from apps.audit.services import client_ip
from apps.audit.services import log as audit_log
from apps.core import metrics
from apps.core.exceptions import APIError
from apps.notifications.services import send_sms

from . import mfa, otp, sessions
from .models import SessionDevice, StaffProfile, User
from .serializers import (
    MeSerializer,
    MFACodeSerializer,
    MFALoginSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    RefreshSerializer,
    SessionDeviceSerializer,
)

MFA_MAX_FAILURES = 5
MFA_LOCK_SECONDS = 15 * 60


def tokens_for(user, request=None):
    return sessions.issue_tokens(user, request)


def _login_response(user, request) -> dict:
    from django.contrib.auth.models import update_last_login

    data = tokens_for(user, request)
    update_last_login(None, user)
    data["user"] = MeSerializer(user, context={"request": request}).data
    return data


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
        elif getattr(settings, "OTP_SHOW_CODE", False):
            data["dev_code"] = code  # test sites only (settings.OTP_SHOW_CODE)
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
        try:
            otp.verify(phone, s.validated_data["code"])
        except APIError as exc:
            metrics.inc("otp_requests_total", result=exc.code)
            raise
        metrics.inc("otp_requests_total", result="verified")
        user, created = User.objects.get_or_create(phone=phone)
        if created:
            user.set_unusable_password()
            user.save()
        if not user.is_active:
            raise APIError("permission_denied", status_code=403)
        if StaffProfile.objects.filter(user=user, mfa_enabled=True).exists():
            # Step-up: no tokens until the authenticator code is checked (POST /auth/mfa/verify).
            return Response({"mfa_required": True, "mfa_token": mfa.make_login_token(user)})
        return Response(_login_response(user, request))


class MFAVerifyView(APIView):
    """POST /auth/mfa/verify {mfa_token, code | recovery_code} → normal token response."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "otp"

    @extend_schema(request=MFALoginSerializer, responses={200: dict})
    def post(self, request):
        s = MFALoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        uid = mfa.read_login_token(s.validated_data["mfa_token"])
        user = User.objects.filter(pk=uid, is_active=True).first() if uid else None
        if user is None:
            raise APIError("mfa_token_invalid")
        fail_key = f"ks-mfa-fail:{user.pk}"
        if (cache.get(fail_key) or 0) >= MFA_MAX_FAILURES:
            raise APIError("mfa_locked", status_code=429)
        used_recovery = False
        with transaction.atomic():
            profile = StaffProfile.objects.select_for_update().filter(user=user, mfa_enabled=True).first()
            if profile is None:
                raise APIError("mfa_token_invalid")
            code = (s.validated_data.get("code") or "").strip()
            recovery = (s.validated_data.get("recovery_code") or "").strip()
            ok = mfa.check_code(profile, code) if code else False
            if not ok and recovery:
                ok = used_recovery = mfa.consume_recovery_code(profile, recovery)
        if not ok:
            cache.set(fail_key, (cache.get(fail_key) or 0) + 1, MFA_LOCK_SECONDS)
            raise APIError("mfa_invalid")
        cache.delete(fail_key)
        request.user = user
        audit_log(
            request,
            "auth.mfa.recovery_code_used" if used_recovery else "auth.mfa.login",
            user,
            object_type="user",
            changes={"recovery_codes_left": len(profile.recovery_codes or [])} if used_recovery else {},
        )
        return Response(_login_response(user, request))


def _profile_for(user, lock=False) -> StaffProfile:
    qs = StaffProfile.objects.select_for_update() if lock else StaffProfile.objects
    profile = qs.filter(user=user).first()
    if profile is None:
        profile = StaffProfile.objects.create(user=user)
    return profile


class MFASetupView(APIView):
    """POST /auth/mfa/setup → {secret, otpauth_uri} (pending until confirmed)."""

    @extend_schema(request=None, responses={200: dict})
    def post(self, request):
        with transaction.atomic():
            profile = _profile_for(request.user, lock=True)
            if profile.mfa_enabled:
                raise APIError("invalid_state", message="Two-step login is already on.")
            profile.mfa_secret = mfa.generate_secret()
            profile.mfa_last_step = None
            profile.save(update_fields=["mfa_secret", "mfa_last_step", "updated_at"])
        return Response(
            {
                "secret": profile.mfa_secret,
                "otpauth_uri": mfa.otpauth_uri(profile.mfa_secret, request.user.phone),
            }
        )


class MFAQRView(APIView):
    """GET /auth/mfa/qr.svg — QR of the pending (not yet confirmed) secret."""

    @extend_schema(responses={200: bytes})
    def get(self, request):
        profile = StaffProfile.objects.filter(user=request.user).first()
        if profile is None or profile.mfa_enabled or not profile.mfa_secret:
            raise APIError("not_found", status_code=404)
        svg = mfa.qr_svg(mfa.otpauth_uri(profile.mfa_secret, request.user.phone))
        resp = HttpResponse(svg, content_type="image/svg+xml")
        resp["Cache-Control"] = "no-store"
        return resp


class MFAConfirmView(APIView):
    """POST /auth/mfa/confirm {code} → {recovery_codes} (shown once)."""

    @extend_schema(request=MFACodeSerializer, responses={200: dict})
    def post(self, request):
        s = MFACodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            profile = _profile_for(request.user, lock=True)
            if profile.mfa_enabled or not profile.mfa_secret:
                raise APIError("invalid_state")
            if not mfa.check_code(profile, s.validated_data["code"]):
                raise APIError("mfa_invalid")
            plain, hashes = mfa.generate_recovery_codes()
            profile.mfa_enabled = True
            profile.mfa_enrolled_at = timezone.now()
            profile.recovery_codes = hashes
            profile.save()
        audit_log(request, "auth.mfa.enable", request.user, object_type="user")
        return Response({"recovery_codes": plain})


class MFADisableView(APIView):
    """POST /auth/mfa/disable {code} (authenticator code or a recovery code)."""

    @extend_schema(request=MFACodeSerializer, responses={200: dict})
    def post(self, request):
        code = str(request.data.get("code") or "").strip()
        with transaction.atomic():
            profile = _profile_for(request.user, lock=True)
            if not profile.mfa_enabled:
                raise APIError("invalid_state")
            if not (mfa.check_code(profile, code) or mfa.consume_recovery_code(profile, code)):
                raise APIError("mfa_invalid")
            profile.mfa_enabled = False
            profile.mfa_secret = None
            profile.mfa_enrolled_at = None
            profile.recovery_codes = []
            profile.save()
        audit_log(request, "auth.mfa.disable", request.user, object_type="user")
        return Response({"mfa_enabled": False})


class SessionListView(APIView):
    """GET /auth/sessions — active sessions; the caller's own one is flagged ``current``."""

    @extend_schema(responses=SessionDeviceSerializer(many=True))
    def get(self, request):
        qs = SessionDevice.objects.filter(user=request.user, revoked_at__isnull=True)
        ctx = {"current_sid": sessions.current_sid(request)}
        return Response(SessionDeviceSerializer(qs, many=True, context=ctx).data)


class SessionDetailView(APIView):
    """DELETE /auth/sessions/{id} — sign that device out."""

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        device = SessionDevice.objects.filter(user=request.user, pk=pk).first()
        if device is None:
            raise APIError("not_found", status_code=404)
        sessions.revoke(device)
        audit_log(
            request, "auth.session.revoke", request.user, object_type="user", changes={"session": str(pk)}
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionRevokeOthersView(APIView):
    """POST /auth/sessions/revoke-others → {revoked: n}."""

    @extend_schema(request=None, responses={200: dict})
    def post(self, request):
        n = sessions.revoke_all(request.user, except_id=sessions.current_sid(request))
        audit_log(
            request, "auth.session.revoke_others", request.user, object_type="user", changes={"revoked": n}
        )
        return Response({"revoked": n})


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=RefreshSerializer, responses={204: None})
    def post(self, request):
        s = RefreshSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        token = RefreshToken(s.validated_data["refresh"])
        token.blacklist()
        device = sessions.session_for_token(token)
        if device is not None:
            sessions.revoke(device)
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

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        new_refresh = (response.data or {}).get("refresh") if response.status_code == 200 else None
        if new_refresh:
            sessions.touch_after_refresh(new_refresh, request)
        return response


def _channel(request) -> str:
    platform = sessions._platform(request)
    return {"web": "web", "android": "app", "ios": "app"}.get(platform, "other")


class LegalCurrentView(APIView):
    """GET /legal/current — currently published legal documents (public)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "public"

    @extend_schema(responses={200: dict})
    def get(self, request):
        from .models import LegalDocument

        docs = LegalDocument.objects.filter(is_current=True).order_by("kind")
        return Response(
            [
                {
                    "id": str(d.pk),
                    "kind": d.kind,
                    "version": d.version,
                    "published_at": d.published_at.isoformat(),
                    "url": d.url,
                    "summary_en": d.summary_en,
                    "summary_ne": d.summary_ne,
                }
                for d in docs
            ]
        )


class LegalAcceptView(APIView):
    """POST /auth/legal/accept {document_ids} → {accepted, pending_legal}."""

    @extend_schema(request=dict, responses={200: dict})
    def post(self, request):
        from . import legal
        from .models import LegalDocument

        ids = request.data.get("document_ids")
        if not isinstance(ids, list) or not ids:
            raise APIError("validation_error", fields={"document_ids": ["Send at least one document id."]})
        docs = list(LegalDocument.objects.filter(pk__in=[str(i) for i in ids][:20], is_current=True))
        if len(docs) != len(set(map(str, ids))):
            raise APIError(
                "validation_error",
                fields={"document_ids": ["Unknown or outdated document. Reload and try again."]},
            )
        legal.accept(
            request.user,
            docs,
            ip=client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            channel=_channel(request),
        )
        for d in docs:
            audit_log(
                request,
                "legal.accept",
                d,
                object_type="legaldocument",
                changes={"kind": d.kind, "version": d.version, "channel": _channel(request)},
            )
        return Response(
            {
                "accepted": [legal.doc_ref(d) for d in docs],
                "pending_legal": [legal.doc_ref(d) for d in legal.pending_for(request.user)],
            }
        )
