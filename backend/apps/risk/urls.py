"""Trust-operations routes: risk flags, employer verification (KYB) and the trade taxonomy.

KYB views live in ``apps/orgs/kyb_views.py`` and taxonomy views in ``apps/workers/taxonomy_views.py``
(next to their models); they are routed here so the shared ``config/api_urls.py`` stays untouched.
"""

from django.urls import re_path

from apps.core.routers import Router
from apps.orgs import kyb_views
from apps.workers import taxonomy_views

from . import views

router = Router()
router.register("ops/risk/flags", views.OpsRiskFlagViewSet, basename="ops-risk-flags")
router.register("ops/employers", kyb_views.OpsEmployerViewSet, basename="ops-employers")
router.register("ops/taxonomy/trades", taxonomy_views.OpsTradeViewSet, basename="ops-taxonomy-trades")

urlpatterns = [
    re_path(r"^ops/risk/summary/?$", views.OpsRiskSummaryView.as_view(), name="ops-risk-summary"),
    re_path(r"^org/verification/?$", kyb_views.OrgVerificationView.as_view(), name="org-verification"),
    *router.urls,
]
