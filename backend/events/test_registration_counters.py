"""
Capacity, counters and ticket numbers under repeated or simultaneous requests.

Each test here is a way the numbers used to go wrong: a pending registration
that did not count towards the limit, a confirmation counted twice, a cancelled
arrival that never gave its place back, a ticket checked in at two doors.
"""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from events.models import Event, EventRegistration, RegistrationAuditLog

User = get_user_model()
Status = EventRegistration.Status


def make_event(**kwargs):
    defaults = dict(
        title='Teens Conference',
        description='Two days.',
        start_datetime=timezone.now() + timedelta(days=10),
        end_datetime=timezone.now() + timedelta(days=11),
        status=Event.Status.PUBLISHED,
        registration_status=Event.RegistrationStatus.OPEN,
        is_free=True,
        requires_guardian_consent=False,
    )
    defaults.update(kwargs)
    return Event.objects.create(**defaults)


def attendee(email):
    return {
        'attendee_name': 'Ada Obi',
        'attendee_email': email,
        'attendee_phone': '08030000000',
        'attendee_age': 15,
        'attendee_province': 'lagos_province_9',
        'attendee_parish': 'RCCG Rehoboth Parish',
        'guardian_name': 'Mrs Obi',
        'guardian_phone': '08030000001',
        'guardian_email': 'parent@example.com',
        'guardian_relationship': 'Mother',
    }


def make_registration(event, email='ada@example.com', **overrides):
    fields = dict(
        event=event,
        payment_status=EventRegistration.PaymentStatus.NOT_REQUIRED,
        **attendee(email),
    )
    fields.update(overrides)
    return EventRegistration.objects.create(**fields)


class CapacityTests(APITestCase):
    def setUp(self):
        self.ada = User.objects.create_user(
            username='ada', email='ada@example.com', password='x')
        self.bisi = User.objects.create_user(
            username='bisi', email='bisi@example.com', password='x')

    def register(self, user, event):
        self.client.force_authenticate(user=user)
        return self.client.post(
            f'/api/v1/events/events/{event.id}/register/', attendee(user.email), format='json')

    def test_a_pending_registration_holds_the_last_place(self):
        # The waitlist is on unless an event turns it off.
        event = make_event(max_attendees=1, waitlist_enabled=False)

        first = self.register(self.ada, event)
        second = self.register(self.bisi, event)

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data['status'], Status.PENDING)
        self.assertEqual(second.status_code, 400)
        self.assertIn('full', str(second.data['event']))
        self.assertEqual(event.registrations.count(), 1)

    def test_a_full_event_with_a_waitlist_waitlists(self):
        event = make_event(max_attendees=1, waitlist_enabled=True)

        self.register(self.ada, event)
        second = self.register(self.bisi, event)

        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(second.data['status'], Status.WAITLISTED)

    def test_a_cancelled_place_can_be_taken_again(self):
        event = make_event(max_attendees=1)
        make_registration(event).cancel()

        response = self.register(self.bisi, event)

        self.assertEqual(response.status_code, 201, response.data)

    def test_spots_remaining_counts_pending_and_ignores_cancelled_and_waitlisted(self):
        event = make_event(max_attendees=3)
        make_registration(event, 'a@example.com', status=Status.PENDING)
        make_registration(event, 'b@example.com', status=Status.CONFIRMED)
        make_registration(event, 'c@example.com', status=Status.CANCELLED)
        make_registration(event, 'd@example.com', status=Status.WAITLISTED)

        self.assertEqual(event.places_taken, 2)
        self.assertEqual(event.spots_remaining, 1)
        self.assertFalse(event.is_full)


class CounterTests(TestCase):
    def setUp(self):
        self.event = make_event()
        self.registration = make_registration(self.event)

    def counters(self):
        self.event.refresh_from_db()
        return self.event.registration_count, self.event.checked_in_count

    def test_confirming_twice_counts_once(self):
        first = self.registration.confirm()
        second = self.registration.confirm()

        self.assertEqual(first, Status.PENDING)
        self.assertIsNone(second)
        self.assertEqual(self.counters(), (1, 0))

    def test_a_stale_copy_cannot_confirm_again(self):
        """Two leaders each loaded the registration while it was still pending."""
        stale = EventRegistration.objects.get(pk=self.registration.pk)

        self.registration.confirm()
        again = stale.confirm()

        self.assertIsNone(again)
        self.assertEqual(self.counters(), (1, 0))

    def test_checking_in_twice_counts_once(self):
        self.registration.confirm()

        self.registration.check_in()
        again = self.registration.check_in()

        self.assertIsNone(again)
        self.assertEqual(self.counters(), (1, 1))

    def test_checking_in_a_pending_registration_counts_it_as_registered_too(self):
        self.registration.check_in()

        self.assertEqual(self.counters(), (1, 1))

    def test_cancelling_an_arrival_gives_back_the_place_and_the_arrival(self):
        self.registration.confirm()
        self.registration.check_in()

        self.registration.cancel()

        self.assertEqual(self.counters(), (0, 0))

    def test_cancelling_a_pending_registration_changes_no_counter(self):
        self.registration.cancel()

        self.assertEqual(self.counters(), (0, 0))

    def test_a_counter_that_was_already_too_low_stops_at_zero(self):
        """Rows written before the counters were kept true: confirmed, never counted."""
        EventRegistration.objects.filter(pk=self.registration.pk).update(
            status=Status.CONFIRMED)

        self.registration.cancel()

        self.assertEqual(self.counters(), (0, 0))

    def test_a_status_change_does_not_overwrite_other_fields(self):
        stale = EventRegistration.objects.get(pk=self.registration.pk)
        EventRegistration.objects.filter(pk=self.registration.pk).update(
            internal_notes='Paid cash at the parish office')

        stale.confirm()

        self.registration.refresh_from_db()
        self.assertEqual(self.registration.internal_notes, 'Paid cash at the parish office')


class TicketNumberTests(TestCase):
    def test_a_number_taken_by_a_simultaneous_registration_is_tried_again(self):
        event = make_event()
        first = make_registration(event, 'a@example.com')
        taken = first.registration_id
        free = taken[:-5] + '00002'

        # What the second request saw: it read the last number before the first
        # one was committed, so it picked the same one.
        with patch.object(
            EventRegistration, '_next_registration_id', side_effect=[taken, free],
        ):
            second = make_registration(event, 'b@example.com')

        self.assertEqual(second.registration_id, free)

    def test_a_duplicate_email_is_not_mistaken_for_a_taken_number(self):
        from django.db import IntegrityError, transaction

        event = make_event()
        make_registration(event, 'a@example.com')

        with self.assertRaises(IntegrityError), transaction.atomic():
            make_registration(event, 'a@example.com')

        self.assertEqual(event.registrations.count(), 1)


class LeaderActionTests(APITestCase):
    def setUp(self):
        self.event = make_event()
        self.registration = make_registration(self.event)
        self.admin = User.objects.create_superuser(
            username='admin', email='admin@example.com', password='x')
        self.client.force_authenticate(user=self.admin)
        self.base = f'/api/v1/events/registrations/{self.registration.id}'

    def counters(self):
        self.event.refresh_from_db()
        return self.event.registration_count, self.event.checked_in_count

    def test_the_older_check_in_route_checks_in_once(self):
        self.registration.confirm()

        first = self.client.post(f'{self.base}/check_in/', {}, format='json')
        second = self.client.post(f'{self.base}/check_in/', {}, format='json')

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data['status'], Status.CHECKED_IN)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.data['outcome'], 'already_checked_in')
        self.assertEqual(self.counters(), (1, 1))
        self.assertEqual(
            RegistrationAuditLog.objects.filter(action='check_in').count(), 1)

    def test_the_older_check_in_route_refuses_a_cancelled_ticket(self):
        self.registration.cancel()

        response = self.client.post(f'{self.base}/check_in/', {}, format='json')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['outcome'], 'cancelled')
        self.assertEqual(self.counters(), (0, 0))

    @patch('events.views.EventEmailService')
    def test_confirming_twice_logs_and_announces_once(self, mock_email):
        body = {'status': 'confirmed'}

        first = self.client.post(f'{self.base}/update_status/', body, format='json')
        second = self.client.post(f'{self.base}/update_status/', body, format='json')

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(second.data['status'], Status.CONFIRMED)
        self.assertEqual(self.counters(), (1, 0))
        self.assertEqual(
            RegistrationAuditLog.objects.filter(action='status_change').count(), 1)
        mock_email.send_registration_confirmed.assert_called_once()
