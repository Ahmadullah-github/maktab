import os
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from maktab.entitlements.models import Contract, EntitlementDefinition, TenantEntitlement
from maktab.identity.models import (
    LoginAccount,
    MembershipRole,
    PermissionDefinition,
    Person,
    Role,
    RolePermission,
    TenantMembership,
)
from maktab.tenancy.models import SchoolUnit, TenantOrganization

MODULES = {
    "dashboard": "Dashboard",
    "timetable": "Timetable",
    "academics": "Academics and headteacher office",
    "courses": "Course management",
    "discipline": "Discipline",
    "hr": "Human resources",
    "transport": "Transport",
    "inventory": "Inventory and custody",
    "finance": "Finance",
    "messaging": "Messaging",
    "users": "Users and access",
    "audit": "User activity and audit",
    "parent_portal": "Parent portal",
    "teacher_portal": "Teacher portal",
}

ROLE_MODULES = {
    "administrator": set(MODULES),
    "headteacher": {"dashboard", "timetable", "academics", "discipline", "teacher_portal"},
    "teacher": {"dashboard", "academics", "discipline", "teacher_portal"},
    "finance": {"dashboard", "finance"},
    "hr": {"dashboard", "hr"},
    "guardian": {"dashboard", "parent_portal", "messaging"},
}


class Command(BaseCommand):
    help = "Create an idempotent local tenant, contracts, roles, and demo users"

    @transaction.atomic
    def handle(self, *args: object, **options: object) -> None:
        password = os.environ.get("MAKTAB_DEMO_PASSWORD", "Maktab-Development-2026!")
        tenant, _ = TenantOrganization.objects.update_or_create(
            slug="demo-school",
            defaults={"name": "Maktab Demo School", "status": "active", "default_language": "fa"},
        )
        unit, _ = SchoolUnit.objects.update_or_create(
            tenant=tenant,
            code="main-campus",
            defaults={"name": "Main Campus", "unit_type": "school", "is_active": True},
        )
        contract, _ = Contract.objects.update_or_create(
            reference="DEMO-LOCAL-001",
            defaults={
                "tenant": tenant,
                "status": "active",
                "starts_on": date.today(),
                "ends_on": date.today() + timedelta(days=365),
                "maximum_active_users": 100,
                "maximum_superusers": 5,
            },
        )

        for module_code, module_name in MODULES.items():
            permission, _ = PermissionDefinition.objects.update_or_create(
                code=f"{module_code}.view",
                defaults={"module": module_code, "name": f"View {module_name}"},
            )
            manage_permission, _ = PermissionDefinition.objects.update_or_create(
                code=f"{module_code}.manage",
                defaults={"module": module_code, "name": f"Manage {module_name}"},
            )
            if module_code != "dashboard":
                entitlement, _ = EntitlementDefinition.objects.update_or_create(
                    code=module_code,
                    defaults={"name": module_name, "description": f"Enables {module_name}"},
                )
                TenantEntitlement.objects.update_or_create(
                    tenant=tenant,
                    entitlement=entitlement,
                    defaults={"contract": contract, "enabled": True},
                )

            for role_code, role_modules in ROLE_MODULES.items():
                if module_code not in role_modules:
                    continue
                role, _ = Role.objects.update_or_create(
                    tenant=tenant,
                    code=role_code,
                    defaults={"name": role_code.replace("_", " ").title(), "is_system": True},
                )
                RolePermission.objects.get_or_create(role=role, permission=permission)
                if role_code not in {"guardian", "teacher"}:
                    RolePermission.objects.get_or_create(role=role, permission=manage_permission)

        users = {
            "admin": ("Administrator", "administrator"),
            "headteacher": ("Headteacher", "headteacher"),
            "teacher": ("Demo Teacher", "teacher"),
            "finance": ("Finance Officer", "finance"),
            "hr": ("HR Officer", "hr"),
            "guardian": ("Demo Guardian", "guardian"),
        }
        for username, (display_name, role_code) in users.items():
            person, _ = Person.objects.update_or_create(
                tenant=tenant,
                display_name=display_name,
                defaults={"given_name": display_name, "preferred_language": "fa"},
            )
            account, _ = LoginAccount.objects.update_or_create(
                username=username,
                defaults={
                    "person": person,
                    "is_active": True,
                    "is_staff": username == "admin",
                    "is_superuser": username == "admin",
                    "must_change_password": False,
                },
            )
            account.set_password(password)
            account.save(update_fields=["password"])
            membership, _ = TenantMembership.objects.update_or_create(
                account=account,
                tenant=tenant,
                defaults={"school_unit": unit, "status": "active"},
            )
            role = Role.objects.get(tenant=tenant, code=role_code)
            MembershipRole.objects.get_or_create(
                membership=membership,
                role=role,
                school_unit=unit,
            )

        self.stdout.write(self.style.SUCCESS("Development tenant and users are ready."))
