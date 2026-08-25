import base64
import hashlib
import json
import os
import subprocess
import sys
from datetime import timedelta
from io import StringIO

import pytest
from argon2 import PasswordHasher
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from release.models import (
    Activation,
    DesktopRelease,
    IdempotencyRecord,
    License,
    LicenseAuditEvent,
    SecuritySignal,
)
from rest_framework.test import APIClient


def encoded(value: bytes) -> str:
    return base64.b64encode(value).decode()


def decode_claims(compact: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(compact.split(".")[1] + "=="))


@pytest.fixture(autouse=True)
def signing_keys(monkeypatch):
    license_old = Ed25519PrivateKey.generate()
    license_current = Ed25519PrivateKey.generate()
    update_key = Ed25519PrivateKey.generate()
    monkeypatch.setenv(
        "MAKTAB_LICENSE_SIGNING_KEYS",
        json.dumps(
            {
                "license-old": encoded(license_old.private_bytes_raw()),
                "license-current": encoded(license_current.private_bytes_raw()),
            }
        ),
    )
    monkeypatch.setenv("MAKTAB_LICENSE_ACTIVE_KEY_ID", "license-current")
    monkeypatch.setenv(
        "MAKTAB_UPDATE_SIGNING_KEYS",
        json.dumps({"update-current": encoded(update_key.private_bytes_raw())}),
    )
    monkeypatch.setenv("MAKTAB_UPDATE_ACTIVE_KEY_ID", "update-current")
    return license_old, license_current, update_key


@pytest.fixture
def raw_license_key() -> str:
    return "MKTB-" + "A" * 40


@pytest.fixture
def license(raw_license_key) -> License:
    return License.objects.create(
        lookup_digest=hashlib.sha256(raw_license_key.encode()).hexdigest(),
        key_hash=PasswordHasher().hash(raw_license_key),
        channel="pilot",
        owner_reference="school-qa",
    )


def activation_request(raw_license_key, *, idempotency_key="activate-request-0001", device_id=None):
    return {
        "schema_version": 1,
        "license_key": raw_license_key,
        "product": "desktop-timetable",
        "device": {
            "id": device_id or "device-one-identifier-0000000000000001",
            "support_code": "AAAA-BBBB-CCCC",
            "platform": "win32",
            "arch": "x64",
        },
        "app": {"version": "1.0.0", "build_id": "build", "channel": "pilot"},
        "idempotency_key": idempotency_key,
    }


def refresh_request(payload, *, idempotency_key="refresh-request-0001", token=None, lease=None):
    claims = decode_claims(lease or payload["lease"])
    return {
        "schema_version": 1,
        "activation_id": payload["activation_id"],
        "refresh_token": token or payload["refresh_token"],
        "device_id": "device-one-identifier-0000000000000001",
        "current_lease_id": claims["jti"],
        "app_version": "1.0.0",
        "build_id": "build",
        "idempotency_key": idempotency_key,
    }


@pytest.mark.django_db
def test_activation_refresh_and_deactivation_are_idempotent(signing_keys, license, raw_license_key):
    client = APIClient()
    request = activation_request(raw_license_key)
    activated = client.post("/v1/activations", request, format="json")
    assert activated.status_code == 200
    payload = activated.json()
    header, claims, signature = payload["lease"].split(".")
    signing_keys[1].public_key().verify(
        base64.urlsafe_b64decode(signature + "=="), f"{header}.{claims}".encode()
    )
    assert json.loads(base64.urlsafe_b64decode(header + "=="))["kid"] == "license-current"

    replay = client.post("/v1/activations", request, format="json")
    assert replay.status_code == 200
    assert replay["Idempotency-Replayed"] == "true"
    assert replay.json() == payload
    assert Activation.objects.count() == 1

    conflict = client.post(
        "/v1/activations",
        {**request, "device": {**request["device"], "support_code": "ZZZZ-BBBB-CCCC"}},
        format="json",
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"

    other = activation_request(
        raw_license_key,
        idempotency_key="activate-request-0002",
        device_id="device-two-identifier-0000000000000002",
    )
    assert client.post("/v1/activations", other, format="json").status_code == 409

    refresh = refresh_request(payload)
    refreshed = client.post("/v1/activations/refresh", refresh, format="json")
    assert refreshed.status_code == 200
    new_payload = refreshed.json()
    assert new_payload["refresh_token"] != payload["refresh_token"]
    replayed_refresh = client.post("/v1/activations/refresh", refresh, format="json")
    assert replayed_refresh.json() == new_payload
    refresh_record = IdempotencyRecord.objects.get(scope="refresh", key=refresh["idempotency_key"])
    assert new_payload["refresh_token"].encode() not in bytes(refresh_record.response_ciphertext)

    stale = refresh_request(
        new_payload,
        idempotency_key="refresh-request-stale",
        token=payload["refresh_token"],
    )
    stale_response = client.post("/v1/activations/refresh", stale, format="json")
    assert stale_response.status_code == 403
    assert stale_response.json()["error"]["code"] == "INVALID_REFRESH"

    deactivate = {
        "schema_version": 1,
        "activation_id": payload["activation_id"],
        "refresh_token": new_payload["refresh_token"],
        "device_id": refresh["device_id"],
        "idempotency_key": "deactivate-request-0001",
    }
    deactivated = client.post("/v1/activations/deactivate", deactivate, format="json")
    assert deactivated.status_code == 200
    assert client.post("/v1/activations/deactivate", deactivate, format="json").json() == {
        "status": "deactivated"
    }
    assert not Activation.objects.get().active
    assert IdempotencyRecord.objects.filter(state="complete").count() >= 3
    assert LicenseAuditEvent.objects.filter(outcome="success").exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("lifecycle", "code"),
    [("revoked", "LICENSE_REVOKED"), ("disabled", "LICENSE_DISABLED")],
)
def test_refresh_enforces_revoked_and_disabled_license(license, raw_license_key, lifecycle, code):
    client = APIClient()
    payload = client.post(
        "/v1/activations", activation_request(raw_license_key), format="json"
    ).json()
    if lifecycle == "revoked":
        license.revoked_at = timezone.now()
        license.revocation_reason = "fraud"
        license.save(update_fields=["revoked_at", "revocation_reason"])
    else:
        license.enabled = False
        license.save(update_fields=["enabled"])

    response = client.post("/v1/activations/refresh", refresh_request(payload), format="json")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == code
    assert not Activation.objects.get().active


@pytest.mark.django_db
def test_request_contract_size_limit_rate_limit_and_security_signal(license, raw_license_key):
    client = APIClient()
    malformed = activation_request(raw_license_key)
    malformed["unexpected"] = True
    assert client.post("/v1/activations", malformed, format="json").status_code == 400

    oversized = client.generic(
        "POST",
        "/v1/activations",
        json.dumps({"value": "x" * 17_000}),
        content_type="application/json",
    )
    assert oversized.status_code == 413

    wrong_key = activation_request("MKTB-" + "Z" * 40, idempotency_key="invalid-key-request")
    denied = client.post("/v1/activations", wrong_key, format="json")
    assert denied.status_code == 403
    assert SecuritySignal.objects.filter(category="invalid_license").exists()


@pytest.mark.django_db
@override_settings(RELEASE_RATE_LIMITS={"activate": (1, 900)})
def test_activation_rate_limit_is_persistent(license, raw_license_key):
    client = APIClient()
    assert (
        client.post(
            "/v1/activations", activation_request(raw_license_key), format="json"
        ).status_code
        == 200
    )
    response = client.post(
        "/v1/activations",
        activation_request(raw_license_key, idempotency_key="activate-request-0002"),
        format="json",
    )
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMITED"


@pytest.mark.django_db
def test_expired_license_cannot_activate(license, raw_license_key):
    license.expires_at = timezone.now() - timedelta(seconds=1)
    license.save(update_fields=["expires_at"])
    response = APIClient().post(
        "/v1/activations", activation_request(raw_license_key), format="json"
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "LICENSE_EXPIRED"


@pytest.mark.django_db
def test_update_manifest_uses_active_rotation_key(signing_keys):
    DesktopRelease.objects.create(
        channel="pilot",
        version="1.0.1",
        build_id="build-101",
        published_at=timezone.now(),
        minimum_supported_version="1.0.0",
        rollout_percent=10,
        release_notes="Pilot",
        artifact_url="https://downloads.example/Maktab.exe",
        artifact_size=100,
        artifact_sha512="A" * 88,
        authenticode_publisher="Maktab",
        enabled=True,
    )
    response = APIClient().get("/v1/updates/windows/x64/pilot/latest")
    assert response.status_code == 200
    manifest = response.json()
    assert manifest["key_id"] == "update-current"
    signature = base64.urlsafe_b64decode(manifest.pop("signature") + "==")
    canonical = json.dumps(
        manifest, separators=(",", ":"), sort_keys=True, ensure_ascii=False
    ).encode()
    signing_keys[2].public_key().verify(signature, canonical)


@pytest.mark.django_db
def test_owner_create_transfer_and_lost_device_workflows_do_not_store_raw_key():
    stdout = StringIO()
    call_command(
        "create_license",
        owner_reference="school-owner-001",
        channel="pilot",
        stdout=stdout,
    )
    output = dict(line.split("=", 1) for line in stdout.getvalue().splitlines())
    raw_key = output["license_key"]
    license = License.objects.get(pk=int(output["license_id"]))
    assert raw_key not in license.key_hash
    assert license.lookup_digest == hashlib.sha256(raw_key.encode()).hexdigest()

    client = APIClient()
    first = client.post("/v1/activations", activation_request(raw_key), format="json")
    assert first.status_code == 200
    activation = Activation.objects.get(pk=first.json()["activation_id"])
    call_command(
        "reset_license_device",
        activation.pk,
        mode="transfer",
        reason="owner replaced computer",
        stdout=StringIO(),
    )
    activation.refresh_from_db()
    assert not activation.active
    assert LicenseAuditEvent.objects.filter(action="owner_transfer").exists()

    second = client.post(
        "/v1/activations",
        activation_request(
            raw_key,
            idempotency_key="activate-after-transfer",
            device_id="replacement-device-identifier-000000000003",
        ),
        format="json",
    )
    assert second.status_code == 200
    replacement = Activation.objects.get(pk=second.json()["activation_id"])
    call_command(
        "reset_license_device",
        replacement.pk,
        mode="lost-device",
        reason="owner identity re-verified",
        stdout=StringIO(),
    )
    assert LicenseAuditEvent.objects.filter(action="owner_lost_device").exists()
    recovered = client.post(
        "/v1/activations",
        activation_request(
            raw_key,
            idempotency_key="activate-after-recovery",
            device_id="recovered-device-identifier-000000000004",
        ),
        format="json",
    )
    assert recovered.status_code == 200


def test_production_settings_fail_closed_without_secrets():
    environment = {
        "PATH": os.environ["PATH"],
        "PYTHONPATH": str(__import__("pathlib").Path(__file__).resolve().parents[1] / "src"),
        "DJANGO_SETTINGS_MODULE": "config.settings_production",
    }
    result = subprocess.run(
        [sys.executable, "-c", "from django.conf import settings; print(settings.DEBUG)"],
        capture_output=True,
        check=False,
        env=environment,
        text=True,
    )
    assert result.returncode != 0
    assert "MAKTAB_RELEASE_DJANGO_SECRET must be configured" in result.stderr


def test_production_settings_require_https_hosts_key_rings_and_postgresql():
    private_key = encoded(bytes(range(32)))
    environment = {
        "PATH": os.environ["PATH"],
        "PYTHONPATH": str(__import__("pathlib").Path(__file__).resolve().parents[1] / "src"),
        "DJANGO_SETTINGS_MODULE": "config.settings_production",
        "MAKTAB_RELEASE_DJANGO_SECRET": (
            "A7!release-B8@secret-C9#with-D0$enough-E1%entropy-F2^length"
        ),
        "MAKTAB_RELEASE_ALLOWED_HOSTS": "release.example.test",
        "MAKTAB_RELEASE_CSRF_TRUSTED_ORIGINS": "https://release.example.test",
        "MAKTAB_RELEASE_DATABASE_URL": "postgresql://release:password@db.example.test/release",
        "MAKTAB_IDEMPOTENCY_ENCRYPTION_KEY": "A7!idempotency-B8@encryption-C9#secret-D0$",
        "MAKTAB_LICENSE_SIGNING_KEYS": json.dumps({"license-test": private_key}),
        "MAKTAB_LICENSE_ACTIVE_KEY_ID": "license-test",
        "MAKTAB_UPDATE_SIGNING_KEYS": json.dumps({"update-test": private_key}),
        "MAKTAB_UPDATE_ACTIVE_KEY_ID": "update-test",
    }
    command = (
        "import json; from django.conf import settings; "
        "print(json.dumps({'debug': settings.DEBUG, "
        "'engine': settings.DATABASES['default']['ENGINE'], "
        "'ssl': settings.SECURE_SSL_REDIRECT}))"
    )
    result = subprocess.run(
        [sys.executable, "-c", command],
        capture_output=True,
        check=False,
        env=environment,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {
        "debug": False,
        "engine": "django.db.backends.postgresql",
        "ssl": True,
    }
