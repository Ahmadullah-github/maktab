from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from release.models import IdempotencyRecord, RateLimitBucket


class Command(BaseCommand):
    help = "Delete expired idempotency responses and obsolete rate-limit buckets."

    def handle(self, *args, **options):
        now = timezone.now()
        idempotency_count, _ = IdempotencyRecord.objects.filter(expires_at__lte=now).delete()
        bucket_count, _ = RateLimitBucket.objects.filter(
            window_start__lt=now - timedelta(days=2)
        ).delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {idempotency_count} idempotency rows and {bucket_count} rate buckets"
            )
        )
