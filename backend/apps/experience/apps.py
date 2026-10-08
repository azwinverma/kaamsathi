from django.apps import AppConfig


class ExperienceConfig(AppConfig):
    name = "apps.experience"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from apps.core.files import register_check

        from .services import can_download_document

        register_check("work_history", can_download_document)
