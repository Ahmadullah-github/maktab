from django.conf import settings
from django.db import models

from maktab.core.models import UUIDModel
from maktab.tenancy.models import TenantOrganization


class AuditEvent(UUIDModel):
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)
    tenant = models.ForeignKey(
        TenantOrganization,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="audit_events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
    )
    action = models.CharField(max_length=120, db_index=True)
    target_type = models.CharField(max_length=120, blank=True)
    target_id = models.CharField(max_length=120, blank=True)
    request_id = models.CharField(max_length=64, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-occurred_at"]

    def save(self, *args: object, **kwargs: object) -> None:
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValueError("Audit events are append-only")
        super().save(*args, **kwargs)
