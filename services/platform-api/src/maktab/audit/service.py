from typing import Any

from django.http import HttpRequest

from maktab.audit.models import AuditEvent
from maktab.tenancy.models import TenantOrganization


def record_event(
    request: HttpRequest,
    action: str,
    *,
    tenant: TenantOrganization | None = None,
    actor: object | None = None,
    target_type: str = "",
    target_id: str = "",
    metadata: dict[str, Any] | None = None,
) -> AuditEvent:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip_address = forwarded_for.split(",")[0].strip() or request.META.get("REMOTE_ADDR")
    event_actor = actor or (
        request.user if getattr(request.user, "is_authenticated", False) else None
    )
    return AuditEvent.objects.create(
        tenant=tenant,
        actor=event_actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        request_id=request.headers.get("X-Request-ID", ""),
        ip_address=ip_address,
        metadata=metadata or {},
    )
