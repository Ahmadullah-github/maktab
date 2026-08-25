from django.core.exceptions import ValidationError
from django.db import models

from maktab.core.models import TimeStampedModel, UUIDModel


class TenantOrganization(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        ENDED = "ended", "Ended"

    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status, default=Status.ACTIVE)
    default_language = models.CharField(max_length=5, default="fa")
    timezone = models.CharField(max_length=64, default="Asia/Kabul")

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class SchoolUnit(UUIDModel, TimeStampedModel):
    class UnitType(models.TextChoices):
        SCHOOL = "school", "School"
        CAMPUS = "campus", "Campus"
        COURSE_CENTER = "course_center", "Course center"
        DEPARTMENT = "department", "Department"

    tenant = models.ForeignKey(
        TenantOrganization, on_delete=models.CASCADE, related_name="school_units"
    )
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="children"
    )
    code = models.SlugField(max_length=50)
    name = models.CharField(max_length=200)
    unit_type = models.CharField(max_length=32, choices=UnitType, default=UnitType.SCHOOL)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["tenant__name", "name"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="uniq_unit_code_per_tenant")
        ]

    def __str__(self) -> str:
        return f"{self.tenant.name} / {self.name}"

    def clean(self) -> None:
        super().clean()
        if self.parent_id and self.parent.tenant_id != self.tenant_id:
            raise ValidationError({"parent": "Parent unit must belong to the same tenant."})
