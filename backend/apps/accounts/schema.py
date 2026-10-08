"""drf-spectacular extensions: document ``SessionJWTAuthentication`` as bearer JWT (OpenAPI)."""

from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme


class SessionJWTScheme(SimpleJWTScheme):
    target_class = "apps.accounts.sessions.SessionJWTAuthentication"
    name = "bearerAuth"  # distinct from simplejwt's "jwtAuth" (docs views)
