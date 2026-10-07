from django.contrib import admin

from .models import District, Province


class DistrictInline(admin.TabularInline):
    model = District
    extra = 0


@admin.register(Province)
class ProvinceAdmin(admin.ModelAdmin):
    list_display = ["code", "name_en", "name_ne"]
    inlines = [DistrictInline]


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ["code", "name_en", "name_ne", "province"]
    list_filter = ["province"]
    search_fields = ["code", "name_en", "name_ne"]
