from django.apps import AppConfig


class CrewsConfig(AppConfig):
    name = "apps.crews"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from . import signals  # noqa: F401
