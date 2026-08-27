import hashlib
import secrets

from argon2 import PasswordHasher
from django.core.management.base import BaseCommand

from release.models import License


class Command(BaseCommand):
    help = "Issue a high-entropy desktop license key and print it once"

    def add_arguments(self, parser):
        parser.add_argument("--channel", choices=["pilot", "stable"], default="pilot")

    def handle(self, *args, **options):
        key = f"MKTB-{secrets.token_urlsafe(32)}"
        License.objects.create(
            lookup_digest=hashlib.sha256(key.encode()).hexdigest(),
            key_hash=PasswordHasher().hash(key),
            channel=options["channel"],
        )
        self.stdout.write(key)
