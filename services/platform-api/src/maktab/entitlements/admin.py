from django.contrib import admin

from maktab.entitlements.models import Contract, EntitlementDefinition, TenantEntitlement

admin.site.register(Contract)
admin.site.register(EntitlementDefinition)
admin.site.register(TenantEntitlement)
