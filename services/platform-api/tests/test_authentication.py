import pytest
from maktab.audit.models import AuditEvent
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_session_login_requires_csrf_and_records_audit_event(
    tenant_context: dict[str, object],
) -> None:
    client = APIClient(enforce_csrf_checks=True)

    rejected = client.post(
        "/api/v1/auth/session/login",
        {"username": "teacher.one", "password": "Correct-Horse-2026!"},
        format="json",
    )
    assert rejected.status_code == 403

    csrf = client.get("/api/v1/auth/csrf")
    accepted = client.post(
        "/api/v1/auth/session/login",
        {"username": "teacher.one", "password": "Correct-Horse-2026!"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf.json()["csrfToken"],
    )

    assert accepted.status_code == 200
    assert accepted.json()["username"] == "teacher.one"
    assert AuditEvent.objects.filter(action="auth.session.login").exists()


@pytest.mark.django_db
def test_jwt_login_is_available_for_desktop(
    api_client: APIClient, tenant_context: dict[str, object]
) -> None:
    response = api_client.post(
        "/api/v1/auth/token",
        {"username": "teacher.one", "password": "Correct-Horse-2026!"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["access"]
    assert response.json()["refresh"]
    assert AuditEvent.objects.filter(action="auth.token.login").exists()
