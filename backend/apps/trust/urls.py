from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("me/disputes", views.MeDisputeViewSet, basename="me-disputes")
router.register("org/disputes", views.OrgDisputeViewSet, basename="org-disputes")
router.register("ops/disputes", views.OpsDisputeViewSet, basename="ops-disputes")

urlpatterns = [
    re_path(r"^me/trust/?$", views.MeTrustView.as_view(), name="me-trust"),
    re_path(r"^me/profile-views/?$", views.MeProfileViewsView.as_view(), name="me-profile-views"),
    re_path(
        r"^me/employments/(?P<employment_id>[0-9a-f-]{36})/rate/?$",
        views.MeRateEmployerView.as_view(),
        name="me-employment-rate",
    ),
    *router.urls,
]
