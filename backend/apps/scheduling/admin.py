from django.contrib import admin

from .models import RosterEntry


@admin.register(RosterEntry)
class RosterEntryAdmin(admin.ModelAdmin):
    list_display = ["employment", "date", "shift", "site", "is_off", "updated_at"]
    list_filter = ["is_off", "date"]
    search_fields = ["employment__worker__full_name", "employment__organization__name"]
    raw_id_fields = ["employment", "shift", "site", "created_by"]
    date_hierarchy = "date"
