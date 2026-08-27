from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from release.models import License, LicenseAuditEvent


class Command(BaseCommand):
    help = "Revoke a license and all of its active devices."

    def add_arguments(self, parser):
        parser.add_argument("license_id", type=int)
        parser.add_argument("--reason", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        license = License.objects.select_for_update().filter(pk=options["license_id"]).first()
        if not license:
            raise CommandError("License not found")
        now = timezone.now()
        license.enabled = False
        license.revoked_at = now
        license.revocation_reason = options["reason"][:256]
        license.save(update_fields=["enabled", "revoked_at", "revocation_reason"])
        license.activations.filter(active=True).update(
            active=False,
            deactivated_at=now,
            deactivation_reason="license_revoked",
        )
        LicenseAuditEvent.objects.create(
            action="owner_revoke",
            outcome="success",
            license=license,
            actor="management_command",
            reason=license.revocation_reason,
        )
        self.stdout.write(self.style.SUCCESS(f"Revoked license {license.pk}"))
