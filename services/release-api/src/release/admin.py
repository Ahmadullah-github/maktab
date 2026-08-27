from django.contrib import admin
from django.db import transaction
from django.utils import timezone

from .models import (
    Activation,
    DesktopRelease,
    IdempotencyRecord,
    License,
    LicenseAuditEvent,
    SecuritySignal,
)


@admin.action(description="Revoke selected licenses")
@transaction.atomic
def revoke_licenses(_modeladmin, request, queryset):
    now = timezone.now()
    for license in queryset.select_for_update():
        license.enabled = False
        license.revoked_at = now
        license.revocation_reason = "django_admin"
        license.save(update_fields=["enabled", "revoked_at", "revocation_reason"])
        license.activations.filter(active=True).update(
            active=False,
            deactivated_at=now,
            deactivation_reason="license_revoked",
        )
        LicenseAuditEvent.objects.create(
            action="owner_revoke",
            outcome="success",
            license=license,
            actor=f"admin:{request.user.pk}",
            reason="django_admin",
        )


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner_reference",
        "product",
        "channel",
        "enabled",
        "revoked_at",
        "expires_at",
    )
    search_fields = ("owner_reference", "lookup_digest")
    readonly_fields = [field.name for field in License._meta.fields]
    actions = [revoke_licenses]

    def has_add_permission(self, _request):
        return False

    def has_delete_permission(self, _request, _obj=None):
        return False


@admin.register(Activation)
class ActivationAdmin(admin.ModelAdmin):
    list_display = ("id", "license", "support_code", "active", "refreshed_at", "deactivated_at")
    search_fields = ("support_code", "device_id")
    readonly_fields = [field.name for field in Activation._meta.fields]

    def has_add_permission(self, _request):
        return False

    def has_delete_permission(self, _request, _obj=None):
        return False


@admin.register(DesktopRelease)
class DesktopReleaseAdmin(admin.ModelAdmin):
    list_display = ("version", "channel", "build_id", "rollout_percent", "enabled", "published_at")
    readonly_fields = [field.name for field in DesktopRelease._meta.fields]

    def has_add_permission(self, _request):
        return False

    def has_change_permission(self, _request, _obj=None):
        return False

    def has_delete_permission(self, _request, _obj=None):
        return False


@admin.register(LicenseAuditEvent)
class LicenseAuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "action",
        "outcome",
        "license",
        "activation",
        "error_code",
        "actor",
    )
    list_filter = ("action", "outcome", "error_code")
    readonly_fields = [field.name for field in LicenseAuditEvent._meta.fields]

    def has_add_permission(self, _request):
        return False

    def has_change_permission(self, _request, _obj=None):
        return False

    def has_delete_permission(self, _request, _obj=None):
        return False


@admin.register(SecuritySignal)
class SecuritySignalAdmin(admin.ModelAdmin):
    list_display = ("last_seen_at", "category", "severity", "count", "last_error_code")
    list_filter = ("category", "severity")
    readonly_fields = [field.name for field in SecuritySignal._meta.fields]

    def has_add_permission(self, _request):
        return False

    def has_change_permission(self, _request, _obj=None):
        return False

    def has_delete_permission(self, _request, _obj=None):
        return False


@admin.register(IdempotencyRecord)
class IdempotencyRecordAdmin(admin.ModelAdmin):
    list_display = ("scope", "key", "state", "created_at", "expires_at")
    readonly_fields = [field.name for field in IdempotencyRecord._meta.fields]

    def has_add_permission(self, _request):
        return False

    def has_change_permission(self, _request, _obj=None):
        return False

    def has_delete_permission(self, _request, _obj=None):
        return False
