from django.contrib import admin

from .models import Application, JobOpening, MinimumWage, StageEvent


@admin.register(MinimumWage)
class MinimumWageAdmin(admin.ModelAdmin):
    list_display = [
        "effective_from",
        "monthly_basic",
        "monthly_da",
        "monthly_total",
        "daily",
        "hourly",
        "hourly_part_time",
    ]


class ApplicationInline(admin.TabularInline):
    model = Application
    extra = 0
    fields = ["worker", "stage", "interview_at", "stage_changed_at"]
    readonly_fields = ["stage_changed_at"]
    autocomplete_fields = ["worker"]


@admin.register(JobOpening)
class JobOpeningAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "organization",
        "trade",
        "status",
        "openings_count",
        "wage_type",
        "wage_amount",
        "published_at",
    ]
    list_filter = ["status", "wage_type", "trade"]
    search_fields = ["title", "organization__name"]
    inlines = [ApplicationInline]


class StageEventInline(admin.TabularInline):
    model = StageEvent
    extra = 0
    readonly_fields = ["from_stage", "to_stage", "by", "note", "created_at"]


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["worker", "job", "stage", "interview_at", "stage_changed_at"]
    list_filter = ["stage"]
    search_fields = ["worker__full_name", "worker__phone", "job__title"]
    autocomplete_fields = ["worker", "job"]
    inlines = [StageEventInline]


@admin.register(StageEvent)
class StageEventAdmin(admin.ModelAdmin):
    list_display = ["application", "from_stage", "to_stage", "by", "created_at"]
    list_filter = ["to_stage"]
