from django.apps import AppConfig


class TrustConfig(AppConfig):
    name = "apps.trust"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from apps.core.files import register_check

        from . import signals  # noqa: F401
        from .disputes import can_download_evidence

        register_check("dispute_evidence", can_download_evidence)
