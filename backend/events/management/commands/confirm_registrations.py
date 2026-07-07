"""
One-shot command to bulk-confirm (or mark attended) all pending registrations
for an event without triggering any email notifications.

Usage:
    python manage.py confirm_registrations <event-slug-or-id>
    python manage.py confirm_registrations <event-slug-or-id> --target attended
    python manage.py confirm_registrations <event-slug-or-id> --status pending waitlisted
    python manage.py confirm_registrations <event-slug-or-id> --dry-run
    python manage.py confirm_registrations <event-slug-or-id> --no-input
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from events.models import Event, EventRegistration

_CONFIRMED_STATUSES = {
    EventRegistration.Status.CONFIRMED,
    EventRegistration.Status.ATTENDED,
    EventRegistration.Status.CHECKED_IN,
}


class Command(BaseCommand):
    help = 'Bulk-confirm or mark-attended registrations for an event without sending emails'

    def add_arguments(self, parser):
        parser.add_argument('event', help='Event slug or UUID')
        parser.add_argument(
            '--status',
            nargs='+',
            default=['pending'],
            choices=[s.value for s in EventRegistration.Status],
            metavar='STATUS',
            help='Source statuses to update (default: pending)',
        )
        parser.add_argument(
            '--target',
            default='confirmed',
            choices=[s.value for s in EventRegistration.Status],
            metavar='TARGET',
            help='Destination status (default: confirmed). Use "attended" for past events.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without writing to the database',
        )
        parser.add_argument(
            '--no-input', '--noinput',
            action='store_false',
            dest='interactive',
            help='Skip the confirmation prompt (for scripted use)',
        )

    def handle(self, *args, **options):
        event_ref = options['event']
        source_statuses = options['status']
        target_status = options['target']
        dry_run = options['dry_run']
        interactive = options['interactive']

        # Resolve event by slug first, then UUID
        try:
            event = Event.objects.get(slug=event_ref)
        except Event.DoesNotExist:
            try:
                event = Event.objects.get(pk=event_ref)
            except (Event.DoesNotExist, Exception):
                raise CommandError(f'No event found matching "{event_ref}"')

        qs = EventRegistration.objects.filter(event=event, status__in=source_statuses)
        count = qs.count()

        if count == 0:
            self.stdout.write(self.style.WARNING(
                f'No registrations with status {source_statuses} found for "{event.title}"'
            ))
            return

        self.stdout.write(
            f'\nEvent:  {event.title} ({event.slug})\n'
            f'Status: {source_statuses} -> {target_status}\n'
            f'Count:  {count} registration(s)\n'
        )

        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run — no changes written.'))
            return

        if interactive:
            answer = input(f'Set {count} registration(s) to "{target_status}"? [y/N] ').strip().lower()
            if answer != 'y':
                self.stdout.write(self.style.WARNING('Aborted.'))
                return

        now = timezone.now()
        update_fields = {'status': target_status}
        if target_status in ('confirmed', 'attended'):
            update_fields['approved_at'] = now
        elif target_status == 'checked_in':
            update_fields['checked_in_at'] = now

        with transaction.atomic():
            updated = qs.update(**update_fields)
            event_updates = {}
            if target_status in _CONFIRMED_STATUSES:
                event_updates['registration_count'] = F('registration_count') + updated
            if target_status in ('attended', 'checked_in'):
                event_updates['checked_in_count'] = F('checked_in_count') + updated
            if event_updates:
                Event.objects.filter(pk=event.pk).update(**event_updates)

        self.stdout.write(self.style.SUCCESS(
            f'Done. {updated} registration(s) set to "{target_status}" (no emails sent).'
        ))
