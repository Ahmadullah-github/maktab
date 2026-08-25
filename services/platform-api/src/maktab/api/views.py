from django.contrib.auth import authenticate, login, logout
from django.db import connection
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from maktab.api.context import active_membership_for_request, membership_capabilities
from maktab.api.serializers import (
    AccountSerializer,
    CapabilitiesSerializer,
    CsrfTokenSerializer,
    MembershipSerializer,
    MeSerializer,
    PasswordChangeSerializer,
    ServiceStatusSerializer,
    SessionLoginSerializer,
    TokenRevokeSerializer,
)
from maktab.audit.service import record_event
from maktab.identity.models import TenantMembership


class LivenessView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    @extend_schema(responses=ServiceStatusSerializer)
    def get(self, request: object) -> Response:
        return Response({"status": "ok", "service": "platform-api"})


class ReadinessView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    @extend_schema(responses=ServiceStatusSerializer)
    def get(self, request: object) -> Response:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            return Response({"status": "unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"status": "ready"})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    @extend_schema(responses=CsrfTokenSerializer)
    def get(self, request: object) -> Response:
        return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class SessionLoginView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    @extend_schema(request=SessionLoginSerializer, responses=AccountSerializer)
    def post(self, request: object) -> Response:
        serializer = SessionLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = authenticate(request, **serializer.validated_data)
        if account is None or not account.is_active:
            return Response(
                {"error": {"status": 401, "message": "Invalid username or password"}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        login(request, account)
        record_event(
            request, "auth.session.login", target_type="account", target_id=str(account.id)
        )
        return Response(AccountSerializer(account).data)


class SessionLogoutView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request: object) -> Response:
        account_id = str(request.user.id)
        record_event(request, "auth.session.logout", target_type="account", target_id=account_id)
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditedTokenObtainPairView(TokenObtainPairView):
    def post(self, request: object, *args: object, **kwargs: object) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.user
        record_event(
            request,
            "auth.token.login",
            actor=account,
            target_type="account",
            target_id=str(account.id),
        )
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class TokenRevokeView(APIView):
    @extend_schema(request=TokenRevokeSerializer, responses={204: None})
    def post(self, request: object) -> Response:
        serializer = TokenRevokeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        RefreshToken(serializer.validated_data["refresh"]).blacklist()
        record_event(
            request, "auth.token.revoke", target_type="account", target_id=str(request.user.id)
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    @extend_schema(responses=MeSerializer)
    def get(self, request: object) -> Response:
        account = request.user
        memberships = (
            TenantMembership.objects.filter(account=account)
            .select_related("tenant", "school_unit")
            .prefetch_related("membership_roles__role")
        )
        return Response(
            {
                "account": AccountSerializer(account).data,
                "memberships": MembershipSerializer(memberships, many=True).data,
            }
        )


class MembershipsView(APIView):
    @extend_schema(responses=MembershipSerializer(many=True))
    def get(self, request: object) -> Response:
        memberships = (
            TenantMembership.objects.filter(account=request.user)
            .select_related("tenant", "school_unit")
            .prefetch_related("membership_roles__role")
        )
        return Response(MembershipSerializer(memberships, many=True).data)


class CapabilitiesView(APIView):
    @extend_schema(responses=CapabilitiesSerializer)
    def get(self, request: object) -> Response:
        membership = active_membership_for_request(request)
        return Response(
            {
                "membership": MembershipSerializer(membership).data,
                **membership_capabilities(membership),
            }
        )


class PasswordChangeView(APIView):
    @extend_schema(request=PasswordChangeSerializer, responses={204: None})
    def post(self, request: object) -> Response:
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        account = request.user
        if not account.check_password(serializer.validated_data["current_password"]):
            return Response(
                {"error": {"status": 400, "message": "Current password is incorrect"}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        account.set_password(serializer.validated_data["new_password"])
        account.must_change_password = False
        account.save(update_fields=["password", "must_change_password"])
        record_event(
            request, "auth.password.change", target_type="account", target_id=str(account.id)
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
