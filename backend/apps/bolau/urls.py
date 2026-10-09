"""Bolau routes (docs/CONTRACT-BOLAU.md). Trailing slashes optional."""

from django.urls import re_path

from apps.core.routers import Router

from . import ops_views as ops
from . import views as v

UUID = "[0-9a-f-]{36}"
HANDLE = "[A-Za-z0-9-]{1,40}"


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    # Sipalu self-profile
    p("me/sipalu", v.MeSipaluView, "me-sipalu"),
    p("me/sipalu/onboarding-step", v.MeSipaluOnboardingView, "me-sipalu-onboarding"),
    p("me/sipalu/handle", v.MeSipaluHandleView, "me-sipalu-handle"),
    p("me/sipalu/services", v.MeServicesView, "me-sipalu-services"),
    p(rf"me/sipalu/services/(?P<service_id>{UUID})", v.MeServiceDetailView, "me-sipalu-service"),
    p("me/sipalu/availability", v.MeAvailabilityView, "me-sipalu-availability"),
    p("me/sipalu/time-off", v.MeTimeOffView, "me-sipalu-time-off"),
    p(rf"me/sipalu/time-off/(?P<time_off_id>{UUID})", v.MeTimeOffDetailView, "me-sipalu-time-off-detail"),
    p("me/sipalu/portfolio", v.MePortfolioView, "me-sipalu-portfolio"),
    p(rf"me/sipalu/portfolio/(?P<item_id>{UUID})", v.MePortfolioDetailView, "me-sipalu-portfolio-detail"),
    # Public + discovery
    p(rf"public/sipalu/(?P<handle>{HANDLE})", v.PublicSipaluView, "public-sipalu"),
    p("bolau/search", v.SearchView, "bolau-search"),
    p("bolau/trades", v.TradesView, "bolau-trades"),
    p("bolau/config", v.ConfigView, "bolau-config"),
    # Ghardhani
    p("me/ghardhani", v.MeGhardhaniView, "me-ghardhani"),
    p("me/addresses", v.MeAddressesView, "me-addresses"),
    p(rf"me/addresses/(?P<address_id>{UUID})", v.MeAddressDetailView, "me-address"),
    p("me/favourites", v.MeFavouritesView, "me-favourites"),
    p(rf"me/favourites/(?P<handle>{HANDLE})", v.MeFavouriteDetailView, "me-favourite"),
    # Bookings
    p("bolau/bookings", v.BookingsView, "bolau-bookings"),
    p(rf"bolau/bookings/(?P<booking_id>{UUID})", v.BookingDetailView, "bolau-booking"),
    p(rf"bolau/bookings/(?P<booking_id>{UUID})/dispute", v.BookingDisputeView, "bolau-booking-dispute"),
    p(rf"bolau/bookings/(?P<booking_id>{UUID})/contact", v.BookingContactView, "bolau-booking-contact"),
    p(rf"bolau/bookings/(?P<booking_id>{UUID})/fee/pay", v.BookingFeePayView, "bolau-booking-fee-pay"),
    p(rf"bolau/bookings/(?P<booking_id>{UUID})/receipt\.pdf", v.BookingReceiptView, "bolau-booking-receipt"),
    p(
        rf"bolau/bookings/(?P<booking_id>{UUID})/(?P<action>[a-z-]+)",
        v.BookingActionView,
        "bolau-booking-action",
    ),
    p(rf"bolau/ratings/(?P<rating_id>{UUID})/flag", v.RatingFlagView, "bolau-rating-flag"),
    p("me/bolau/bookings", v.MeBookingsView, "me-bolau-bookings"),
    p("me/bolau/jobs", v.MeJobsView, "me-bolau-jobs"),
    p(
        rf"me/bolau/bookings/(?P<booking_id>{UUID})/(?P<action>[a-z-]+)",
        v.MeJobActionView,
        "me-bolau-job-action",
    ),
    # Kaam requests & offers
    p("bolau/requests", v.RequestsView, "bolau-requests"),
    p(rf"bolau/requests/(?P<request_id>{UUID})", v.RequestDetailView, "bolau-request"),
    p(rf"bolau/requests/(?P<request_id>{UUID})/cancel", v.RequestCancelView, "bolau-request-cancel"),
    p(
        rf"bolau/requests/(?P<request_id>{UUID})/offers/(?P<offer_id>{UUID})/accept",
        v.OfferAcceptView,
        "bolau-offer-accept",
    ),
    p("me/bolau/requests", v.MeRequestsView, "me-bolau-requests"),
    p("me/bolau/requests/nearby", v.NearbyRequestsView, "me-bolau-requests-nearby"),
    p(rf"me/bolau/requests/(?P<request_id>{UUID})", v.MeRequestDetailView, "me-bolau-request"),
    p(rf"me/bolau/requests/(?P<request_id>{UUID})/offers", v.MeRequestOffersView, "me-bolau-request-offers"),
    p("me/bolau/offers", v.MeOffersView, "me-bolau-offers"),
    p(rf"me/bolau/offers/(?P<offer_id>{UUID})/withdraw", v.MeOfferWithdrawView, "me-bolau-offer-withdraw"),
    # Booking-fee gateway webhook
    re_path(r"^webhooks/bolau/(?P<provider>[a-z_]+)/?$", v.FeeWebhookView.as_view(), name="webhook-bolau"),
    # Ops
    p("ops/bolau/bookings", ops.OpsBookingsView, "ops-bolau-bookings"),
    p(rf"ops/bolau/bookings/(?P<booking_id>{UUID})", ops.OpsBookingDetailView, "ops-bolau-booking"),
    p(
        rf"ops/bolau/bookings/(?P<booking_id>{UUID})/cancel",
        ops.OpsBookingCancelView,
        "ops-bolau-booking-cancel",
    ),
    p(
        rf"ops/bolau/bookings/(?P<booking_id>{UUID})/reset-arrival",
        ops.OpsBookingResetArrivalView,
        "ops-bolau-booking-reset-arrival",
    ),
    p("ops/bolau/requests", ops.OpsRequestsView, "ops-bolau-requests"),
    p("ops/bolau/sipalu", ops.OpsSipaluView, "ops-bolau-sipalu"),
    p(
        rf"ops/bolau/sipalu/(?P<handle>{HANDLE})/(?P<action>suspend|unsuspend)",
        ops.OpsSipaluSuspendView,
        "ops-bolau-sipalu-suspend",
    ),
    p("ops/bolau/ratings", ops.OpsRatingsView, "ops-bolau-ratings"),
    p(
        rf"ops/bolau/ratings/(?P<rating_id>{UUID})/(?P<action>hide|restore|void)",
        ops.OpsRatingModerateView,
        "ops-bolau-rating-moderate",
    ),
    p("ops/bolau/reports", ops.OpsReportsView, "ops-bolau-reports"),
    p("ops/bolau/flags", ops.OpsFlagsView, "ops-bolau-flags"),
    p("ops/bolau/kpis", ops.OpsKpisView, "ops-bolau-kpis"),
    p("ops/bolau/fees", ops.OpsFeesView, "ops-bolau-fees"),
]

# Ghardhani side of booking disputes: list, detail, evidence, appeal.
_router = Router()
_router.register("me/booking-disputes", v.MeBookingDisputeViewSet, basename="me-booking-disputes")
urlpatterns += _router.urls
