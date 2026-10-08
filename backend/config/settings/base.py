"""Base settings shared by every environment. All secrets/config come from env."""

from datetime import timedelta
from pathlib import Path

import environ
from celery.schedules import crontab
from django.utils.translation import gettext_lazy as _

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
# Load backend/.env and then the repo-root .env (first value wins).
for candidate in (BASE_DIR / ".env", BASE_DIR.parent / ".env"):
    if candidate.exists():
        environ.Env.read_env(str(candidate), overwrite=False)

SECRET_KEY = env("DJANGO_SECRET_KEY", default="insecure-dev-key-change-me")
# Older keys still accepted for signatures (sessions, signed file URLs) during key rotation.
SECRET_KEY_FALLBACKS = env.list("DJANGO_SECRET_KEY_FALLBACKS", default=[])
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    "django_celery_beat",
    # local
    "apps.core",
    "apps.accounts",
    "apps.geo",
    "apps.orgs",
    "apps.workers",
    "apps.hiring",
    "apps.workforce",
    "apps.payroll",
    "apps.billing",
    "apps.audit",
    "apps.notifications",
    # ecosystem (docs/CONTRACT-ECOSYSTEM.md)
    "apps.trust",
    "apps.crews",
    "apps.credentials",
    "apps.training",
    "apps.compliance",
    "apps.payouts",
    "apps.scheduling",
    "apps.partners",
    "apps.finance",
    "apps.insights",
    "apps.privacy",
    # reference-gap modules (docs/CONTRACT-EXTENSIONS.md)
    "apps.risk",
    "apps.support",
    "apps.experience",
    "apps.timesheets",
    "apps.integrations",
    "apps.mobility",
    "apps.telemetry",
]

MIDDLEWARE = [
    "apps.core.request_id.RequestIDMiddleware",
    "apps.core.maintenance.MaintenanceMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
# Django admin lives at a non-default path in production (e.g. "ks-ops-7f3a/"); staff only.
DJANGO_ADMIN_URL = env("DJANGO_ADMIN_URL", default="admin/").strip("/") + "/"
# Release identifier (git SHA / tag) — set by the deploy; shown in /readiness and Sentry.
RELEASE = env("RELEASE", default="")

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://kaamsathi:kaamsathi@localhost:5433/kaamsathi")
}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

# --- i18n -------------------------------------------------------------------
LANGUAGE_CODE = "en"
LANGUAGES = [("en", _("English")), ("ne", _("Nepali"))]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = "Asia/Kathmandu"
USE_I18N = True
USE_TZ = True

# --- static / media ---------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))

# Media is PRIVATE by default: citizenship ID photos, worker photos, certificates, contracts
# and privacy exports are served only through short-lived signed URLs (apps.core.files,
# GET /api/v1/files/<token>). Only these prefixes may be served/linked directly:
PUBLIC_MEDIA_PREFIXES = env.list("PUBLIC_MEDIA_PREFIXES", default=["org-logos/"])
FILE_URL_TTL_SECONDS = env.int("FILE_URL_TTL_SECONDS", default=600)
# Absolute origin used in signed file URLs, e.g. https://api.kaamsathi.com (empty = request host).
API_PUBLIC_URL = env("API_PUBLIC_URL", default="")
# S3 only: redirect /files/<token> to a 60 s presigned URL instead of streaming through Django.
FILES_S3_REDIRECT = env.bool("FILES_S3_REDIRECT", default=False)

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # New sensitive documents (privacy exports, …): FileField(storage=apps.core.files.private_storage)
    "private": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {"location": str(MEDIA_ROOT / "private"), "base_url": None},
    },
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
# Optional S3-compatible media storage (e.g. AWS S3, DigitalOcean Spaces, MinIO).
# The bucket must be PRIVATE (block all public access). Objects are written without an ACL
# (bucket-owner only) and every URL boto3 generates is a presigned, expiring URL.
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
if AWS_STORAGE_BUCKET_NAME:
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default=None)
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default=None)
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default=None)
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = FILE_URL_TTL_SECONDS
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
    STORAGES["private"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": env("AWS_PRIVATE_BUCKET_NAME", default=AWS_STORAGE_BUCKET_NAME),
            "location": "private",
            "default_acl": None,
            "querystring_auth": True,
            "querystring_expire": 60,
            "file_overwrite": False,
        },
    }

DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# --- DRF --------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # JWT + refuses access tokens of signed-out sessions (apps/accounts/sessions.py).
        "apps.accounts.sessions.SessionJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "apps.core.exceptions.exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="120/minute"),
        "user": env("THROTTLE_USER", default="600/minute"),
        "otp": env("THROTTLE_OTP", default="30/hour"),
        # Unauthenticated public pages (Skill Passport, /public/*).
        "public": env("THROTTLE_PUBLIC", default="60/minute"),
        # Signed file downloads (/files/<token>).
        "files": env("THROTTLE_FILES", default="240/minute"),
        # Privacy requests (export/deletion) — expensive, rarely needed.
        "privacy": env("THROTTLE_PRIVACY", default="10/hour"),
    },
    # Number of trusted reverse proxies in front of Django (Caddy = 1) so throttles key on the
    # real client IP from X-Forwarded-For instead of the proxy's address.
    "NUM_PROXIES": env.int("NUM_PROXIES", default=None),
    "COERCE_DECIMAL_TO_STRING": True,
    "DATETIME_FORMAT": "iso-8601",
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=30)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=30)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "SIGNING_KEY": env("JWT_SIGNING_KEY", default=SECRET_KEY),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "KaamSathi API",
    "DESCRIPTION": "Hiring, hajiri (attendance) and BS-month payroll for Nepal's blue-collar workforce.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    "DISABLE_ERRORS_AND_WARNINGS": True,
    # Schema-generation hints are not deploy/security issues; keep `check --deploy` signal clean.
    "ENABLE_DJANGO_DEPLOY_CHECK": False,
}

# --- CORS / CSRF ------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS", default=["http://localhost:3000", "http://127.0.0.1:3000"]
)
CORS_ALLOW_HEADERS = (
    "accept",
    "accept-language",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-org-id",
    "x-request-id",
    "idempotency-key",
    "x-client-platform",
)
CORS_EXPOSE_HEADERS = ["Content-Disposition", "X-Request-ID", "Idempotent-Replayed"]
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# --- Cache / Celery ---------------------------------------------------------
REDIS_URL = env("REDIS_URL", default="redis://localhost:6380/0")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6380/1")
CELERY_RESULT_BACKEND = None
CELERY_TASK_IGNORE_RESULT = True
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_BEAT_SCHEDULE = {
    # Billing: runs daily, acts on BS day 2 (after subscription charges on day 1). Telemetry purge weekly.
    "generate-monthly-invoices": {
        "task": "apps.billing.tasks.generate_monthly_invoices",
        "schedule": crontab(hour=1, minute=45),
    },
    "telemetry-purge": {
        "task": "apps.telemetry.tasks.purge_old_events",
        "schedule": crontab(hour=3, minute=30, day_of_week=1),
    },
    # Job alerts (instant alerts fire on publish; digests at 07:00 NPT — workers check phones early).
    "job-alert-digest-daily": {
        "task": "apps.hiring.tasks.job_alert_digest",
        "schedule": crontab(hour=7, minute=0),
        "args": ("daily",),
    },
    "job-alert-digest-weekly": {
        "task": "apps.hiring.tasks.job_alert_digest",
        "schedule": crontab(hour=7, minute=15, day_of_week=0),
        "args": ("weekly",),
    },
    "risk-anomaly-scan": {"task": "apps.risk.tasks.scan", "schedule": crontab(hour=4, minute=0)},
    "support-sla-escalation": {
        "task": "apps.support.tasks.escalate_overdue",
        "schedule": crontab(minute="*/30"),
    },
    "mobility-document-expiry": {
        "task": "apps.mobility.tasks.expiry_reminders",
        "schedule": crontab(hour=8, minute=30),
    },
    "integrations-webhook-retry": {
        "task": "apps.integrations.tasks.retry_deliveries",
        "schedule": crontab(minute="*/10"),
    },
    # Notification deliveries held for quiet hours or waiting for an SMS/push/email retry.
    "notifications-process-deliveries": {
        "task": "apps.notifications.tasks.process_deliveries",
        "schedule": crontab(minute="*/5"),
    },
    # Runs daily; only acts on BS day 1 (start of a Nepali month).
    "monthly-subscription-charges": {
        "task": "apps.billing.tasks.monthly_subscription_charges",
        "schedule": crontab(hour=0, minute=30),
    },
    "recompute-trust-scores": {
        "task": "apps.trust.tasks.recompute_all",
        "schedule": crontab(hour=1, minute=0),
    },
    "naike-referral-eligibility": {
        "task": "apps.crews.tasks.update_referral_eligibility",
        "schedule": crontab(hour=1, minute=30),
    },
    "credential-expiry-reminders": {
        "task": "apps.credentials.tasks.expiry_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    "ssf-filing-reminders": {
        "task": "apps.compliance.tasks.ssf_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
    "refresh-financial-profiles": {
        "task": "apps.finance.tasks.refresh_all_profiles",
        "schedule": crontab(hour=2, minute=0),
    },
    "expire-partner-consents": {
        "task": "apps.partners.tasks.expire_grants",
        "schedule": crontab(minute=15),
    },
    # Security & platform (apps/core/tasks.py): proves beat + a worker are alive (/ops/system/health).
    "system-beat-heartbeat": {
        "task": "apps.core.tasks.beat_heartbeat",
        "schedule": crontab(minute="*/5"),
    },
    "idempotency-records-purge": {
        "task": "apps.core.tasks.purge_idempotency_records",
        "schedule": crontab(hour=3, minute=30),
    },
    "privacy-retention": {
        "task": "apps.privacy.tasks.process_requests",
        "schedule": crontab(hour=3, minute=0),
    },
}

# --- KaamSathi domain settings ----------------------------------------------
OTP_DEV_CODE = env("OTP_DEV_CODE", default="")
OTP_TTL_SECONDS = 300
OTP_MAX_ATTEMPTS = 5
OTP_MAX_PER_HOUR = 5

SMS_BACKEND = env("SMS_BACKEND", default="console")  # console | sparrow | aakash
SMS_SENDER_ID = env("SMS_SENDER_ID", default="KaamSathi")
SPARROW_SMS_TOKEN = env("SPARROW_SMS_TOKEN", default="")
SPARROW_SMS_FROM = env("SPARROW_SMS_FROM", default="InfoSMS")
SPARROW_SMS_URL = env("SPARROW_SMS_URL", default="https://api.sparrowsms.com/v2/sms/")
AAKASH_SMS_TOKEN = env("AAKASH_SMS_TOKEN", default="")
AAKASH_SMS_URL = env("AAKASH_SMS_URL", default="https://sms.aakashsms.com/sms/v3/send")

PLACEMENT_FEE = env("PLACEMENT_FEE", default="5000.00")
SUBSCRIPTION_PER_WORKER = env("SUBSCRIPTION_PER_WORKER", default="150.00")
SUBSCRIPTION_MINIMUM = env("SUBSCRIPTION_MINIMUM", default="3000.00")
REPLACEMENT_WINDOW_DAYS = 30

# --- Ecosystem (docs/CONTRACT-ECOSYSTEM.md) -----------------------------------
NAIKE_REFERRAL_FEE = env("NAIKE_REFERRAL_FEE", default="500.00")
NAIKE_REFERRAL_HOLD_DAYS = env.int("NAIKE_REFERRAL_HOLD_DAYS", default=30)
SSF_DUE_DAYS = env.int("SSF_DUE_DAYS", default=15)  # days after BS month end; verify with SSF
PAYOUT_PROVIDERS = env.list("PAYOUT_PROVIDERS", default=["bank_file"])  # + esewa, khalti, connectips
PAYOUT_WEBHOOK_SECRETS = env.dict("PAYOUT_WEBHOOK_SECRETS", default={})
PARTNER_GRANT_MAX_DAYS = env.int("PARTNER_GRANT_MAX_DAYS", default=90)
# Devanagari TTF for PDFs (contracts, passport, privacy export). Bundled Mukta is used when unset;
# install `uharfbuzz` (in requirements) so conjunct letters are shaped correctly.
PDF_DEVANAGARI_FONT = env(
    "PDF_DEVANAGARI_FONT", default=str(BASE_DIR / "assets" / "fonts" / "Mukta-Regular.ttf")
)
# Field encryption (apps/core/crypto.py): Fernet keys newest-first, and the blind-index HMAC key.
FIELD_ENCRYPTION_KEYS = env.list("FIELD_ENCRYPTION_KEYS", default=[])
FIELD_HASH_KEY = env("FIELD_HASH_KEY", default="")
PUBLIC_WEB_URL = env("PUBLIC_WEB_URL", default="http://localhost:3000")
PRIVACY_EXPORT_TTL_HOURS = env.int("PRIVACY_EXPORT_TTL_HOURS", default=72)
# Trust operations (docs/CONTRACT-EXTENSIONS.md §2): ops may only shortlist for verified employers.
KYB_REQUIRED_FOR_SHORTLIST = env.bool("KYB_REQUIRED_FOR_SHORTLIST", default=True)
# Push notifications (FCM HTTP v1). Disabled unless both are set; the service account JSON may be
# inline JSON or a path to the downloaded key file.
FCM_PROJECT_ID = env("FCM_PROJECT_ID", default="")
FCM_SERVICE_ACCOUNT_JSON = env("FCM_SERVICE_ACCOUNT_JSON", default="")
# Enterprise webhooks: request timeout (seconds) for each delivery attempt.
WEBHOOK_TIMEOUT_SECONDS = env.int("WEBHOOK_TIMEOUT_SECONDS", default=10)
# Transactional email (notifications email channel). Console in dev; SMTP in production.
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=10)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="KaamSathi <no-reply@kaamsathi.com.np>")

# --- Security & platform (docs/CONTRACT-EXTENSIONS.md §1) ---------------------
# Staff must enrol TOTP before any /ops/* call (prod settings force True).
STAFF_MFA_REQUIRED = env.bool("STAFF_MFA_REQUIRED", default=False)
# Bearer token for GET /api/v1/metrics (Prometheus). Empty = endpoint returns 404.
METRICS_TOKEN = env("METRICS_TOKEN", default="")
# Optional ClamAV daemon for upload scanning (clamd INSTREAM over TCP). Empty host = skipped.
CLAMAV_HOST = env("CLAMAV_HOST", default="")
CLAMAV_PORT = env.int("CLAMAV_PORT", default=3310)
CLAMAV_TIMEOUT = env.float("CLAMAV_TIMEOUT", default=10.0)
# True = reject uploads while the configured scanner is unreachable (fail closed).
CLAMAV_REQUIRED = env.bool("CLAMAV_REQUIRED", default=False)
# Incident switch (apps/core/maintenance.py): off | read_only | full. `manage.py maintenance` overrides.
MAINTENANCE_MODE = env("MAINTENANCE_MODE", default="off")
# Idempotency-Key replay window.
IDEMPOTENCY_TTL_HOURS = env.int("IDEMPOTENCY_TTL_HOURS", default=24)

# --- Logging ----------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOG_JSON = env.bool("LOG_JSON", default=False)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "plain": {"format": "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"},
        "json": {"()": "apps.core.logging.JsonFormatter"},
    },
    "filters": {"request_id": {"()": "apps.core.request_id.RequestIDFilter"}},
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json" if LOG_JSON else "plain",
            "filters": ["request_id"],
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.db.backends": {"level": "WARNING"},
        "kaamsathi": {"level": LOG_LEVEL, "propagate": True},
    },
}
