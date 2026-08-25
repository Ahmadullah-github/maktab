import pytest
from maktab.entitlements.models import EntitlementDefinition, TenantEntitlement
from maktab.identity.models import (
    LoginAccount,
    MembershipRole,
    PermissionDefinition,
    Role,
    RolePermission,
    TenantMembership,
)
from maktab.tenancy.models import SchoolUnit, TenantOrganization
from rest_framework.test import APIClient


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def tenant_context(db: object) -> dict[str, object]:
    tenant = TenantOrganization.objects.create(slug="school-one", name="School One")
    unit = SchoolUnit.objects.create(tenant=tenant, code="main", name="Main Campus")
    account = LoginAccount.objects.create_user(
        username="teacher.one", password="Correct-Horse-2026!", must_change_password=False
    )
    membership = TenantMembership.objects.create(account=account, tenant=tenant, school_unit=unit)
    role = Role.objects.create(tenant=tenant, code="teacher", name="Teacher")
    permission = PermissionDefinition.objects.create(
        code="academics.view", module="academics", name="View academics"
    )
    RolePermission.objects.create(role=role, permission=permission)
    MembershipRole.objects.create(membership=membership, role=role, school_unit=unit)
    entitlement = EntitlementDefinition.objects.create(code="academics", name="Academics")
    tenant_entitlement = TenantEntitlement.objects.create(
        tenant=tenant, entitlement=entitlement, enabled=True
    )
    return {
        "tenant": tenant,
        "unit": unit,
        "account": account,
        "membership": membership,
        "role": role,
        "tenant_entitlement": tenant_entitlement,
    }
