from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("ops/partners", views.OpsPartnerViewSet, basename="ops-partners")

UUID = "[0-9a-f-]{36}"


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    # partner API (Authorization: Partner ks_<prefix>_<secret>)
    p(
        rf"partner/workers/(?P<worker_id>{UUID})/profile",
        views.PartnerWorkerProfileView,
        "partner-worker-profile",
    ),
    p(
        rf"partner/workers/(?P<worker_id>{UUID})/earnings",
        views.PartnerWorkerEarningsView,
        "partner-worker-earnings",
    ),
    p(
        rf"partner/workers/(?P<worker_id>{UUID})/mobility",
        views.PartnerWorkerMobilityView,
        "partner-worker-mobility",
    ),
    p("partner/grants", views.PartnerGrantsView, "partner-grants"),
    p("partner/referrals", views.PartnerReferralsView, "partner-referrals"),
    p(
        rf"partner/referrals/(?P<referral_id>{UUID})/status",
        views.PartnerReferralStatusView,
        "partner-referral-status",
    ),
    # worker
    p("me/partners", views.MePartnersView, "me-partners"),
    p("me/grants", views.MeGrantsView, "me-grants"),
    p(rf"me/grants/(?P<grant_id>{UUID})/revoke", views.MeGrantRevokeView, "me-grant-revoke"),
    p("me/partner-access", views.MePartnerAccessView, "me-partner-access"),
    *router.urls,
]
