from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

from maktab.core.models import TimeStampedModel, UUIDModel
from maktab.tenancy.models import SchoolUnit, TenantOrganization


class Person(UUIDModel, TimeStampedModel):
    tenant = models.ForeignKey(TenantOrganization, on_delete=models.CASCADE, related_name="people")
    given_name = models.CharField(max_length=100)
    family_name = models.CharField(max_length=100, blank=True)
    display_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=32, blank=True)
    preferred_language = models.CharField(max_length=5, default="fa")

    class Meta:
        ordering = ["display_name"]

    def __str__(self) -> str:
        return self.display_name


class LoginAccount(UUIDModel, AbstractUser):
    person = models.ForeignKey(
        Person, null=True, blank=True, on_delete=models.SET_NULL, related_name="login_accounts"
    )
    phone = models.CharField(max_length=32, blank=True)
    must_change_password = models.BooleanField(default=True)


class TenantMembership(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        ENDED = "ended", "Ended"

    account = models.ForeignKey(LoginAccount, on_delete=models.CASCADE, related_name="memberships")
    tenant = models.ForeignKey(
        TenantOrganization, on_delete=models.CASCADE, related_name="memberships"
    )
    school_unit = models.ForeignKey(
        SchoolUnit, null=True, blank=True, on_delete=models.PROTECT, related_name="memberships"
    )
    status = models.CharField(max_length=20, choices=Status, default=Status.ACTIVE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["account", "tenant"], name="uniq_account_membership_per_tenant"
            )
        ]

    def __str__(self) -> str:
        return f"{self.account.username} @ {self.tenant.slug}"

    def clean(self) -> None:
        super().clean()
        if self.school_unit_id and self.school_unit.tenant_id != self.tenant_id:
            raise ValidationError(
                {"school_unit": "School unit must belong to the membership tenant."}
            )
        if self.account.person_id and self.account.person.tenant_id != self.tenant_id:
            raise ValidationError(
                {"account": "The linked person must belong to the membership tenant."}
            )


class PermissionDefinition(UUIDModel):
    code = models.CharField(max_length=120, unique=True)
    module = models.CharField(max_length=60)
    name = models.CharField(max_length=160)

    class Meta:
        ordering = ["module", "code"]

    def __str__(self) -> str:
        return self.code


class Role(UUIDModel, TimeStampedModel):
    tenant = models.ForeignKey(
        TenantOrganization,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="roles",
    )
    code = models.SlugField(max_length=60)
    name = models.CharField(max_length=120)
    is_system = models.BooleanField(default=False)
    permissions = models.ManyToManyField(
        PermissionDefinition, through="RolePermission", related_name="roles"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="uniq_role_code_per_tenant")
        ]

    def __str__(self) -> str:
        return self.name


class RolePermission(UUIDModel):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(
        PermissionDefinition, on_delete=models.CASCADE, related_name="role_permissions"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["role", "permission"], name="uniq_permission_per_role")
        ]


class MembershipRole(UUIDModel, TimeStampedModel):
    membership = models.ForeignKey(
        TenantMembership, on_delete=models.CASCADE, related_name="membership_roles"
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="membership_roles")
    school_unit = models.ForeignKey(
        SchoolUnit, null=True, blank=True, on_delete=models.PROTECT, related_name="role_assignments"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "role", "school_unit"], name="uniq_role_assignment_scope"
            )
        ]

    def clean(self) -> None:
        super().clean()
        if self.role.tenant_id != self.membership.tenant_id:
            raise ValidationError({"role": "Role must belong to the membership tenant."})
        if self.school_unit_id and self.school_unit.tenant_id != self.membership.tenant_id:
            raise ValidationError(
                {"school_unit": "Role scope must belong to the membership tenant."}
            )
