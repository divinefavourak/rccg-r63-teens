"""Bedspaces: who gets a bed, which one, and when they give it back."""
from django.core.exceptions import ValidationError
from django.test import TestCase

from events import bedspaces
from events.models import BedAssignment, EventRegistration, Hostel
from events.test_registration_counters import make_event, make_registration

Status = EventRegistration.Status
Payment = EventRegistration.PaymentStatus


def hostel(event, code='HA', gender='male', capacity=3, reserved=0):
    return Hostel.objects.create(
        event=event, name=f'Hostel {code}', code=code, gender=gender,
        capacity=capacity, reserved_for_leaders=reserved,
    )


def boy(event, n, **overrides):
    return make_registration(event, email=f'boy{n}@example.com', attendee_gender='male', **overrides)


class AllocationTests(TestCase):

    def setUp(self):
        self.event = make_event(bedspaces_enabled=True)

    def test_beds_are_numbered_serially(self):
        hostel(self.event)
        codes = [bedspaces.sync(boy(self.event, n)).code for n in range(3)]
        self.assertEqual(codes, ['HA-001', 'HA-002', 'HA-003'])

    def test_nothing_happens_while_the_event_has_bedspaces_off(self):
        event = make_event(title='Day event', slug='day-event')
        hostel(event)
        self.assertIsNone(bedspaces.sync(boy(event, 1)))
        self.assertEqual(BedAssignment.objects.count(), 0)

    def test_running_out_leaves_the_registration_without_a_bed(self):
        hostel(self.event, capacity=1)
        bedspaces.sync(boy(self.event, 1))
        late = boy(self.event, 2)
        self.assertIsNone(bedspaces.sync(late))
        self.assertIn('No bedspace is left', bedspaces.describe(late))

    def test_boys_and_girls_never_share_a_hostel(self):
        hostel(self.event, code='HA', gender='male')
        girls = hostel(self.event, code='HB', gender='female')
        girl = make_registration(self.event, email='girl@example.com', attendee_gender='Female')
        self.assertEqual(bedspaces.sync(girl).hostel, girls)

    def test_no_gender_is_never_placed_automatically(self):
        hostel(self.event)
        unknown = make_registration(self.event, email='x@example.com')
        self.assertIsNone(bedspaces.sync(unknown))
        self.assertEqual(bedspaces.summary(self.event)['waiting_without_gender'], 1)

    def test_a_second_hostel_is_used_when_the_first_is_full(self):
        hostel(self.event, code='HA', capacity=1)
        hostel(self.event, code='HC', capacity=1)
        bedspaces.sync(boy(self.event, 1))
        self.assertEqual(bedspaces.sync(boy(self.event, 2)).code, 'HC-001')

    def test_syncing_twice_keeps_the_same_bed(self):
        hostel(self.event)
        registration = boy(self.event, 1)
        first = bedspaces.sync(registration)
        self.assertEqual(bedspaces.sync(registration).pk, first.pk)


class LeaderBedTests(TestCase):

    def setUp(self):
        self.event = make_event(bedspaces_enabled=True)
        self.hostel = hostel(self.event, capacity=3, reserved=1)

    def test_attendees_do_not_take_a_leaders_bed(self):
        bedspaces.sync(boy(self.event, 1))
        bedspaces.sync(boy(self.event, 2))
        self.assertIsNone(bedspaces.sync(boy(self.event, 3)))

    def test_a_leader_takes_a_reserved_bed_and_only_one_of_those(self):
        first = boy(self.event, 1, attending_as_leader=True)
        self.assertTrue(bedspaces.sync(first).for_leader)
        self.assertIsNone(bedspaces.sync(boy(self.event, 2, attending_as_leader=True)))

    def test_lowering_the_reservation_releases_beds_to_attendees(self):
        for n in range(3):
            bedspaces.sync(boy(self.event, n))
        self.assertEqual(bedspaces.summary(self.event)['waiting'], 1)
        self.hostel.reserved_for_leaders = 0
        self.hostel.save()
        self.assertEqual(bedspaces.place_waiting(self.event), 1)
        self.assertEqual(bedspaces.summary(self.event)['waiting'], 0)

    def test_nobody_without_a_leader_role_attends_as_a_leader(self):
        self.assertFalse(bedspaces.attends_as_leader(None, 25, wanted=True))


class LifecycleTests(TestCase):

    def setUp(self):
        self.event = make_event(bedspaces_enabled=True)
        hostel(self.event, capacity=1)

    def test_cancelling_gives_the_bed_back(self):
        first = boy(self.event, 1)
        bedspaces.sync(first)
        first.cancel()
        self.assertEqual(BedAssignment.objects.count(), 0)
        self.assertEqual(bedspaces.sync(boy(self.event, 2)).code, 'HA-001')

    def test_a_waitlisted_registration_gets_a_bed_when_it_is_confirmed(self):
        waiting = boy(self.event, 1, status=Status.WAITLISTED)
        self.assertIsNone(bedspaces.sync(waiting))
        waiting.confirm()
        self.assertEqual(waiting.bed.code, 'HA-001')

    def test_a_paid_event_holds_the_bed_until_payment(self):
        event = make_event(title='Camp', slug='camp', is_free=False, price=5000,
                           bedspaces_enabled=True)
        hostel(event)
        registration = boy(event, 1, payment_status=Payment.PENDING)
        bedspaces.sync(registration)
        self.assertFalse(bedspaces.is_firm(registration))
        self.assertIn('is held for you', bedspaces.describe(registration))
        registration.payment_status = Payment.PAID
        self.assertTrue(bedspaces.is_firm(registration))


class ManualPlacementTests(TestCase):

    def setUp(self):
        self.event = make_event(bedspaces_enabled=True)
        self.boys = hostel(self.event, code='HA', capacity=2)
        self.more_boys = hostel(self.event, code='HC', capacity=2)
        self.girls = hostel(self.event, code='HB', gender='female')

    def test_moving_takes_the_first_free_bed_in_the_chosen_hostel(self):
        registration = boy(self.event, 1)
        bedspaces.sync(registration)
        self.assertEqual(bedspaces.move(registration, self.more_boys).code, 'HC-001')
        self.assertEqual(self.boys.beds.count(), 0)

    def test_a_boy_cannot_be_moved_into_the_girls_hostel(self):
        registration = boy(self.event, 1)
        bedspaces.sync(registration)
        with self.assertRaises(ValidationError):
            bedspaces.move(registration, self.girls)
        # The refused move is undone with the rest of its transaction.
        self.assertEqual(BedAssignment.objects.get(registration=registration).hostel, self.boys)
