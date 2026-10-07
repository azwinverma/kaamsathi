from django.contrib import admin

from .models import Membership, Organization, Shift, Site


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    autocomplete_fields = ["user"]
    filter_horizontal = ["sites"]


class SiteInline(admin.TabularInline):
    model = Site
    extra = 0
    fields = ["name", "district", "lat", "lng", "geofence_radius_m", "is_active"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "industry", "district", "plan", "is_active", "created_at"]
    list_filter = ["industry", "plan", "is_active", "district__province"]
    search_fields = ["name", "name_ne", "phone"]
    inlines = [SiteInline, MembershipInline]


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "district", "geofence_radius_m", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name", "organization__name"]
    readonly_fields = ["qr_token"]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role", "is_active", "created_at"]
    list_filter = ["role", "is_active"]
    search_fields = ["user__phone", "user__full_name", "organization__name"]
    autocomplete_fields = ["user", "organization"]
    filter_horizontal = ["sites"]


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "start_time", "end_time", "break_minutes"]
    search_fields = ["name", "organization__name"]
