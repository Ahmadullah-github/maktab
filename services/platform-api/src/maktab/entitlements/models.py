from django.db import models

from maktab.core.models import TimeStampedModel, UUIDModel
from maktab.tenancy.models import TenantOrganization


class Contract(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        ENDED = "ended", "Ended"

    tenant = models.ForeignKey(
        TenantOrganization, on_delete=models.PROTECT, related_name="contracts"
    )
    reference = models.CharField(max_length=80, unique=True)
    status = models.CharField(max_length=20, choices=Status, default=Status.DRAFT)
    starts_on = models.DateField()
    ends_on = models.DateField(null=True, blank=True)
    maximum_active_users = models.PositiveIntegerField(default=100)
    maximum_superusers = models.PositiveSmallIntegerField(default=5)

    def __str__(self) -> str:
        return self.reference


class EntitlementDefinition(UUIDModel):
    code = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.code


class TenantEntitlement(UUIDModel, TimeStampedModel):
    tenant = models.ForeignKey(
        TenantOrganization, on_delete=models.CASCADE, related_name="tenant_entitlements"
    )
    entitlement = models.ForeignKey(
        EntitlementDefinition, on_delete=models.PROTECT, related_name="tenant_entitlements"
    )
    contract = models.ForeignKey(
        Contract, null=True, blank=True, on_delete=models.PROTECT, related_name="entitlements"
    )
    enabled = models.BooleanField(default=True)
    configuration = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "entitlement"], name="uniq_entitlement_per_tenant"
            )
        ]
