from django.urls import re_path

from apps.core.routers import Router

from . import ratings, views

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
    # rating moderation (N004)
    re_path(r"^me/ratings/?$", ratings.MeRatingsView.as_view(), name="me-ratings"),
    re_path(
        r"^me/ratings/(?P<rating_id>[0-9a-f-]{36})/flag/?$",
        ratings.MeRatingFlagView.as_view(),
        name="me-rating-flag",
    ),
    re_path(
        r"^org/ratings/received/?$", ratings.OrgRatingsReceivedView.as_view(), name="org-ratings-received"
    ),
    re_path(
        r"^org/ratings/(?P<rating_id>[0-9a-f-]{36})/flag/?$",
        ratings.OrgRatingFlagView.as_view(),
        name="org-rating-flag",
    ),
    re_path(r"^ops/ratings/?$", ratings.OpsRatingsView.as_view(), name="ops-ratings"),
    re_path(
        r"^ops/ratings/(?P<rating_id>[0-9a-f-]{36})/hide/?$",
        ratings.OpsRatingModerateView.as_view(action_name="hide"),
        name="ops-rating-hide",
    ),
    re_path(
        r"^ops/ratings/(?P<rating_id>[0-9a-f-]{36})/restore/?$",
        ratings.OpsRatingModerateView.as_view(action_name="restore"),
        name="ops-rating-restore",
    ),
    re_path(
        r"^ops/ratings/(?P<rating_id>[0-9a-f-]{36})/void/?$",
        ratings.OpsRatingVoidView.as_view(),
        name="ops-rating-void",
    ),
    *router.urls,
]
