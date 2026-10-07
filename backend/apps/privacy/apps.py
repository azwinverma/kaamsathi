from django.apps import AppConfig


class PrivacyConfig(AppConfig):
    name = "apps.privacy"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from apps.core.files import register_check

        from .services import can_download_check

        register_check("privacy", can_download_check)
