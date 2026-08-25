from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from maktab.api.views import (
    AuditedTokenObtainPairView,
    CapabilitiesView,
    CsrfView,
    LivenessView,
    MembershipsView,
    MeView,
    PasswordChangeView,
    ReadinessView,
    SessionLoginView,
    SessionLogoutView,
    TokenRevokeView,
)

urlpatterns = [
    path("health/live", LivenessView.as_view(), name="health-live"),
    path("health/ready", ReadinessView.as_view(), name="health-ready"),
    path("auth/csrf", CsrfView.as_view(), name="auth-csrf"),
    path("auth/session/login", SessionLoginView.as_view(), name="auth-session-login"),
    path("auth/session/logout", SessionLogoutView.as_view(), name="auth-session-logout"),
    path("auth/token", AuditedTokenObtainPairView.as_view(), name="auth-token"),
    path("auth/token/refresh", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("auth/token/revoke", TokenRevokeView.as_view(), name="auth-token-revoke"),
    path("auth/password/change", PasswordChangeView.as_view(), name="auth-password-change"),
    path("me", MeView.as_view(), name="me"),
    path("memberships", MembershipsView.as_view(), name="memberships"),
    path("capabilities", CapabilitiesView.as_view(), name="capabilities"),
]
