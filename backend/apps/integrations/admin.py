from django.contrib import admin

from .models import OrgAPIKey, WebhookDelivery, WebhookEndpoint


@admin.register(OrgAPIKey)
class OrgAPIKeyAdmin(admin.ModelAdmin):
    list_display = ["organization", "name", "prefix", "created_at", "last_used_at", "revoked_at"]
    readonly_fields = ["prefix", "key_hash", "created_at", "last_used_at"]
    raw_id_fields = ["organization", "created_by"]


@admin.register(WebhookEndpoint)
class WebhookEndpointAdmin(admin.ModelAdmin):
    list_display = ["organization", "url", "is_active", "created_at"]
    exclude = ["secret"]
    raw_id_fields = ["organization"]


@admin.register(WebhookDelivery)
class WebhookDeliveryAdmin(admin.ModelAdmin):
    list_display = ["created_at", "event", "endpoint", "status", "attempts", "last_status_code"]
    list_filter = ["status", "event"]
    raw_id_fields = ["endpoint"]
