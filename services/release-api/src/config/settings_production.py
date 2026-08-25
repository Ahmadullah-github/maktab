import base64
import json
import os
import re
from urllib.parse import unquote, urlparse

from .settings import *  # noqa: F403


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} must be configured in production")
    return value


SECRET_KEY = required("MAKTAB_RELEASE_DJANGO_SECRET")
if len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 8:
    raise RuntimeError(
        "MAKTAB_RELEASE_DJANGO_SECRET must be high entropy and at least 50 characters"
    )
DEBUG = False
ALLOWED_HOSTS = [
    host.strip() for host in required("MAKTAB_RELEASE_ALLOWED_HOSTS").split(",") if host.strip()
]
if any(
    host == "*" or host.startswith(".") or not re.fullmatch(r"[A-Za-z0-9.-]+", host)
    for host in ALLOWED_HOSTS
):
    raise RuntimeError("MAKTAB_RELEASE_ALLOWED_HOSTS must contain exact hostnames")
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in required("MAKTAB_RELEASE_CSRF_TRUSTED_ORIGINS").split(",")
    if origin.strip()
]
for origin in CSRF_TRUSTED_ORIGINS:
    parsed_origin = urlparse(origin)
    if (
        parsed_origin.scheme != "https"
        or not parsed_origin.hostname
        or parsed_origin.username
        or parsed_origin.password
        or parsed_origin.path not in {"", "/"}
        or parsed_origin.query
        or parsed_origin.fragment
    ):
        raise RuntimeError("MAKTAB_RELEASE_CSRF_TRUSTED_ORIGINS must contain exact HTTPS origins")
IDEMPOTENCY_ENCRYPTION_KEY = required("MAKTAB_IDEMPOTENCY_ENCRYPTION_KEY")
if len(IDEMPOTENCY_ENCRYPTION_KEY) < 32 or len(set(IDEMPOTENCY_ENCRYPTION_KEY)) < 8:
    raise RuntimeError("MAKTAB_IDEMPOTENCY_ENCRYPTION_KEY must be high entropy")


def validate_signing_ring(purpose: str) -> None:
    ring_name = f"MAKTAB_{purpose}_SIGNING_KEYS"
    active_name = f"MAKTAB_{purpose}_ACTIVE_KEY_ID"
    try:
        ring = json.loads(required(ring_name))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{ring_name} must be a JSON object") from exc
    active_id = required(active_name)
    if not isinstance(ring, dict) or active_id not in ring or not isinstance(ring[active_id], str):
        raise RuntimeError(f"{active_name} must identify a configured signing key")
    try:
        raw = base64.b64decode(ring[active_id], validate=True)
    except ValueError as exc:
        raise RuntimeError(f"{ring_name} values must be valid base64") from exc
    if len(raw) != 32 and not raw.startswith(b"-----BEGIN PRIVATE KEY-----"):
        raise RuntimeError(f"{ring_name} values must be raw or PEM Ed25519 private keys")


database_url = urlparse(required("MAKTAB_RELEASE_DATABASE_URL"))
if (
    database_url.scheme not in {"postgres", "postgresql"}
    or not database_url.hostname
    or not database_url.path.strip("/")
    or database_url.query
    or database_url.fragment
):
    raise RuntimeError("MAKTAB_RELEASE_DATABASE_URL must be a PostgreSQL URL")
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": database_url.path.strip("/"),
        "USER": unquote(database_url.username or ""),
        "PASSWORD": unquote(database_url.password or ""),
        "HOST": database_url.hostname,
        "PORT": database_url.port or 5432,
        "CONN_MAX_AGE": 60,
        "OPTIONS": {"sslmode": os.environ.get("MAKTAB_RELEASE_DATABASE_SSLMODE", "require")},
    }
}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
TRUST_RELEASE_PROXY_HEADERS = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(os.environ.get("MAKTAB_RELEASE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "no-referrer"
X_FRAME_OPTIONS = "DENY"

# Production accepts key rings only. Private signing keys never ship with a desktop artifact.
validate_signing_ring("LICENSE")
validate_signing_ring("UPDATE")
