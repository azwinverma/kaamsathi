from django.contrib import admin

from .models import FeatureFlag


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    """Prefer /ops/flags (audited); the admin is a fallback."""

    list_display = ["key", "enabled", "rollout", "percent", "client_visible", "updated_at"]
    list_filter = ["enabled", "rollout", "client_visible"]
    search_fields = ["key", "description"]
    raw_id_fields = ["updated_by"]
