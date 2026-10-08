from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])
OTP_DEV_CODE = env("OTP_DEV_CODE", default="123456")
CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=True)
# Run Celery tasks inline unless a worker is available (docker compose sets this to false).
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=True)
# Local E2E runs log the same demo phones in repeatedly: no resend cooldown, generous limits.
OTP_RESEND_COOLDOWN_SECONDS = env.int("OTP_RESEND_COOLDOWN_SECONDS", default=0)
OTP_MAX_PER_HOUR = env.int("OTP_MAX_PER_HOUR", default=1000)
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {
        **REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],  # noqa: F405
        "otp": env("THROTTLE_OTP", default="1000/hour"),
    },
}
