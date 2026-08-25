import pytest
from maktab.audit.models import AuditEvent


@pytest.mark.django_db
def test_audit_events_are_append_only() -> None:
    event = AuditEvent.objects.create(action="test.created")
    event.action = "test.changed"

    with pytest.raises(ValueError, match="append-only"):
        event.save()
