"""
Delete old OTP rows so plaintext-destination PII and stale codes don't linger.
Codes expire in minutes; this purges the records. Run on a schedule (cron/beat).
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from users.models import OTPCode


class Command(BaseCommand):
    help = 'Purge OTP codes older than the retention window (default 24h).'

    def add_arguments(self, parser):
        parser.add_argument('--hours', type=int, default=24)

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=options['hours'])
        deleted, _ = OTPCode.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(self.style.SUCCESS(
            f'Purged {deleted} OTP row(s) older than {options["hours"]}h.'))
