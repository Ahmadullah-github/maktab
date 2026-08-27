from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from release.release_artifacts import set_release_state


class Command(BaseCommand):
    help = "Set deterministic rollout percentage for a registered desktop release"

    def add_arguments(self, parser):
        parser.add_argument("build_id")
        parser.add_argument("percent", type=int)
        parser.add_argument("--actor", required=True)
        parser.add_argument("--reason", required=True)

    def handle(self, *args, **options):
        try:
            release = set_release_state(
                options["build_id"],
                rollout_percent=options["percent"],
                enabled=None,
                actor=options["actor"],
                reason=options["reason"],
            )
        except ValidationError as exc:
            raise CommandError("; ".join(exc.messages)) from exc
        self.stdout.write(f"rollout_percent={release.rollout_percent}")
