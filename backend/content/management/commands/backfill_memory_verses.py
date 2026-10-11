"""
Give every devotional that has its verse only as text a proper memory verse.

    python manage.py backfill_memory_verses            # do it
    python manage.py backfill_memory_verses --dry-run  # only say what it would do

The Verse of the Day is a devotional's primary `MemoryVerse` row. Devotionals
the scraper saved before it learnt to write that row carry the verse only in
`memory_verse_passage` / `memory_verse_content`: the reading shows it, the
Today card says "Today's verse will show here", and the Console warns that a
devotional already published "cannot publish".

Safe to run on every deploy. It touches only devotionals that have the text
and no primary verse, and finds nothing once it has run.
"""
from django.core.management.base import BaseCommand

from content.models import Devotional
from content.services.daily import ensure_primary_memory_verse, primary_memory_verse


class Command(BaseCommand):
    help = "Derive the primary memory verse for devotionals that only have it as text."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='List the devotionals that would be given a verse; change nothing.',
        )

    def handle(self, *args, **options):
        candidates = (
            Devotional.objects
            .exclude(memory_verse_passage='')
            .exclude(memory_verse_content='')
            .prefetch_related('memory_verses')
            .order_by('date')
        )
        fixed = 0
        for devotional in candidates:
            if primary_memory_verse(devotional) is not None:
                continue
            if options['dry_run']:
                self.stdout.write(f'would fix {devotional.date}  {devotional.memory_verse_passage}')
                fixed += 1
            elif ensure_primary_memory_verse(devotional) is not None:
                fixed += 1

        verb = 'would be given' if options['dry_run'] else 'given'
        self.stdout.write(self.style.SUCCESS(f'{fixed} devotional(s) {verb} a memory verse.'))
