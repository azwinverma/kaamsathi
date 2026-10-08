from django.contrib import admin

from .models import (
    DeviceToken,
    Notification,
    NotificationDelivery,
    NotificationPreference,
    NotificationTemplate,
    SMSMessage,
)


@admin.register(SMSMessage)
class SMSMessageAdmin(admin.ModelAdmin):
    list_display = ["created_at", "phone", "kind", "backend", "status"]
    list_filter = ["kind", "backend", "status"]
    search_fields = ["phone"]
    readonly_fields = [f.name for f in SMSMessage._meta.fields]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["created_at", "user", "kind", "title", "read_at"]
    list_filter = ["kind"]
    search_fields = ["user__phone", "title"]
    raw_id_fields = ["user"]


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "platform", "last_seen_at"]
    list_filter = ["platform"]
    raw_id_fields = ["user"]


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ["key", "channel", "language", "version", "is_active", "updated_at"]
    list_filter = ["channel", "language", "is_active"]
    search_fields = ["key"]


@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(admin.ModelAdmin):
    list_display = ["created_at", "channel", "status", "attempts"]
    list_filter = ["channel", "status"]
    raw_id_fields = ["notification"]


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ["user", "sms_enabled", "push_enabled", "email_enabled", "marketing_opt_in"]
    raw_id_fields = ["user"]
