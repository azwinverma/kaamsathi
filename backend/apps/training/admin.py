from django.contrib import admin

from .models import Course, Enrollment, TrainingProvider


class CourseInline(admin.TabularInline):
    model = Course
    extra = 0
    fields = ["title", "trade", "level", "starts_on", "seats", "status"]


@admin.register(TrainingProvider)
class TrainingProviderAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "ctevt_affiliation_no", "district", "phone", "is_active"]
    list_filter = ["kind", "is_active"]
    search_fields = ["name", "name_ne", "ctevt_affiliation_no"]
    inlines = [CourseInline]


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "provider",
        "trade",
        "level",
        "mode",
        "district",
        "starts_on",
        "seats",
        "fee",
        "status",
    ]
    list_filter = ["status", "level", "mode", "trade", "leads_to_nstb"]
    search_fields = ["title", "title_ne", "provider__name"]


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ["worker", "course", "status", "sponsored_by_org", "applied_at", "completed_on"]
    list_filter = ["status"]
    search_fields = ["worker__full_name", "worker__phone", "course__title"]
    autocomplete_fields = ["worker"]
    readonly_fields = ["credential", "applied_at"]


from .models import SessionAttendance, TrainingSession  # noqa: E402


@admin.register(TrainingSession)
class TrainingSessionAdmin(admin.ModelAdmin):
    list_display = ["course", "date", "start_time", "end_time", "topic"]
    raw_id_fields = ["course"]


@admin.register(SessionAttendance)
class SessionAttendanceAdmin(admin.ModelAdmin):
    list_display = ["session", "enrollment", "present", "marked_at"]
    raw_id_fields = ["session", "enrollment", "marked_by"]
