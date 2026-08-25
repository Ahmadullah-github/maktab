import pytest
from django.core.exceptions import ValidationError
from maktab.identity.models import LoginAccount, MembershipRole, Role, TenantMembership
from maktab.tenancy.models import SchoolUnit, TenantOrganization


@pytest.mark.django_db
def test_membership_rejects_school_unit_from_another_tenant() -> None:
    first = TenantOrganization.objects.create(slug="first", name="First")
    second = TenantOrganization.objects.create(slug="second", name="Second")
    foreign_unit = SchoolUnit.objects.create(tenant=second, code="main", name="Main")
    account = LoginAccount.objects.create_user(username="scoped-user")

    membership = TenantMembership(account=account, tenant=first, school_unit=foreign_unit)

    with pytest.raises(ValidationError, match="membership tenant"):
        membership.full_clean()


@pytest.mark.django_db
def test_role_assignment_rejects_role_from_another_tenant() -> None:
    first = TenantOrganization.objects.create(slug="first", name="First")
    second = TenantOrganization.objects.create(slug="second", name="Second")
    account = LoginAccount.objects.create_user(username="role-user")
    membership = TenantMembership.objects.create(account=account, tenant=first)
    foreign_role = Role.objects.create(tenant=second, code="teacher", name="Teacher")

    assignment = MembershipRole(membership=membership, role=foreign_role)

    with pytest.raises(ValidationError, match="membership tenant"):
        assignment.full_clean()
