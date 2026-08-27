import hashlib
import uuid
from datetime import UTC, datetime

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.throttling import BaseThrottle

from .models import IdempotencyRecord, LicenseAuditEvent, RateLimitBucket, SecuritySignal


def fingerprint(value: str) -> str:
    return hashlib.sha256(f"maktab-release-v1\0{value}".encode()).hexdigest()


def request_id(request) -> str:
    supplied = request.headers.get("X-Request-ID", "")
    return supplied if 1 <= len(supplied) <= 64 and supplied.isascii() else str(uuid.uuid4())


def network_fingerprint(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    address = (
        forwarded.split(",", 1)[0].strip()
        if settings.TRUST_RELEASE_PROXY_HEADERS and forwarded
        else request.META.get("REMOTE_ADDR", "unknown")
    )
    return fingerprint(address)


def audit(
    request,
    *,
    action,
    outcome,
    license=None,
    activation=None,
    reason="",
    error_code="",
    device_id="",
    metadata=None,
    actor="",
):
    LicenseAuditEvent.objects.create(
        action=action,
        outcome=outcome,
        license=license,
        activation=activation,
        actor=actor,
        reason=reason[:256],
        error_code=error_code,
        request_id=getattr(request, "release_request_id", ""),
        network_fingerprint=network_fingerprint(request),
        device_fingerprint=fingerprint(device_id) if device_id else "",
        metadata=metadata or {},
    )


def signal(request, *, category, error_code, severity="warning", metadata=None):
    key = network_fingerprint(request)
    try:
        with transaction.atomic():
            item, created = SecuritySignal.objects.select_for_update().get_or_create(
                category=category,
                fingerprint=key,
                defaults={
                    "severity": severity,
                    "last_error_code": error_code,
                    "metadata": metadata or {},
                },
            )
            if not created:
                item.count = F("count") + 1
                item.severity = severity
                item.last_error_code = error_code
                item.metadata = metadata or {}
                item.save(
                    update_fields=[
                        "count",
                        "severity",
                        "last_error_code",
                        "metadata",
                        "last_seen_at",
                    ]
                )
    except IntegrityError:
        SecuritySignal.objects.filter(category=category, fingerprint=key).update(
            count=F("count") + 1
        )


class DatabaseRateThrottle(BaseThrottle):
    def allow_request(self, request, view):
        scope = getattr(view, "rate_limit_scope", None)
        if not scope:
            return True
        idempotency_key = (
            request.data.get("idempotency_key") if isinstance(request.data, dict) else None
        )
        if (
            isinstance(idempotency_key, str)
            and IdempotencyRecord.objects.filter(
                scope=scope, key=idempotency_key, state="complete"
            ).exists()
        ):
            return True
        limit, window_seconds = settings.RELEASE_RATE_LIMITS[scope]
        now = timezone.now()
        epoch = int(now.timestamp())
        start_epoch = epoch - (epoch % window_seconds)
        window_start = datetime.fromtimestamp(start_epoch, tz=UTC)
        key = network_fingerprint(request)
        with transaction.atomic():
            bucket, _ = RateLimitBucket.objects.select_for_update().get_or_create(
                scope=scope,
                fingerprint=key,
                window_start=window_start,
                defaults={"request_count": 0},
            )
            if bucket.request_count >= limit:
                self.wait_seconds = max(1, window_seconds - (epoch - start_epoch))
                signal(
                    request,
                    category="rate_limit",
                    error_code="RATE_LIMITED",
                    severity="warning",
                    metadata={"scope": scope},
                )
                return False
            bucket.request_count += 1
            bucket.save(update_fields=["request_count"])
        return True

    def wait(self):
        return getattr(self, "wait_seconds", None)
