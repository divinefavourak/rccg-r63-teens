"""
Management command to scrape Teen Open Heaven devotionals.

Usage:
    python manage.py scrape_devotional                    # Scrape today's devotional
    python manage.py scrape_devotional --date 2026-01-20  # Scrape specific date
    python manage.py scrape_devotional --range 7          # Scrape last 7 days
"""
from datetime import date, timedelta
from django.core.management.base import BaseCommand, CommandError
from content.services.devotional_scraper import scrape_and_save_devotional, DevotionalScraper


class Command(BaseCommand):
    help = 'Scrape Teen Open Heaven devotional for a specific date or date range'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            help='Date to scrape in YYYY-MM-DD format. Defaults to today.',
        )
        parser.add_argument(
            '--range',
            type=int,
            help='Number of days to scrape (going backwards from --date or today).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only show what would be scraped, do not save to database.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force re-scrape even if devotional already exists.',
        )

    def handle(self, *args, **options):
        # Parse target date
        if options['date']:
            try:
                target_date = date.fromisoformat(options['date'])
            except ValueError:
                raise CommandError(f"Invalid date format: {options['date']}. Use YYYY-MM-DD.")
        else:
            target_date = date.today()
        
        # Determine date range
        days_range = options.get('range') or 1
        dates_to_scrape = [target_date - timedelta(days=i) for i in range(days_range)]
        dates_to_scrape.reverse()  # Process oldest first
        
        dry_run = options.get('dry_run', False)
        force = options.get('force', False)
        
        self.stdout.write(self.style.NOTICE(
            f"Scraping {len(dates_to_scrape)} devotional(s) from {dates_to_scrape[0]} to {dates_to_scrape[-1]}"
        ))
        
        success_count = 0
        skip_count = 0
        fail_count = 0
        
        for scrape_date in dates_to_scrape:
            # Check if exists
            from content.models import Devotional
            
            exists = Devotional.objects.filter(date=scrape_date).exists()
            if exists and not force:
                self.stdout.write(self.style.WARNING(
                    f"  {scrape_date}: Already exists, skipping. Use --force to override."
                ))
                skip_count += 1
                continue
            
            if dry_run:
                # Just show URL
                scraper = DevotionalScraper()
                url = scraper.build_url(scrape_date)
                self.stdout.write(f"  {scrape_date}: Would scrape from {url}")
                continue
            
            # Scrape first, then replace — avoids data loss if save fails
            result = scrape_and_save_devotional(scrape_date, force=force)

            if result:
                self.stdout.write(self.style.SUCCESS(
                    f"  {scrape_date}: [OK] Saved '{result['title'][:50]}...'"
                ))
                success_count += 1
            else:
                self.stdout.write(self.style.ERROR(
                    f"  {scrape_date}: [FAIL] Failed to scrape"
                ))
                fail_count += 1
        
        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.NOTICE('Summary:'))
        self.stdout.write(f"  Scraped: {success_count}")
        self.stdout.write(f"  Skipped: {skip_count}")
        self.stdout.write(f"  Failed: {fail_count}")
        
        if fail_count > 0:
            raise CommandError(f"{fail_count} devotional(s) failed to scrape")
