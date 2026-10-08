"""Worker growth routes (docs/CONTRACT-EXTENSIONS.md §3): external work history, plus the worker-side
hiring endpoints (recommended jobs, interest, my applications)
whose views live in apps.hiring (also offers received, job alerts and /org/offers)."""

from django.urls import re_path

from apps.core.routers import Router
from apps.hiring import me_views as hiring_me
from apps.hiring import views as hiring_views

from . import views

router = Router()
router.register("me/work-history", views.MeWorkHistoryViewSet, basename="me-work-history")
router.register("ops/work-history", views.OpsWorkHistoryViewSet, basename="ops-work-history")
router.register("org/work-history", views.OrgWorkHistoryViewSet, basename="org-work-history")
router.register("me/applications", hiring_me.MeApplicationViewSet, basename="me-applications")
router.register("me/job-offers", hiring_me.MeJobOfferViewSet, basename="me-job-offers")
router.register("me/job-alerts", hiring_me.MeJobAlertViewSet, basename="me-job-alerts")
router.register("org/offers", hiring_views.OfferViewSet, basename="org-offers")


def p(route, view, name):
    return re_path(rf"^{route}/?$", view, name=name)


urlpatterns = [
    p(
        "org/work-history-confirmations",
        views.OrgWorkHistoryViewSet.as_view({"get": "list"}),
        "org-work-history-confirmations",
    ),
    p("me/jobs/recommended", hiring_me.RecommendedJobsView.as_view(), "me-jobs-recommended"),
    p(r"me/jobs/(?P<job_id>[0-9a-f-]{36})/interest", hiring_me.JobInterestView.as_view(), "me-job-interest"),
    *router.urls,
]
