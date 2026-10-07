from django.contrib import admin

from .models import ConsentGrant, Partner, PartnerAccessLog, PartnerAPIKey


class PartnerAPIKeyInline(admin.TabularInline):
    model = PartnerAPIKey
    extra = 0
    fields = ("name", "prefix", "scopes", "created_at", "last_used_at", "revoked_at")
    readonly_fields = ("prefix", "created_at", "last_used_at")
    can_delete = False
    show_change_link = True


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "regulator", "license_no", "is_active", "created_at")
    list_filter = ("kind", "regulator", "is_active")
    search_fields = ("name", "license_no", "contact_email")
    readonly_fields = ("created_at",)
    exclude = ("webhook_secret",)
    inlines = [PartnerAPIKeyInline]


@admin.register(PartnerAPIKey)
class PartnerAPIKeyAdmin(admin.ModelAdmin):
    list_display = ("partner", "name", "prefix", "created_at", "last_used_at", "revoked_at")
    list_filter = ("partner",)
    search_fields = ("prefix", "partner__name")
    # Keys are created from the ops console (shown once); the hash is never editable.
    readonly_fields = ("prefix", "key_hash", "created_at", "created_by", "last_used_at")

    def has_add_permission(self, request):
        return False


@admin.register(ConsentGrant)
class ConsentGrantAdmin(admin.ModelAdmin):
    list_display = ("worker", "partner", "purpose", "status", "granted_at", "expires_at", "revoked_at")
    list_filter = ("status", "purpose", "partner")
    search_fields = ("worker__full_name", "worker__phone", "partner__name")
    raw_id_fields = ("worker",)
    readonly_fields = ("granted_at",)


@admin.register(PartnerAccessLog)
class PartnerAccessLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "partner", "worker", "method", "endpoint", "scope", "status_code")
    list_filter = ("partner", "status_code", "scope")
    search_fields = ("endpoint", "worker__full_name")
    raw_id_fields = ("worker", "api_key")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
