import pytest
from maktab.identity.models import LoginAccount, TenantMembership
from maktab.tenancy.models import TenantOrganization
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_capabilities_intersect_roles_and_contract_entitlements(
    api_client: APIClient, tenant_context: dict[str, object]
) -> None:
    account = tenant_context["account"]
    membership = tenant_context["membership"]
    tenant_entitlement = tenant_context["tenant_entitlement"]
    api_client.force_authenticate(account)

    enabled = api_client.get("/api/v1/capabilities", HTTP_X_MAKTAB_MEMBERSHIP=str(membership.id))
    assert enabled.status_code == 200
    assert enabled.json()["permissions"] == ["academics.view"]

    tenant_entitlement.enabled = False
    tenant_entitlement.save(update_fields=["enabled"])
    disabled = api_client.get("/api/v1/capabilities", HTTP_X_MAKTAB_MEMBERSHIP=str(membership.id))
    assert disabled.status_code == 200
    assert disabled.json()["permissions"] == []


@pytest.mark.django_db
def test_account_cannot_select_another_accounts_membership(
    api_client: APIClient, tenant_context: dict[str, object]
) -> None:
    other_tenant = TenantOrganization.objects.create(slug="school-two", name="School Two")
    other_account = LoginAccount.objects.create_user(username="other", password="password")
    other_membership = TenantMembership.objects.create(account=other_account, tenant=other_tenant)
    api_client.force_authenticate(tenant_context["account"])

    response = api_client.get(
        "/api/v1/capabilities", HTTP_X_MAKTAB_MEMBERSHIP=str(other_membership.id)
    )

    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Active membership was not found"
