from django.urls import re_path

from . import views

urlpatterns = [
    re_path(r"^ops/audit/?$", views.AuditLogListView.as_view(), name="ops-audit"),
    re_path(r"^ops/audit/verify/?$", views.AuditVerifyView.as_view(), name="ops-audit-verify"),
]
