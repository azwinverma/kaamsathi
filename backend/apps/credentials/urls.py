from django.urls import re_path

from apps.core.routers import Router

from . import views

router = Router()
router.register("me/credentials", views.MeCredentialViewSet, basename="me-credentials")
router.register("me/passport/shares", views.MePassportShareViewSet, basename="me-passport-shares")
router.register("ops/credentials", views.OpsCredentialViewSet, basename="ops-credentials")
router.register("ops/assessments", views.OpsAssessmentViewSet, basename="ops-assessments")


def p(route, view, name):
    return re_path(rf"^{route}/?$", view.as_view(), name=name)


urlpatterns = [
    p("me/passport", views.MePassportView, "me-passport"),
    re_path(r"^me/passport\.pdf$", views.MePassportPDFView.as_view(), name="me-passport-pdf"),
    re_path(
        r"^public/passport/s/(?P<token>[^/]+)/qr\.svg$",
        views.PublicShareQRView.as_view(),
        name="public-share-qr",
    ),
    p(r"public/passport/s/(?P<token>[^/]+)", views.PublicShareView, "public-passport-share"),
    re_path(
        r"^public/passport/(?P<code>[^/]+)/qr\.svg$",
        views.PublicPassportQRView.as_view(),
        name="public-passport-qr",
    ),
    p(r"public/passport/(?P<code>[^/]+)", views.PublicPassportView, "public-passport"),
    p("org/credentials/expiring", views.OrgExpiringCredentialsView, "org-credentials-expiring"),
    p(
        r"ops/workers/(?P<worker_id>[0-9a-f-]{36})/credentials",
        views.OpsWorkerCredentialsView,
        "ops-worker-credentials",
    ),
    *router.urls,
]
