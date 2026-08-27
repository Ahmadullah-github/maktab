from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from release.release_artifacts import set_release_state


class Command(BaseCommand):
    help = "Enable a registered desktop release without changing its immutable artifacts"

    def add_arguments(self, parser):
        parser.add_argument("build_id")
        parser.add_argument("--actor", required=True)
        parser.add_argument("--reason", required=True)

    def handle(self, *args, **options):
        try:
            release = set_release_state(
                options["build_id"],
                rollout_percent=None,
                enabled=True,
                actor=options["actor"],
                reason=options["reason"],
            )
        except ValidationError as exc:
            raise CommandError("; ".join(exc.messages)) from exc
        self.stdout.write(f"enabled={str(release.enabled).lower()}")
