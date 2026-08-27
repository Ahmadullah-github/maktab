import base64
import json
import os
import time
import uuid

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from django.conf import settings


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode_private_key(encoded: str) -> Ed25519PrivateKey:
    try:
        raw = base64.b64decode(encoded, validate=True)
    except ValueError as exc:
        raise RuntimeError("Signing key must be valid base64") from exc
    if raw.startswith(b"-----BEGIN"):
        key = serialization.load_pem_private_key(raw, password=None)
        if not isinstance(key, Ed25519PrivateKey):
            raise RuntimeError("Signing key must be Ed25519")
        return key
    if len(raw) != 32:
        raise RuntimeError("Raw Ed25519 signing keys must contain 32 bytes")
    return Ed25519PrivateKey.from_private_bytes(raw)


def _private_key(*, purpose: str) -> tuple[str, Ed25519PrivateKey]:
    ring_name = f"MAKTAB_{purpose}_SIGNING_KEYS"
    active_name = f"MAKTAB_{purpose}_ACTIVE_KEY_ID"
    encoded_ring = os.environ.get(ring_name, "")
    active_id = os.environ.get(active_name, "")
    if encoded_ring:
        try:
            ring = json.loads(encoded_ring)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"{ring_name} must be a JSON object") from exc
        if not isinstance(ring, dict) or not active_id or active_id not in ring:
            raise RuntimeError(f"{active_name} must identify a configured signing key")
        return active_id, _decode_private_key(ring[active_id])

    # Development/test compatibility. Production settings require key rings.
    legacy_key = os.environ.get(f"MAKTAB_{purpose}_PRIVATE_KEY", "")
    legacy_id = os.environ.get(f"MAKTAB_{purpose}_KEY_ID", f"{purpose.lower()}-development")
    if not legacy_key:
        raise RuntimeError(f"{ring_name} is not configured")
    return legacy_id, _decode_private_key(legacy_key)


def sign_lease(*, activation, device_id: str, channel: str) -> str:
    now = int(time.time())
    lease_id = uuid.uuid4()
    key_id, private_key = _private_key(purpose="LICENSE")
    lease_end = now + settings.LICENSE_LEASE_DAYS * 86400
    if activation.license.expires_at:
        lease_end = min(lease_end, int(activation.license.expires_at.timestamp()))
    grace_end = lease_end + settings.LICENSE_GRACE_DAYS * 86400
    header = {"alg": "EdDSA", "typ": "JWT", "kid": key_id}
    claims = {
        "ver": 1,
        "jti": str(lease_id),
        "iss": "maktab-release",
        "aud": "maktab-desktop",
        "product": "desktop-timetable",
        "activation_id": str(activation.pk),
        "license_id": str(activation.license_id),
        "device_id": device_id,
        "entitlements": ["timetable.generate"],
        "channel": channel,
        "iat": now,
        "nbf": now - 60,
        "exp": lease_end,
        "grace_until": grace_end,
        "key_id": key_id,
    }
    encoded_header = _b64(json.dumps(header, separators=(",", ":"), sort_keys=True).encode())
    encoded_claims = _b64(json.dumps(claims, separators=(",", ":"), sort_keys=True).encode())
    payload = f"{encoded_header}.{encoded_claims}".encode()
    activation.last_lease_id = lease_id
    activation.save(update_fields=["last_lease_id", "refreshed_at"])
    return f"{payload.decode()}.{_b64(private_key.sign(payload))}"


def sign_manifest(manifest: dict) -> dict:
    key_id, private_key = _private_key(purpose="UPDATE")
    manifest["key_id"] = key_id
    payload = json.dumps(
        manifest, separators=(",", ":"), sort_keys=True, ensure_ascii=False
    ).encode()
    manifest["signature"] = _b64(private_key.sign(payload))
    return manifest
