import hashlib
import json
from datetime import timedelta

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.response import Response

from .models import IdempotencyRecord


def _digest(data) -> str:
    canonical = json.dumps(data, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(canonical).hexdigest()


def _cipher() -> AESGCM:
    key = hashlib.sha256(settings.IDEMPOTENCY_ENCRYPTION_KEY.encode()).digest()
    return AESGCM(key)


def _encrypt(response: Response) -> bytes:
    import os

    nonce = os.urandom(12)
    payload = json.dumps(
        {"status": response.status_code, "data": response.data},
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode()
    return nonce + _cipher().encrypt(nonce, payload, b"maktab-release-idempotency-v1")


def _decrypt(value: bytes) -> Response:
    raw = bytes(value)
    payload = _cipher().decrypt(raw[:12], raw[12:], b"maktab-release-idempotency-v1")
    decoded = json.loads(payload)
    response = Response(decoded["data"], status=decoded["status"])
    response["Idempotency-Replayed"] = "true"
    return response


def run_idempotent(*, scope: str, data, callback) -> Response:
    key = data.get("idempotency_key") if isinstance(data, dict) else None
    if not isinstance(key, str) or not 8 <= len(key) <= 128:
        return Response(
            {
                "error": {
                    "code": "INVALID_IDEMPOTENCY_KEY",
                    "message": "A valid idempotency key is required.",
                }
            },
            status=400,
        )

    request_digest = _digest(data)
    expires_at = timezone.now() + timedelta(days=2)
    try:
        with transaction.atomic():
            record = IdempotencyRecord.objects.create(
                scope=scope,
                key=key,
                request_digest=request_digest,
                expires_at=expires_at,
            )
    except IntegrityError:
        record = IdempotencyRecord.objects.get(scope=scope, key=key)
        if record.expires_at <= timezone.now():
            with transaction.atomic():
                IdempotencyRecord.objects.select_for_update().filter(
                    pk=record.pk, expires_at__lte=timezone.now()
                ).delete()
            return run_idempotent(scope=scope, data=data, callback=callback)
        if record.request_digest != request_digest:
            return Response(
                {
                    "error": {
                        "code": "IDEMPOTENCY_CONFLICT",
                        "message": "Idempotency key was used for another request.",
                    }
                },
                status=409,
            )
        if record.state == "complete" and record.response_ciphertext:
            return _decrypt(record.response_ciphertext)
        if record.updated_at > timezone.now() - timedelta(minutes=5):
            return Response(
                {
                    "error": {
                        "code": "IDEMPOTENCY_IN_PROGRESS",
                        "message": "The original request is still in progress.",
                        "retryable": True,
                    }
                },
                status=409,
            )

    with transaction.atomic():
        locked = IdempotencyRecord.objects.select_for_update().get(pk=record.pk)
        if locked.request_digest != request_digest:
            return Response(
                {
                    "error": {
                        "code": "IDEMPOTENCY_CONFLICT",
                        "message": "Idempotency key was used for another request.",
                    }
                },
                status=409,
            )
        if locked.state == "complete" and locked.response_ciphertext:
            return _decrypt(locked.response_ciphertext)
        response = callback()
        locked.state = "complete"
        locked.response_ciphertext = _encrypt(response)
        locked.expires_at = expires_at
        locked.save(update_fields=["state", "response_ciphertext", "expires_at", "updated_at"])
        return response
