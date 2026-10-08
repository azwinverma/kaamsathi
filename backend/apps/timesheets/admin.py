from django.contrib import admin

from .models import Timesheet, TimesheetPolicy


@admin.register(TimesheetPolicy)
class TimesheetPolicyAdmin(admin.ModelAdmin):
    list_display = ["organization", "ot_requires_approval", "weekly_ot_cap_minutes", "daily_regular_minutes"]


@admin.register(Timesheet)
class TimesheetAdmin(admin.ModelAdmin):
    list_display = ["employment", "week_start", "status", "regular_minutes", "overtime_minutes_claimed"]
    list_filter = ["status", "week_start"]
    raw_id_fields = ["employment", "submitted_by", "approved_by"]
