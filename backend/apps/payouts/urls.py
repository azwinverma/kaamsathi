from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("org/payouts", views.PayoutBatchViewSet, basename="org-payouts")

urlpatterns = [
    re_path(
        r"^org/payroll-runs/(?P<pk>[0-9a-fA-F-]{36})/payouts/?$",
        views.RunPayoutsView.as_view(),
        name="org-run-payouts",
    ),
    re_path(
        r"^webhooks/payouts/(?P<provider>[a-z_]+)/?$",
        views.PayoutWebhookView.as_view(),
        name="webhook-payouts",
    ),
    *router.urls,
]
