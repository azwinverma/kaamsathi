from .base import *  # noqa: F401,F403
from .base import REST_FRAMEWORK

DEBUG = True
OTP_DEV_CODE = ""
SECRET_KEY = "test-secret-key"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
SMS_BACKEND = "console"
STAFF_NO_PROFILE_SUPERADMIN = True  # DEBUG-only rule (staff_roles.py); pytest-django forces DEBUG=False
OTP_RESEND_COOLDOWN_SECONDS = 0  # tests that need it override the setting
FEATURE_FLAG_CACHE_SECONDS = 0  # DB rolls back between tests; a cached flag would leak
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "private": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        "anon": None,
        "user": None,
        "otp": None,
        "public": None,
        "files": None,
        "privacy": None,
    },
}
LOGGING = {"version": 1, "disable_existing_loggers": False, "root": {"level": "WARNING"}}
