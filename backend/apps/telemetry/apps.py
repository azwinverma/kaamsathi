from django.apps import AppConfig


class TelemetryConfig(AppConfig):
    name = "apps.telemetry"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from . import signals

        signals.connect()
