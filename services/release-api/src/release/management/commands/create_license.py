import hashlib
import secrets

from argon2 import PasswordHasher
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from release.models import License, LicenseAuditEvent


class Command(BaseCommand):
    help = "Create a license. The raw key is printed once and is never stored."

    def add_arguments(self, parser):
        parser.add_argument("--owner-reference", required=True)
        parser.add_argument("--channel", choices=["pilot", "stable"], default="pilot")
        parser.add_argument("--expires-at")

    @transaction.atomic
    def handle(self, *args, **options):
        expires_at = parse_datetime(options["expires_at"]) if options["expires_at"] else None
        if options["expires_at"] and expires_at is None:
            raise CommandError("--expires-at must be an ISO-8601 datetime")
        raw_key = "MKTB-" + "-".join(secrets.token_hex(4).upper() for _ in range(4))
        license = License.objects.create(
            lookup_digest=hashlib.sha256(raw_key.encode()).hexdigest(),
            key_hash=PasswordHasher().hash(raw_key),
            owner_reference=options["owner_reference"],
            channel=options["channel"],
            expires_at=expires_at,
        )
        LicenseAuditEvent.objects.create(
            action="owner_create",
            outcome="success",
            license=license,
            actor="management_command",
        )
        self.stdout.write(f"license_id={license.pk}")
        self.stdout.write(f"license_key={raw_key}")
        self.stderr.write(
            "Store the license key securely now; it cannot be recovered from the service."
        )
