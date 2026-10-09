from django.apps import AppConfig


class BolauConfig(AppConfig):
    name = "apps.bolau"
    verbose_name = "Bolau (Sipalu bookings)"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from apps.core.files import register_check

        from .payloads import can_download_photo, can_download_portfolio, can_download_request_photo

        register_check("bolau_photo", can_download_photo)
        register_check("bolau_portfolio", can_download_portfolio)
        register_check("bolau_request_photo", can_download_request_photo)
