from django.apps import AppConfig


class TrustConfig(AppConfig):
    name = "apps.trust"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from . import signals  # noqa: F401
