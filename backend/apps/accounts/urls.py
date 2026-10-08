"""Security routes: MFA, sessions, staff admin (auth/otp, me, refresh, logout stay in config/api_urls)."""

from django.urls import re_path

from . import ops_views, views

UUID = r"[0-9a-f-]{36}"

urlpatterns = [
    re_path(r"^legal/current/?$", views.LegalCurrentView.as_view(), name="legal-current"),
    re_path(r"^auth/legal/accept/?$", views.LegalAcceptView.as_view(), name="auth-legal-accept"),
    re_path(r"^auth/mfa/verify/?$", views.MFAVerifyView.as_view(), name="auth-mfa-verify"),
    re_path(r"^auth/mfa/setup/?$", views.MFASetupView.as_view(), name="auth-mfa-setup"),
    re_path(r"^auth/mfa/qr\.svg$", views.MFAQRView.as_view(), name="auth-mfa-qr"),
    re_path(r"^auth/mfa/confirm/?$", views.MFAConfirmView.as_view(), name="auth-mfa-confirm"),
    re_path(r"^auth/mfa/disable/?$", views.MFADisableView.as_view(), name="auth-mfa-disable"),
    re_path(r"^auth/sessions/?$", views.SessionListView.as_view(), name="auth-sessions"),
    re_path(
        r"^auth/sessions/revoke-others/?$",
        views.SessionRevokeOthersView.as_view(),
        name="auth-sessions-revoke-others",
    ),
    re_path(
        rf"^auth/sessions/(?P<pk>{UUID})/?$", views.SessionDetailView.as_view(), name="auth-session-detail"
    ),
    re_path(r"^ops/staff/?$", ops_views.StaffListView.as_view(), name="ops-staff"),
    re_path(rf"^ops/staff/(?P<pk>{UUID})/?$", ops_views.StaffDetailView.as_view(), name="ops-staff-detail"),
    re_path(
        rf"^ops/staff/(?P<pk>{UUID})/reset-mfa/?$",
        ops_views.StaffResetMFAView.as_view(),
        name="ops-staff-reset-mfa",
    ),
]
