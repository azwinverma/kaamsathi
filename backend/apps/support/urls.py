from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("me/support-cases", views.MeSupportCaseViewSet, basename="me-support-cases")
router.register("org/support-cases", views.OrgSupportCaseViewSet, basename="org-support-cases")
router.register("ops/support-cases", views.OpsSupportCaseViewSet, basename="ops-support-cases")
router.register("help/articles", views.HelpArticlePublicViewSet, basename="help-articles")
router.register("ops/help/articles", views.OpsHelpArticleViewSet, basename="ops-help-articles")

urlpatterns = [
    re_path(r"^ops/support/lookup/?$", views.OpsSupportLookupView.as_view(), name="ops-support-lookup"),
    *router.urls,
]
