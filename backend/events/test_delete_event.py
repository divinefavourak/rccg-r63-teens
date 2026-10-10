"""Deleting an event from the Console: who may, and what goes with it."""
from decimal import Decimal

from rest_framework.test import APITestCase

from events import bedspaces
from events.models import BedAssignment, Event, EventRegistration, Hostel
from events.test_registration_counters import make_event, make_registration
from events.test_scoping import grant
from identity.tests.base import build_tree, make_user
from payments.models import Payment
from users.models import User

Paid = EventRegistration.PaymentStatus


class DeleteEventTests(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='admin', email='admin@example.com', password='x')
        self.event = make_event()
        self.client.force_authenticate(self.admin)

    def delete(self, event=None):
        return self.client.delete(f'/api/v1/events/events/{(event or self.event).pk}/')

    def test_an_event_is_deleted_with_its_registrations(self):
        make_registration(self.event)

        self.assertEqual(self.delete().status_code, 204)

        self.assertFalse(Event.objects.filter(pk=self.event.pk).exists())
        self.assertFalse(EventRegistration.objects.exists())

    def test_hostels_and_the_beds_in_them_go_too(self):
        event = make_event(title='Camp', slug='camp', bedspaces_enabled=True)
        Hostel.objects.create(event=event, name='Hostel A', code='HA', gender='male', capacity=2)
        registration = make_registration(event, attendee_gender='male')
        bedspaces.sync(registration)
        self.assertTrue(BedAssignment.objects.exists())

        self.assertEqual(self.delete(event).status_code, 204)

        self.assertFalse(Hostel.objects.exists())
        self.assertFalse(BedAssignment.objects.exists())

    def test_a_payment_outlives_the_event_it_was_for(self):
        event = make_event(title='Camp', slug='camp', is_free=False, price=Decimal('5000.00'))
        registration = make_registration(event, payment_status=Paid.PAID)
        payment = Payment.objects.create(
            reference='PAID1', amount=Decimal('5000.00'), registration=registration,
            description='Camp', payer_email='ada@example.com', status=Payment.Status.SUCCESS)

        self.assertEqual(self.delete(event).status_code, 204)

        payment.refresh_from_db()
        self.assertIsNone(payment.registration)
        self.assertEqual(payment.status, Payment.Status.SUCCESS)

    def test_someone_without_the_permission_is_refused(self):
        self.client.force_authenticate(
            User.objects.create_user(username='teen', email='teen@example.com', password='x'))

        self.assertIn(self.delete().status_code, (403, 404))
        self.assertTrue(Event.objects.filter(pk=self.event.pk).exists())


class DeleteEventAsAManagerTests(APITestCase):
    """A manager who is not a superuser: their own events, and not paid ones."""

    def setUp(self):
        self.tree = build_tree()
        self.manager = make_user('manager')
        grant(self.manager, self.tree['area_a'], 'events.manage', 'events.view')
        self.client.force_authenticate(self.manager)

    def event_at(self, node, **kwargs):
        return make_event(scope_node=self.tree[node], **kwargs)

    def delete(self, event):
        return self.client.delete(f'/api/v1/events/events/{event.pk}/')

    def test_an_event_they_manage_is_deleted(self):
        event = self.event_at('area_a')

        self.assertEqual(self.delete(event).status_code, 204)
        self.assertFalse(Event.objects.filter(pk=event.pk).exists())

    def test_an_event_outside_their_part_of_the_tree_is_refused(self):
        event = self.event_at('area_b')

        self.assertIn(self.delete(event).status_code, (403, 404))
        self.assertTrue(Event.objects.filter(pk=event.pk).exists())

    def test_an_event_someone_has_paid_for_is_kept(self):
        event = self.event_at('area_a', is_free=False, price=Decimal('5000.00'))
        make_registration(event, payment_status=Paid.PAID)

        response = self.delete(event)

        self.assertEqual(response.status_code, 409)
        self.assertIn('Archive', response.data['detail'])
        self.assertTrue(Event.objects.filter(pk=event.pk).exists())
