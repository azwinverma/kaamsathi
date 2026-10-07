from django.apps import AppConfig


class CredentialsConfig(AppConfig):
    name = "apps.credentials"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from apps.core.files import register_check

        from .services import can_download_credential, can_download_passport_photo

        register_check("credential", can_download_credential)
        register_check("passport_photo", can_download_passport_photo)
