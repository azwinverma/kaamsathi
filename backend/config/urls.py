from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework import permissions
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.system_views import MetricsView
from apps.core.views import ReadinessView
from apps.geo.views import HealthView

admin.site.site_header = "KaamSathi ops admin"
admin.site.site_title = "KaamSathi admin"
admin.site.index_title = "Operations"


class DocsPermission(permissions.BasePermission):
    """API schema + Swagger UI: open in DEBUG, staff only otherwise."""

    def has_permission(self, request, view):
        if settings.DEBUG:
            return True
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.is_staff)


_docs = {
    "permission_classes": [DocsPermission],
    "authentication_classes": [SessionAuthentication, JWTAuthentication],
}

urlpatterns = [
    # Admin path is configurable (DJANGO_ADMIN_URL) to keep it off scanners' default list;
    # Django admin itself only admits active is_staff users.
    path(settings.DJANGO_ADMIN_URL, admin.site.urls),
    path("api/v1/", include("config.api_urls")),
    path("api/schema/", SpectacularAPIView.as_view(**_docs), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema", **_docs), name="swagger-ui"),
    re_path(r"^health/?$", HealthView.as_view(), name="root-health"),
    re_path(r"^readiness/?$", ReadinessView.as_view(), name="root-readiness"),
    re_path(r"^metrics/?$", MetricsView.as_view(), name="root-metrics"),
]

# Media is private (apps.core.files): ID photos, worker photos, certificates and exports are only
# reachable through signed /api/v1/files/<token> URLs. Local storage serves just the explicitly
# public prefixes (org logos); S3 storage presigns every URL itself.
if getattr(settings, "AWS_STORAGE_BUCKET_NAME", ""):
    pass
elif getattr(settings, "MEDIA_STORAGE", "local") == "database":
    from apps.core.views import PublicMediaView

    urlpatterns.append(
        re_path(rf"^{settings.MEDIA_URL.strip('/')}/(?P<path>[^\x00\\]+)$", PublicMediaView.as_view())
    )
else:
    for _prefix in settings.PUBLIC_MEDIA_PREFIXES:
        _p = _prefix.strip("/")
        urlpatterns.append(
            re_path(
                rf"^{settings.MEDIA_URL.strip('/')}/(?P<path>{_p}/(?:(?!\.\.)[^\x00\\])+)$",  # no traversal
                serve,
                {"document_root": settings.MEDIA_ROOT},
            )
        )

handler404 = "apps.core.exceptions.json_404"
handler500 = "apps.core.exceptions.json_500"
