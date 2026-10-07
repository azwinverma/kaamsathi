from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("ops/finance/offers", views.OpsOfferViewSet, basename="ops-finance-offers")

UUID = "[0-9a-f-]{36}"


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("me/financial-profile", views.MeFinancialProfileView, "me-financial-profile"),
    p("me/offers", views.MeOffersView, "me-offers"),
    p(rf"me/offers/(?P<offer_id>{UUID})/apply", views.MeOfferApplyView, "me-offer-apply"),
    p("me/referrals", views.MeReferralsView, "me-referrals"),
    p("ops/finance/referrals", views.OpsReferralsView, "ops-finance-referrals"),
    p("ops/finance/summary", views.OpsFinanceSummaryView, "ops-finance-summary"),
    *router.urls,
]
