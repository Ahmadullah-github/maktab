from django.contrib import admin

from maktab.tenancy.models import SchoolUnit, TenantOrganization

admin.site.register(TenantOrganization)
admin.site.register(SchoolUnit)
