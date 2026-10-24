"""
Group registration: a coordinator buys seats for a headcount, and each teen
claims theirs at the event with the ticket number and code.
"""
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient, APITestCase

from events import batches
from events.models import Event, EventRegistration, RegistrationBatch
from events.test_registration_counters import attendee, make_event, make_registration
from hierarchy import services
from hierarchy.models import NodeType
from identity import authorization as authz
from identity.models import Role
from identity.tests.base import build_tree, make_user, seed_rbac
from profiles.models import TeenProfile

Status = EventRegistration.Status
Paid = EventRegistration.PaymentStatus
PRICE = Decimal('10000.00')


def group_event(**kwargs):
    fields = dict(is_free=False, price=PRICE, group_registration_enabled=True)
    fields.update(kwargs)
    return make_event(**fields)


def grant(user, role_code, node):
    authz.assign_role(user, Role.objects.get(code=role_code), node)


class GroupTestCase(TestCase):
    def setUp(self):
        seed_rbac()
        self.tree = build_tree()
        self.coordinator = make_user('coord')
        grant(self.coordinator, 'province_coordinator', self.tree['prov'])


class PriceTests(GroupTestCase):
    def test_a_seat_costs_the_event_price(self):
        event = group_event()
        quote = batches.quote(event, 3, 2)
        self.assertEqual(quote['unit_price'], PRICE)
        self.assertEqual(quote['amount_due'], PRICE * 5)
        self.assertFalse(quote['group_discount_applied'])

    def test_a_big_enough_group_gets_the_group_price(self):
        event = group_event(group_discount_threshold=10, group_discount_price=Decimal('8000'))
        self.assertEqual(batches.quote(event, 5, 4)['unit_price'], PRICE)
        quote = batches.quote(event, 5, 5)
        self.assertEqual(quote['unit_price'], Decimal('8000'))
        self.assertEqual(quote['amount_due'], Decimal('80000'))
        self.assertTrue(quote['group_discount_applied'])


class CreateTests(GroupTestCase):
    def test_seats_get_ticket_numbers_codes_and_the_batch_owes_their_price(self):
        event = group_event()
        batch = batches.create(self.coordinator, event, self.tree['prov'], 3, 2)

        self.assertEqual(batch.headcount, 5)
        self.assertEqual(batch.amount_due, PRICE * 5)
        self.assertEqual(batch.status, RegistrationBatch.Status.AWAITING_PAYMENT)
        seats = list(batch.seats.all())
        self.assertEqual(len(seats), 5)
        self.assertEqual(sum(s.attendee_gender == 'male' for s in seats), 3)
        self.assertEqual(len({s.registration_id for s in seats}), 5)
        self.assertEqual(len({s.claim_code for s in seats}), 5)
        for seat in seats:
            self.assertEqual(seat.status, Status.PENDING)
            self.assertEqual(seat.payment_status, Paid.PENDING)
            self.assertEqual(seat.amount_due, PRICE)
            self.assertEqual(seat.node, self.tree['prov'])
            self.assertEqual(seat.registration_type, EventRegistration.RegistrationType.BULK)
        # Pending seats hold places but are not counted as confirmed.
        event.refresh_from_db()
        self.assertEqual(event.places_taken, 5)
        self.assertEqual(event.registration_count, 0)

    def test_a_free_event_confirms_the_seats_at_once(self):
        event = make_event(group_registration_enabled=True)
        batch = batches.create(self.coordinator, event, self.tree['prov'], 1, 1)
        self.assertEqual(batch.status, RegistrationBatch.Status.PAID)
        self.assertTrue(all(s.status == Status.CONFIRMED for s in batch.seats.all()))
        event.refresh_from_db()
        self.assertEqual(event.registration_count, 2)

    def test_refused_when_the_event_does_not_take_groups(self):
        event = group_event(group_registration_enabled=False)
        with self.assertRaisesMessage(batches.BatchError, 'does not take group'):
            batches.create(self.coordinator, event, self.tree['prov'], 1, 0)

    def test_refused_past_capacity_and_never_waitlisted(self):
        event = group_event(max_attendees=4)
        make_registration(event)
        with self.assertRaisesMessage(batches.BatchError, '3 places left'):
            batches.create(self.coordinator, event, self.tree['prov'], 2, 2)
        self.assertFalse(RegistrationBatch.objects.exists())

    def test_refused_outside_the_coordinators_part_of_the_church(self):
        event = group_event()
        with self.assertRaisesMessage(batches.BatchError, 'do not manage'):
            batches.create(self.coordinator, event, self.tree['r2'], 1, 0)

    def test_a_node_inside_the_province_is_allowed(self):
        batch = batches.create(self.coordinator, group_event(), self.tree['parish_a'], 1, 0)
        self.assertEqual(batch.node, self.tree['parish_a'])

    def test_consent_must_be_confirmed_when_the_event_asks_for_it(self):
        event = group_event(requires_guardian_consent=True)
        with self.assertRaisesMessage(batches.BatchError, 'agree'):
            batches.create(self.coordinator, event, self.tree['prov'], 1, 0)
        batch = batches.create(
            self.coordinator, event, self.tree['prov'], 1, 0, consent_attested=True)
        self.assertTrue(batch.seats.get().guardian_consent)


class ResizeAndCancelTests(GroupTestCase):
    def setUp(self):
        super().setUp()
        self.event = group_event()
        self.batch = batches.create(self.coordinator, self.event, self.tree['prov'], 2, 2)

    def test_growing_and_shrinking_before_payment(self):
        batch = batches.resize(self.coordinator, self.batch, 3, 1)
        self.assertEqual((batch.male_count, batch.female_count), (3, 1))
        self.assertEqual(batch.amount_due, PRICE * 4)
        held = batch.seats.exclude(status=Status.CANCELLED)
        self.assertEqual(held.filter(attendee_gender='female').count(), 1)
        self.assertEqual(batch.seats.filter(status=Status.CANCELLED).count(), 1)

    def test_size_is_fixed_once_money_has_come_in(self):
        RegistrationBatch.objects.filter(pk=self.batch.pk).update(
            amount_paid=PRICE, status=RegistrationBatch.Status.PART_PAID)
        with self.assertRaisesMessage(batches.BatchError, 'size is fixed'):
            batches.resize(self.coordinator, self.batch, 5, 5)

    def test_a_claimed_seat_is_never_removed(self):
        teen = make_user('tobi', gender='male')
        seat = self.batch.seats.filter(attendee_gender='male').first()
        batches.claim(teen, seat.registration_id, seat.claim_code)
        batches.resize(self.coordinator, self.batch, 1, 2)
        seat.refresh_from_db()
        self.assertEqual(seat.status, Status.PENDING)
        with self.assertRaisesMessage(batches.BatchError, 'claimed'):
            batches.resize(self.coordinator, self.batch, 0, 2)

    def test_cancelling_gives_up_every_seat(self):
        batches.cancel(self.coordinator, self.batch)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.status, RegistrationBatch.Status.CANCELLED)
        self.assertFalse(self.batch.seats.exclude(status=Status.CANCELLED).exists())
        self.event.refresh_from_db()
        self.assertEqual(self.event.places_taken, 0)

    def test_naming_seats(self):
        seat = self.batch.seats.order_by('registration_id').first()
        updated, errors = batches.name_seats(self.coordinator, self.batch, [
            {'registration_id': seat.registration_id.lower(), 'name': 'Ada Obi', 'phone': '0803'},
            {'registration_id': 'NOPE-1', 'name': 'Nobody'},
        ])
        self.assertEqual(updated, 1)
        self.assertEqual(errors[0]['row'], 2)
        seat.refresh_from_db()
        self.assertEqual(seat.attendee_name, 'Ada Obi')


class ClaimTests(GroupTestCase):
    def setUp(self):
        super().setUp()
        self.event = group_event()
        self.batch = batches.create(self.coordinator, self.event, self.tree['prov'], 1, 1)
        self.seat = self.batch.seats.get(attendee_gender='female')
        self.teen = make_user('ada', gender='female', phone='08031112222')
        TeenProfile.objects.create(user=self.teen, gender='female', guardian_name='Mrs Obi')

    def test_the_seat_becomes_the_teens(self):
        seat = batches.claim(self.teen, self.seat.registration_id.lower(), self.seat.claim_code.lower())
        self.assertEqual(seat.user, self.teen)
        self.assertEqual(seat.attendee_email, self.teen.email)
        self.assertEqual(seat.attendee_name, 'Ada T')
        self.assertEqual(seat.guardian_name, 'Mrs Obi')
        self.assertIsNotNone(seat.claimed_at)
        # Claiming it again is harmless.
        self.assertEqual(batches.claim(self.teen, seat.registration_id, seat.claim_code), seat)

    def test_a_wrong_code_and_an_unknown_ticket_say_the_same(self):
        with self.assertRaisesMessage(batches.BatchError, 'do not match'):
            batches.claim(self.teen, self.seat.registration_id, 'WRONG1')
        with self.assertRaisesMessage(batches.BatchError, 'do not match'):
            batches.claim(self.teen, 'CAMP-0-0', self.seat.claim_code)

    def test_someone_elses_seat(self):
        batches.claim(self.teen, self.seat.registration_id, self.seat.claim_code)
        other = make_user('bisi', gender='female')
        with self.assertRaisesMessage(batches.BatchError, 'already been claimed'):
            batches.claim(other, self.seat.registration_id, self.seat.claim_code)

    def test_a_seat_for_the_other_gender(self):
        boys_seat = self.batch.seats.get(attendee_gender='male')
        with self.assertRaisesMessage(batches.BatchError, 'male attendee'):
            batches.claim(self.teen, boys_seat.registration_id, boys_seat.claim_code)

    def test_a_teen_who_already_has_a_ticket(self):
        make_registration(self.event, email=self.teen.email)
        with self.assertRaisesMessage(batches.BatchError, 'already have a ticket'):
            batches.claim(self.teen, self.seat.registration_id, self.seat.claim_code)


class IndividualRegistrationTests(GroupTestCase):
    def test_a_teen_still_has_to_give_their_age(self):
        event = group_event()
        teen = make_user('tobi')
        body = attendee(teen.email)
        del body['attendee_age']
        client = APIClient()
        client.force_authenticate(teen)
        response = client.post(f'/api/v1/events/events/{event.id}/register/', body, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('attendee_age', response.data)

    def test_seats_with_no_email_do_not_collide_but_emails_still_do(self):
        event = group_event()
        batches.create(self.coordinator, event, self.tree['prov'], 2, 0)
        make_registration(event, email='ada@example.com')
        with self.assertRaises(IntegrityError), transaction.atomic():
            make_registration(event, email='ada@example.com')


class BatchApiTests(APITestCase):
    def setUp(self):
        seed_rbac()
        self.tree = build_tree()
        self.coordinator = make_user('coord')
        grant(self.coordinator, 'province_coordinator', self.tree['prov'])
        self.other = make_user('other')
        other_prov = services.add_child(self.tree['r2'], NodeType.PROVINCE, 'Prov 30')
        grant(self.other, 'province_coordinator', other_prov)
        self.event = group_event()

    def test_create_list_and_see_only_your_own(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post('/api/v1/events/batches/', {
            'event': str(self.event.id), 'node': str(self.tree['prov'].id),
            'male_count': 2, 'female_count': 1,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data['seats']), 3)
        self.assertEqual(response.data['amount_due'], '30000.00')
        self.assertTrue(response.data['can_pay_online'])
        self.assertFalse(response.data['can_send_receipt'])
        batch_id = response.data['id']

        listed = self.client.get('/api/v1/events/batches/')
        items = listed.data['results'] if 'results' in listed.data else listed.data
        self.assertEqual([b['id'] for b in items], [batch_id])

        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/v1/events/batches/{batch_id}/').status_code, 404)
        listed = self.client.get('/api/v1/events/batches/')
        items = listed.data['results'] if 'results' in listed.data else listed.data
        self.assertEqual(items, [])

    def test_a_teen_cannot_register_a_group(self):
        teen = make_user('teen')
        self.client.force_authenticate(teen)
        response = self.client.post('/api/v1/events/batches/', {
            'event': str(self.event.id), 'node': str(self.tree['prov'].id),
            'male_count': 1, 'female_count': 0,
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_quote(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post('/api/v1/events/batches/quote/', {
            'event': str(self.event.id), 'male_count': 1, 'female_count': 1,
        }, format='json')
        self.assertEqual(response.data['amount_due'], '20000.00')

    def test_claim_endpoint(self):
        batch = batches.create(self.coordinator, self.event, self.tree['prov'], 1, 0)
        seat = batch.seats.get()
        teen = make_user('tobi', gender='male')
        self.client.force_authenticate(teen)
        response = self.client.post('/api/v1/events/registrations/claim/', {
            'registration_id': seat.registration_id, 'claim_code': seat.claim_code,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['registration_id'], seat.registration_id)
        mine = self.client.get('/api/v1/events/registrations/mine/')
        self.assertEqual([r['id'] for r in mine.data], [str(seat.id)])

    def test_resize_and_cancel_through_the_api(self):
        batch = batches.create(self.coordinator, self.event, self.tree['prov'], 1, 1)
        self.client.force_authenticate(self.coordinator)
        response = self.client.patch(
            f'/api/v1/events/batches/{batch.id}/', {'male_count': 4}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['headcount'], 5)
        response = self.client.post(f'/api/v1/events/batches/{batch.id}/cancel/')
        self.assertEqual(response.data['status'], 'cancelled')

    def test_event_payment_settings_are_validated(self):
        admin = make_user('admin', is_superuser=True)
        self.client.force_authenticate(admin)
        response = self.client.patch(
            f'/api/v1/events/events/{self.event.id}/', {'payment_method': 'manual'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('bank_account_number', response.data)
        response = self.client.patch(f'/api/v1/events/events/{self.event.id}/', {
            'payment_method': 'manual', 'bank_name': 'Zenith Bank',
            'bank_account_number': '1234567890', 'bank_account_name': 'RCCG Teens',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.event.refresh_from_db()
        self.assertEqual(self.event.payment_method, Event.PaymentMethod.MANUAL)
