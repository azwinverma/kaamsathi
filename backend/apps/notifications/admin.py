from django.contrib import admin

from .models import SMSMessage


@admin.register(SMSMessage)
class SMSMessageAdmin(admin.ModelAdmin):
    list_display = ["created_at", "phone", "kind", "backend", "status"]
    list_filter = ["kind", "backend", "status"]
    search_fields = ["phone"]
    readonly_fields = [f.name for f in SMSMessage._meta.fields]
