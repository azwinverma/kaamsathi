"""Hiring routes added by the checklist completion (interviews, tags, matching config). Older hiring
routes live in ``config/api_urls.py`` and ``apps/experience/urls.py``."""

from django.urls import re_path

from apps.core.routers import Router

from . import ops_config_views, views

router = Router()
router.register("org/interviews", views.InterviewViewSet, basename="org-interviews")


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("org/application-tags", views.ApplicationTagsView, "org-application-tags"),
    p("ops/matching/config", ops_config_views.MatchConfigView, "ops-matching-config"),
    p("ops/matching/config/reset", ops_config_views.MatchConfigResetView, "ops-matching-config-reset"),
    *router.urls,
]
