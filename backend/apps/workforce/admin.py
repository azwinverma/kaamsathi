from django.contrib import admin

from .models import Advance, Attendance, Employment, Holiday, LeaveRequest


@admin.register(Employment)
class EmploymentAdmin(admin.ModelAdmin):
    list_display = [
        "worker",
        "organization",
        "designation",
        "site",
        "status",
        "wage_type",
        "start_date",
        "end_date",
        "ssf_enrolled",
    ]
    list_filter = ["status", "wage_type", "ssf_enrolled", "organization"]
    search_fields = ["worker__full_name", "worker__phone", "designation", "organization__name"]
    autocomplete_fields = ["worker", "organization"]
    date_hierarchy = "start_date"


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = [
        "employment",
        "date",
        "status",
        "method",
        "overtime_minutes",
        "check_in_at",
        "check_out_at",
    ]
    list_filter = ["status", "method"]
    search_fields = ["employment__worker__full_name"]
    date_hierarchy = "date"
    raw_id_fields = ["employment", "recorded_by"]


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ["employment", "leave_type", "from_date", "to_date", "days", "status"]
    list_filter = ["status", "leave_type"]
    raw_id_fields = ["employment", "decided_by"]


@admin.register(Advance)
class AdvanceAdmin(admin.ModelAdmin):
    list_display = ["employment", "amount", "given_on", "recover_per_month", "recovered_amount"]
    raw_id_fields = ["employment"]


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ["date", "name_en", "name_ne", "organization"]
    list_filter = ["organization"]
    search_fields = ["name_en", "name_ne"]
    date_hierarchy = "date"
