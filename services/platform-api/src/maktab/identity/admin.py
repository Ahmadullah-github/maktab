from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from maktab.identity.models import (
    LoginAccount,
    MembershipRole,
    PermissionDefinition,
    Person,
    Role,
    TenantMembership,
)

admin.site.register(LoginAccount, UserAdmin)
admin.site.register(Person)
admin.site.register(TenantMembership)
admin.site.register(Role)
admin.site.register(PermissionDefinition)
admin.site.register(MembershipRole)
