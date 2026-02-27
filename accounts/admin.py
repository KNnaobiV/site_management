from django.contrib import admin

from .models import Invitation


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("code", "email", "invited_by", "created_at", "used", "used_at")
    readonly_fields = ("code", "created_at", "used_at")
    search_fields = ("code", "email")
    list_filter = ("used",)
# Register your models here.
