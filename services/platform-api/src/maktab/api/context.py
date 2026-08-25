from uuid import UUID

from rest_framework.exceptions import NotFound, ParseError

from maktab.identity.models import TenantMembership

MEMBERSHIP_HEADER = "X-Maktab-Membership"


def active_membership_for_request(request: object) -> TenantMembership:
    raw_membership = request.headers.get(MEMBERSHIP_HEADER)
    if not raw_membership:
        raise ParseError({"membership": f"{MEMBERSHIP_HEADER} is required"})
    try:
        membership_id = UUID(raw_membership)
    except ValueError as exc:
        raise ParseError({"membership": "Invalid membership identifier"}) from exc

    try:
        return (
            TenantMembership.objects.select_related("tenant", "school_unit")
            .prefetch_related("membership_roles__role__permissions")
            .get(
                id=membership_id,
                account=request.user,
                status=TenantMembership.Status.ACTIVE,
                tenant__status="active",
            )
        )
    except TenantMembership.DoesNotExist as exc:
        raise NotFound("Active membership was not found") from exc


def membership_capabilities(membership: TenantMembership) -> dict[str, object]:
    enabled_modules = set(
        membership.tenant.tenant_entitlements.filter(enabled=True).values_list(
            "entitlement__code", flat=True
        )
    )
    always_available = {"dashboard", "profile"}
    permissions = set(
        membership.membership_roles.filter(role__tenant=membership.tenant).values_list(
            "role__permissions__code", flat=True
        )
    )
    visible_permissions = sorted(
        permission
        for permission in permissions
        if permission and permission.split(".", 1)[0] in enabled_modules | always_available
    )
    modules: dict[str, set[str]] = {}
    for permission in visible_permissions:
        module, _, action = permission.partition(".")
        modules.setdefault(module, set()).add(action)
    return {
        "permissions": visible_permissions,
        "modules": [
            {"code": code, "actions": sorted(actions)} for code, actions in sorted(modules.items())
        ],
    }
