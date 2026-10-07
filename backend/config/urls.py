from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.geo.views import HealthView

admin.site.site_header = "KaamSathi ops admin"
admin.site.site_title = "KaamSathi admin"
admin.site.index_title = "Operations"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("config.api_urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    re_path(r"^health/?$", HealthView.as_view(), name="root-health"),
]

if settings.DEBUG or not getattr(settings, "AWS_STORAGE_BUCKET_NAME", ""):
    # Local media (S3 serves its own). In production put a CDN / nginx in front if volume grows.
    urlpatterns += [re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT})]

handler404 = "apps.core.exceptions.json_404"
handler500 = "apps.core.exceptions.json_500"
