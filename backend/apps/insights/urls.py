from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("org/analytics", views.OrgAnalyticsView, "org-analytics"),
    p("ops/insights/labour-market", views.OpsLabourMarketView, "ops-insights-labour-market"),
    p(r"ops/insights/export\.csv", views.OpsInsightsExportView, "ops-insights-export"),
    p("ops/insights/heatmap", views.OpsHeatmapView, "ops-insights-heatmap"),
    p("ops/kpis", views.OpsKPIView, "ops-kpis"),
    p("me/career", views.MeCareerView, "me-career"),
    *router.urls,
]
