"""Who a registration belongs to, and what a teen is told about a duplicate."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from events.models import Event, EventRegistration

User = get_user_model()


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


def payload(email):
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


class RegistrationOwnershipTests(APITestCase):
    def setUp(self):
        self.event = make_event()
        self.teen = User.objects.create_user(
            username='ada', email='ada@example.com', password='x')
        self.admin = User.objects.create_superuser(
            username='admin', email='admin@example.com', password='x')
        self.register_url = f'/api/v1/events/events/{self.event.id}/register/'

    def test_a_leader_registering_a_teen_files_it_under_the_teen(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.register_url, payload('Ada@Example.com'), format='json')

        self.assertEqual(response.status_code, 201, response.data)
        registration = EventRegistration.objects.get(pk=response.data['id'])
        self.assertEqual(registration.user, self.teen)
        self.assertEqual(registration.registered_by, self.admin)

    def test_my_registrations_include_ones_made_for_my_email(self):
        # As the old code filed it: under the leader who entered it.
        EventRegistration.objects.create(
            event=self.event, user=self.admin, **payload('ada@example.com'),
        )
        self.client.force_authenticate(user=self.teen)
        response = self.client.get('/api/v1/events/registrations/mine/')

        self.assertEqual(response.status_code, 200)
        # `response.data` is the serializer's output before JSON, so the id is
        # still a UUID object here; the comparison is on its text.
        self.assertEqual([str(r['event']) for r in response.data], [str(self.event.id)])

    def test_a_second_registration_is_refused_in_plain_words(self):
        self.client.force_authenticate(user=self.teen)
        first = self.client.post(self.register_url, payload('ada@example.com'), format='json')
        self.assertEqual(first.status_code, 201, first.data)

        second = self.client.post(self.register_url, payload('ADA@example.com'), format='json')

        self.assertEqual(second.status_code, 400)
        self.assertIn('already registered', str(second.data['attendee_email'][0]))
        self.assertEqual(EventRegistration.objects.filter(event=self.event).count(), 1)
