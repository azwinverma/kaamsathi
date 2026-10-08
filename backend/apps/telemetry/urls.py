from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("telemetry/events", views.EventIngestView, "telemetry-events"),
    p("ops/analytics/funnel", views.OpsFunnelView, "ops-analytics-funnel"),
    p("ops/analytics/retention", views.OpsRetentionView, "ops-analytics-retention"),
    *router.urls,
]
