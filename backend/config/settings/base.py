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
]

MIDDLEWARE = [
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

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
# Optional S3-compatible media storage (e.g. AWS S3, DigitalOcean Spaces, MinIO).
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
if AWS_STORAGE_BUCKET_NAME:
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default=None)
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default=None)
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default=None)
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_FILE_OVERWRITE = False

DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# --- DRF --------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
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
    },
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
)
CORS_EXPOSE_HEADERS = ["Content-Disposition"]
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
PUBLIC_WEB_URL = env("PUBLIC_WEB_URL", default="http://localhost:3000")
PRIVACY_EXPORT_TTL_HOURS = env.int("PRIVACY_EXPORT_TTL_HOURS", default=72)

# --- Logging ----------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOG_JSON = env.bool("LOG_JSON", default=False)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
        "json": {"()": "apps.core.logging.JsonFormatter"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "json" if LOG_JSON else "plain"},
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.db.backends": {"level": "WARNING"},
        "kaamsathi": {"level": LOG_LEVEL, "propagate": True},
    },
}
