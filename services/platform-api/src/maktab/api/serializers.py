from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from maktab.identity.models import LoginAccount, TenantMembership


class SessionLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False, write_only=True)
    new_password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate_new_password(self, value: str) -> str:
        validate_password(value, self.context["request"].user)
        return value


class TokenRevokeSerializer(serializers.Serializer):
    refresh = serializers.CharField(trim_whitespace=False, write_only=True)


class ServiceStatusSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField(required=False)


class CsrfTokenSerializer(serializers.Serializer):
    csrfToken = serializers.CharField()  # noqa: N815 - public API uses camelCase


class MembershipSerializer(serializers.ModelSerializer):
    tenant_id = serializers.UUIDField(read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    school_unit_id = serializers.UUIDField(read_only=True, allow_null=True)
    school_unit_name = serializers.CharField(
        source="school_unit.name", read_only=True, allow_null=True
    )
    roles = serializers.SerializerMethodField()

    class Meta:
        model = TenantMembership
        fields = [
            "id",
            "tenant_id",
            "tenant_name",
            "school_unit_id",
            "school_unit_name",
            "status",
            "roles",
        ]

    def get_roles(self, membership: TenantMembership) -> list[dict[str, str]]:
        return [
            {"code": assignment.role.code, "name": assignment.role.name}
            for assignment in membership.membership_roles.select_related("role").all()
        ]


class AccountSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = LoginAccount
        fields = ["id", "username", "email", "phone", "display_name", "must_change_password"]

    def get_display_name(self, account: LoginAccount) -> str:
        if account.person_id:
            return account.person.display_name
        return account.get_full_name() or account.username


class MeSerializer(serializers.Serializer):
    account = AccountSerializer(read_only=True)
    memberships = MembershipSerializer(many=True, read_only=True)


class CapabilityModuleSerializer(serializers.Serializer):
    code = serializers.CharField()
    actions = serializers.ListField(child=serializers.CharField())


class CapabilitiesSerializer(serializers.Serializer):
    membership = MembershipSerializer(read_only=True)
    permissions = serializers.ListField(child=serializers.CharField())
    modules = CapabilityModuleSerializer(many=True)
