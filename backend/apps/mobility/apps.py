from django.apps import AppConfig


class MobilityConfig(AppConfig):
    name = "apps.mobility"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from apps.core.files import register_check

        from .services import can_download

        register_check("mobility", can_download)
