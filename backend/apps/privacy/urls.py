from apps.core.routers import Router

from . import views

router = Router()
router.register("me/privacy-requests", views.MePrivacyRequestViewSet, basename="me-privacy-requests")
router.register("ops/privacy-requests", views.OpsPrivacyRequestViewSet, basename="ops-privacy-requests")

urlpatterns = [*router.urls]
