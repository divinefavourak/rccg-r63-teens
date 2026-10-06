"""
Tests for check-in at the door (`events/checkin.py`).

The case that motivated the module comes first: a Teacher holds `events.checkin`
and no other events permission, and must still be able to check a teen in.
"""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from events import checkin
from events.models import Event, EventRegistration
from identity.authorization import set_membership
from identity.permissions_registry import Perm
from identity.tests.base import build_tree, make_user
from notifications.models import Notification, NotificationType


def grant(user, node, *codes):
    from identity.models import Permission, Role, RoleAssignment, RolePermission

    role, _ = Role.objects.get_or_create(
        code=f'test-{user.username}', defaults={'label': 'Test role'})
    for code in codes:
        permission, _ = Permission.objects.get_or_create(
            code=code, defaults={'label': code})
        RolePermission.objects.get_or_create(role=role, permission=permission)
    RoleAssignment.objects.get_or_create(user=user, role=role, node=node)


def make_event(title, scope_node=None, *, starts_in=timedelta(hours=-1), is_free=True,
               status=Event.Status.PUBLISHED):
    start = timezone.now() + starts_in
    return Event.objects.create(
        title=title,
        slug=title.lower().replace(' ', '-'),
        description='.',
        venue='Hall',
        start_datetime=start,
        end_datetime=start + timedelta(hours=3),
        scope_node=scope_node,
        status=status,
        is_free=is_free,
        price=None if is_free else Decimal('2000'),
    )


def make_registration(event, name='Tolu Adeyemi', **overrides):
    fields = dict(
        event=event,
        attendee_name=name,
        attendee_email=f'{name.split()[0].lower()}@example.com',
        attendee_phone='08030000000',
        attendee_age=15,
        attendee_province='lagos_province_9',
        attendee_parish='Parish A',
        guardian_name='Guardian',
        guardian_phone='08050000000',
        guardian_email='guardian@example.com',
        guardian_relationship='Mother',
        status=EventRegistration.Status.CONFIRMED,
        payment_status=EventRegistration.PaymentStatus.NOT_REQUIRED,
    )
    fields.update(overrides)
    return EventRegistration.objects.create(**fields)


class ScanOutcomeTests(TestCase):

    def setUp(self):
        self.tree = build_tree()
        self.teacher = make_user('ngozi')
        self.event = make_event('Teens Hangout', self.tree['r1'])

    def scan(self, code, event=None):
        return checkin.scan(event or self.event, code, self.teacher)

    def test_a_good_ticket_is_checked_in(self):
        registration = make_registration(self.event)

        result = self.scan(registration.registration_id)

        self.assertEqual(result['outcome'], checkin.CHECKED_IN)
        self.assertEqual(result['attendee']['name'], 'Tolu Adeyemi')
        registration.refresh_from_db()
        self.assertEqual(registration.status, EventRegistration.Status.CHECKED_IN)
        self.assertEqual(registration.checked_in_by, self.teacher)
        self.assertEqual(registration.check_in_method, 'qr_scan')

    def test_the_code_is_matched_whatever_its_case_or_padding(self):
        registration = make_registration(self.event)

        result = self.scan(f'  {registration.registration_id.lower()} ')

        self.assertEqual(result['outcome'], checkin.CHECKED_IN)

    def test_a_second_scan_says_so_and_counts_once(self):
        registration = make_registration(self.event)
        self.scan(registration.registration_id)

        result = self.scan(registration.registration_id)

        self.assertEqual(result['outcome'], checkin.ALREADY_CHECKED_IN)
        self.assertEqual(result['checked_in_by'], 'Ngozi')
        self.assertIsNotNone(result['checked_in_at'])
        self.event.refresh_from_db()
        self.assertEqual(self.event.checked_in_count, 1)
        self.assertEqual(checkin.counts_for(self.event)['checked_in'], 1)

    def test_an_unknown_code_is_not_found(self):
        self.assertEqual(self.scan('NOT-A-TICKET')['outcome'], checkin.NOT_FOUND)
        self.assertEqual(self.scan('')['outcome'], checkin.NOT_FOUND)
        self.assertIsNone(self.scan('NOT-A-TICKET')['attendee'])

    def test_a_ticket_for_another_event_names_that_event(self):
        other = make_event('Youth Praise Night', self.tree['r1'], starts_in=timedelta(days=30))
        registration = make_registration(other)

        result = self.scan(registration.registration_id)

        self.assertEqual(result['outcome'], checkin.WRONG_EVENT)
        self.assertEqual(result['other_event']['title'], 'Youth Praise Night')
        registration.refresh_from_db()
        self.assertEqual(registration.status, EventRegistration.Status.CONFIRMED)

    def test_a_cancelled_ticket_is_refused(self):
        registration = make_registration(
            self.event, status=EventRegistration.Status.CANCELLED,
            payment_status=EventRegistration.PaymentStatus.REFUNDED,
            cancelled_at=timezone.now())

        result = self.scan(registration.registration_id)

        self.assertEqual(result['outcome'], checkin.CANCELLED)
        self.assertTrue(result['refunded'])

    def test_an_unpaid_place_at_a_paid_event_is_held_not_admitted(self):
        paid_event = make_event('Camp', self.tree['r1'], is_free=False)
        registration = make_registration(
            paid_event, status=EventRegistration.Status.PENDING,
            payment_status=EventRegistration.PaymentStatus.PENDING,
            amount_due=Decimal('2000'))

        result = self.scan(registration.registration_id, event=paid_event)

        self.assertEqual(result['outcome'], checkin.NOT_PAID)
        self.assertEqual(result['amount_due'], Decimal('2000'))
        registration.refresh_from_db()
        self.assertEqual(registration.status, EventRegistration.Status.PENDING)

    def test_a_paid_place_at_a_paid_event_gets_in(self):
        paid_event = make_event('Camp', self.tree['r1'], is_free=False)
        registration = make_registration(
            paid_event, payment_status=EventRegistration.PaymentStatus.PAID)

        result = self.scan(registration.registration_id, event=paid_event)

        self.assertEqual(result['outcome'], checkin.CHECKED_IN)

    def test_a_pending_place_at_a_free_event_gets_in(self):
        """Nobody is turned away from a free event over an unticked approval."""
        registration = make_registration(
            self.event, status=EventRegistration.Status.PENDING,
            payment_status=EventRegistration.PaymentStatus.PENDING)

        result = self.scan(registration.registration_id)

        self.assertEqual(result['outcome'], checkin.CHECKED_IN)

    def test_the_waiting_list_does_not_get_in(self):
        registration = make_registration(
            self.event, status=EventRegistration.Status.WAITLISTED)

        result = self.scan(registration.registration_id)

        self.assertEqual(result['outcome'], checkin.WAITLISTED)


class CheckInNotificationTests(TestCase):
    """The teen's own phone should answer the scan."""

    def setUp(self):
        self.tree = build_tree()
        self.teacher = make_user('ngozi')
        self.teen = make_user('tolu')
        self.event = make_event('Teens Hangout', self.tree['r1'])

    def scan(self, registration):
        # The message goes out after the check-in commits; run that step here.
        with self.captureOnCommitCallbacks(execute=True):
            return checkin.scan(self.event, registration.registration_id, self.teacher)

    def test_the_teen_is_told_they_are_in(self):
        registration = make_registration(self.event, user=self.teen)

        self.scan(registration)

        note = Notification.objects.get(user=self.teen)
        self.assertEqual(note.notification_type, NotificationType.TRANSACTIONAL)
        self.assertEqual(note.title, 'You’re checked in')
        self.assertIn('Teens Hangout', note.body)
        self.assertIn('Tolu', note.body)
        self.assertEqual(
            note.deep_link, f'/events/{self.event.id}/ticket/{registration.id}')

    def test_a_second_scan_does_not_tell_them_again(self):
        registration = make_registration(self.event, user=self.teen)

        self.scan(registration)
        self.scan(registration)

        self.assertEqual(Notification.objects.filter(user=self.teen).count(), 1)

    def test_a_refused_ticket_tells_nobody(self):
        registration = make_registration(
            self.event, user=self.teen, status=EventRegistration.Status.CANCELLED)

        self.scan(registration)

        self.assertFalse(Notification.objects.exists())

    def test_an_attendee_without_an_account_is_still_checked_in(self):
        """A coordinator can register someone who has never opened the app."""
        registration = make_registration(self.event, name='Amaka Eze')

        result = self.scan(registration)

        self.assertEqual(result['outcome'], checkin.CHECKED_IN)
        self.assertFalse(Notification.objects.exists())


class CheckInAPITests(TestCase):

    def setUp(self):
        self.tree = build_tree()
        self.client = APIClient()
        # A Teacher: `events.checkin` at a parish, and no other events permission.
        self.teacher = make_user('ngozi')
        set_membership(self.teacher, self.tree['parish_a'], is_primary=True)
        grant(self.teacher, self.tree['parish_a'], Perm.EVENTS_CHECKIN)
        self.client.force_authenticate(self.teacher)

        self.event = make_event('Teens Hangout', self.tree['r1'])
        self.registration = make_registration(self.event)

    def post_scan(self, code, event=None):
        return self.client.post(
            reverse('checkin-scan'),
            {'event': str((event or self.event).pk), 'code': code},
            format='json',
        )

    def test_a_teacher_can_check_a_teen_in(self):
        """The old `registrations/<id>/check_in/` 404'd here: no `events.manage`."""
        response = self.post_scan(self.registration.registration_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['outcome'], checkin.CHECKED_IN)
        self.assertEqual(response.data['counts'], {'registered': 1, 'checked_in': 1})

    def test_a_bad_ticket_is_still_a_200(self):
        response = self.post_scan('NOT-A-TICKET')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['outcome'], checkin.NOT_FOUND)

    def test_a_teen_cannot_check_anyone_in(self):
        teen = make_user('tolu')
        set_membership(teen, self.tree['parish_a'], is_primary=True)
        self.client.force_authenticate(teen)

        response = self.post_scan(self.registration.registration_id)

        self.assertEqual(response.status_code, 403)
        self.registration.refresh_from_db()
        self.assertEqual(self.registration.status, EventRegistration.Status.CONFIRMED)

    def test_an_event_out_of_reach_404s(self):
        """Region 30's event neither reaches Parish A nor sits under it."""
        elsewhere = make_event('Region 30 Camp', self.tree['r2'])
        registration = make_registration(elsewhere, name='Ada Obi')

        response = self.post_scan(registration.registration_id, event=elsewhere)

        self.assertEqual(response.status_code, 404)

    def test_a_draft_event_cannot_be_checked_in_to(self):
        draft = make_event('Draft Camp', self.tree['r1'], status=Event.Status.DRAFT)

        response = self.post_scan('ANYTHING', event=draft)

        self.assertEqual(response.status_code, 404)

    def test_scan_needs_an_event(self):
        response = self.client.post(reverse('checkin-scan'), {'code': 'X'}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_today_lists_the_event_that_is_on_with_its_counts(self):
        make_event('Next Month', self.tree['r1'], starts_in=timedelta(days=30))
        make_registration(self.event, name='Amaka Eze',
                          status=EventRegistration.Status.CHECKED_IN)

        response = self.client.get(reverse('checkin-today'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual([e['title'] for e in response.data['events']], ['Teens Hangout'])
        self.assertEqual(response.data['events'][0]['registered'], 2)
        self.assertEqual(response.data['events'][0]['checked_in'], 1)

    def test_today_is_empty_when_nothing_is_on(self):
        self.event.delete()

        response = self.client.get(reverse('checkin-today'))

        self.assertEqual(response.data['events'], [])

    def test_search_finds_by_name_or_ticket_number_within_the_event(self):
        other = make_event('Other', self.tree['r1'])
        make_registration(other, name='Tolu Elsewhere')

        by_name = self.client.get(
            reverse('checkin-search'), {'event': str(self.event.pk), 'q': 'tolu'})
        by_number = self.client.get(
            reverse('checkin-search'),
            {'event': str(self.event.pk), 'q': self.registration.registration_id[-5:]})

        self.assertEqual([r['name'] for r in by_name.data['results']], ['Tolu Adeyemi'])
        self.assertEqual([r['name'] for r in by_number.data['results']], ['Tolu Adeyemi'])

    def test_search_ignores_a_single_letter(self):
        response = self.client.get(
            reverse('checkin-search'), {'event': str(self.event.pk), 'q': 't'})

        self.assertEqual(response.data['results'], [])
