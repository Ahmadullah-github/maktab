from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from release.release_artifacts import load_release_descriptor, register_release


class Command(BaseCommand):
    help = "Register an immutable, disabled desktop release descriptor"

    def add_arguments(self, parser):
        parser.add_argument("descriptor")
        parser.add_argument("--actor", required=True)
        parser.add_argument("--reason", required=True)

    def handle(self, *args, **options):
        try:
            release = register_release(
                load_release_descriptor(options["descriptor"]),
                actor=options["actor"],
                reason=options["reason"],
            )
        except ValidationError as exc:
            raise CommandError("; ".join(exc.messages)) from exc
        self.stdout.write(f"build_id={release.build_id}")
        self.stdout.write("enabled=false")
