from .base import *  # noqa: F401,F403
from .base import LOGGING, RELEASE, env

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY")  # required in production
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
OTP_DEV_CODE = ""  # never in production
FIELD_KEYS_REQUIRED = True  # apps/core/crypto.py refuses to fall back to SECRET_KEY-derived keys
STAFF_MFA_REQUIRED = env.bool("STAFF_MFA_REQUIRED", default=True)  # TOTP for every ops staff member

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/?$", r"^api/v1/readiness/?$", r"^health/?$", r"^readiness/?$"]
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 365)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_AGE = 60 * 60 * 8  # admin sessions: one working day

LOGGING["handlers"]["console"]["formatter"] = "json" if env.bool("LOG_JSON", default=True) else "plain"

SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.0),
        send_default_pii=False,
        environment=env("SENTRY_ENVIRONMENT", default="production"),
        release=RELEASE or None,
    )
