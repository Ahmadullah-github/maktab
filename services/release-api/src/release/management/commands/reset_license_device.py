from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from release.models import Activation, LicenseAuditEvent


class Command(BaseCommand):
    help = "Release a device slot for a transfer or lost-device recovery."

    def add_arguments(self, parser):
        parser.add_argument("activation_id", type=int)
        parser.add_argument("--mode", required=True, choices=["transfer", "lost-device"])
        parser.add_argument("--reason", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        activation = (
            Activation.objects.select_for_update()
            .select_related("license")
            .filter(pk=options["activation_id"])
            .first()
        )
        if not activation:
            raise CommandError("Activation not found")
        activation.active = False
        activation.deactivated_at = timezone.now()
        activation.deactivation_reason = f"{options['mode']}:{options['reason']}"[:256]
        activation.save(
            update_fields=["active", "deactivated_at", "deactivation_reason", "refreshed_at"]
        )
        LicenseAuditEvent.objects.create(
            action=f"owner_{options['mode'].replace('-', '_')}",
            outcome="success",
            license=activation.license,
            activation=activation,
            actor="management_command",
            reason=options["reason"][:256],
        )
        self.stdout.write(self.style.SUCCESS(f"Released activation {activation.pk}"))
