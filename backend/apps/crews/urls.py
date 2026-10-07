from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("ops/crews", views.OpsCrewViewSet, basename="ops-crews")
router.register("ops/referrals", views.OpsReferralViewSet, basename="ops-referrals")

urlpatterns = [
    re_path(r"^me/crew/?$", views.MeCrewView.as_view(), name="me-crew"),
    re_path(r"^me/crew/members/?$", views.MeCrewMembersView.as_view(), name="me-crew-members"),
    re_path(
        r"^me/crew/members/(?P<worker_id>[0-9a-f-]{36})/?$",
        views.MeCrewMemberDetailView.as_view(),
        name="me-crew-member",
    ),
    re_path(r"^me/crew/referrals/?$", views.MeCrewReferralsView.as_view(), name="me-crew-referrals"),
    *router.urls,
]
