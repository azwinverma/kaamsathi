"""Payroll configuration routes (R001 pay groups, R003 pay policy). Runs/payslips: config/api_urls.py."""

from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("org/pay-groups", views.PayGroupViewSet, basename="org-pay-groups")

urlpatterns = [
    re_path(r"^org/pay-policy/?$", views.PayPolicyView.as_view(), name="org-pay-policy"),
    *router.urls,
]
