import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_endpoints_are_public(api_client: APIClient) -> None:
    live = api_client.get("/api/v1/health/live")
    ready = api_client.get("/api/v1/health/ready")

    assert live.status_code == 200
    assert live.json() == {"status": "ok", "service": "platform-api"}
    assert ready.status_code == 200
    assert ready.json() == {"status": "ready"}
