"""
Seed an event that is on right now, with one ticket for every check-in result.

For trying the phone's check-in screen on real devices: one phone shows a
ticket's QR code, another scans it. See `mobile/TESTING.md`.

Usage:
    python manage.py seed_checkin_demo --email tolu@example.com
    python manage.py seed_checkin_demo --email tolu@example.com --reset

`--email` is an existing account that will hold two of the tickets, so it has QR
codes to show. `--reset` puts every seeded ticket back to how it started, for a
second run through the table.

**Local databases only.** The command refuses to run against any database that
is not on this computer, because it writes made-up events and people.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone

from events.models import Event, EventRegistration

TODAY_SLUG = 'seed-teens-hangout'
LATER_SLUG = 'seed-youth-praise-night'
_LOCAL_HOSTS = ('localhost', '127.0.0.1', '::1')

Status = EventRegistration.Status
Pay = EventRegistration.PaymentStatus


class Command(BaseCommand):
    help = 'Seed an event on today with a ticket for each check-in outcome (local only).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email', required=True,
            help='An existing account that will hold two of the tickets.',
        )
        parser.add_argument(
            '--reset', action='store_true',
            help='Put the seeded tickets back to unscanned.',
        )

    def handle(self, *args, **options):
        host = connection.settings_dict.get('HOST') or ''
        if connection.vendor != 'sqlite' and host not in _LOCAL_HOSTS:
            raise CommandError(
                f'Refusing to seed: the database host is {host!r}, not this computer. '
                'Point DATABASE_URL at your local database first.'
            )

        holder = get_user_model().objects.filter(email__iexact=options['email']).first()
        if holder is None:
            raise CommandError(f'No account with the email {options["email"]}.')

        now = timezone.now()
        # On now: started an hour ago, ends tonight. Paid, so "not paid" can happen.
        today = self._event(
            TODAY_SLUG, 'Teens Hangout 2026',
            now - timedelta(hours=1), now + timedelta(hours=8),
            is_free=False, price=Decimal('2000'), max_attendees=240,
        )
        # A different event, weeks away, for the "Different event" screen.
        later = self._event(
            LATER_SLUG, 'Youth Praise Night',
            now + timedelta(days=30), now + timedelta(days=30, hours=4),
            is_free=True,
        )

        name = holder.get_full_name() or holder.username
        # (what a scan should show, event, name, email, status, payment, account)
        plan = [
            ('Checked in, then Already checked in on a second scan',
             today, name, holder.email, Status.CONFIRMED, Pay.PAID, holder),
            ('Different event',
             later, name, holder.email, Status.CONFIRMED, Pay.NOT_REQUIRED, holder),
            # No accounts below: reach these with "Search name or ticket number".
            ('Not paid yet',
             today, 'Chidi Nwosu', 'chidi@example.com', Status.PENDING, Pay.PENDING, None),
            ('Registration cancelled',
             today, 'Dayo Ojo', 'dayo@example.com', Status.CANCELLED, Pay.REFUNDED, None),
            ('On the waiting list',
             today, 'Zainab Bello', 'zainab@example.com', Status.WAITLISTED, Pay.PENDING, None),
            ('Checked in (a second good ticket)',
             today, 'Amaka Eze', 'amaka@example.com', Status.CONFIRMED, Pay.PAID, None),
        ]

        self.stdout.write('')
        self.stdout.write(
            f'Event on now: {today.title} '
            f'({today.start_datetime:%H:%M} to {today.end_datetime:%H:%M} UTC)')
        self.stdout.write('')
        self.stdout.write(f'{"Ticket":<24} {"Name":<16} Scanning it should show')
        for expect, event, who, email, status, payment, user in plan:
            ticket = self._ticket(
                event, who, email, status, payment, user, reset=options['reset'], now=now)
            self.stdout.write(f'{ticket.registration_id:<24} {who:<16} {expect}')
        self.stdout.write('')
        self.stdout.write('A made-up code such as NOPE-123 should show: Ticket not found')

        if options['reset']:
            Event.objects.filter(pk=today.pk).update(checked_in_count=0)
            self.stdout.write(self.style.SUCCESS('Seeded tickets are back to unscanned.'))

    def _event(self, slug, title, start, end, **extra):
        event, _ = Event.objects.update_or_create(
            slug=slug,
            defaults=dict(
                title=title,
                event_type=Event.EventType.HANGOUT,
                description='A seeded event for trying check-in.',
                short_description='Seeded for testing.',
                venue='Rehoboth Parish',
                city='Lagos',
                start_datetime=start,
                end_datetime=end,
                status=Event.Status.PUBLISHED,
                **extra,
            ),
        )
        return event

    def _ticket(self, event, name, email, status, payment, user, *, reset, now):
        cancelled_at = now - timedelta(days=12) if status == Status.CANCELLED else None
        ticket, created = EventRegistration.objects.get_or_create(
            event=event,
            attendee_email=email,
            defaults=dict(
                user=user,
                attendee_name=name,
                attendee_phone='08030000000',
                attendee_age=15,
                attendee_province='lagos_province_69',
                attendee_parish='Rehoboth Parish',
                guardian_name='A Guardian',
                guardian_phone='08050000000',
                guardian_email='guardian@example.com',
                guardian_relationship='Mother',
                guardian_consent=True,
                status=status,
                payment_status=payment,
                amount_due=None if event.is_free else event.price,
                cancelled_at=cancelled_at,
            ),
        )
        if reset and not created:
            # `update`, not `save`: nothing here should send an e-mail or a push.
            EventRegistration.objects.filter(pk=ticket.pk).update(
                status=status, payment_status=payment, cancelled_at=cancelled_at,
                checked_in_at=None, checked_in_by=None, check_in_method='',
            )
            ticket.refresh_from_db()
        return ticket
