from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    name = "apps.integrations"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from . import signals

        signals.register()
