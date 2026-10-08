from django.apps import AppConfig


class RiskConfig(AppConfig):
    name = "apps.risk"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from apps.orgs import kyb  # noqa: F401 - registers the signed-URL re-check for KYB documents

        from . import signals  # noqa: F401
