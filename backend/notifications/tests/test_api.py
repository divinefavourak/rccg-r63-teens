"""Tests for the notification API — inbox, preferences, push registration."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from notifications import services
from notifications.models import Intensity, NotificationType, PushSubscription

User = get_user_model()


def make_user(username='teen'):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x')


class InboxAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.other = make_user('other')
        self.client.force_authenticate(self.user)

    def test_lists_only_my_notifications(self):
        services.send(self.user, NotificationType.SYSTEM, 'Mine', 'B')
        services.send(self.other, NotificationType.SYSTEM, 'Theirs', 'B')

        response = self.client.get(reverse('notification-list'))

        self.assertEqual(response.status_code, 200)
        titles = [n['title'] for n in response.data['results']]
        self.assertEqual(titles, ['Mine'])

    def test_another_users_notification_404s_rather_than_403s(self):
        """A 403 would confirm the row exists."""
        theirs = services.send(self.other, NotificationType.SYSTEM, 'Theirs', 'B')

        response = self.client.get(reverse('notification-detail', args=[theirs.id]))

        self.assertEqual(response.status_code, 404)

    def test_unread_count(self):
        services.send(self.user, NotificationType.SYSTEM, 'A', 'B')

        response = self.client.get(reverse('notification-unread-count'))

        self.assertEqual(response.data['unread_count'], 1)

    def test_mark_all_read(self):
        services.send(self.user, NotificationType.SYSTEM, 'A', 'B')
        services.send(self.user, NotificationType.SYSTEM, 'C', 'D')

        response = self.client.post(reverse('notification-mark-read'), {}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['marked_read'], 2)
        self.assertEqual(response.data['unread_count'], 0)

    def test_mark_specific_read(self):
        first = services.send(self.user, NotificationType.SYSTEM, 'A', 'B')
        services.send(self.user, NotificationType.SYSTEM, 'C', 'D')

        response = self.client.post(
            reverse('notification-mark-read'),
            {'ids': [str(first.id)]}, format='json',
        )

        self.assertEqual(response.data['unread_count'], 1)

    def test_the_inbox_requires_authentication(self):
        self.client.force_authenticate(None)

        self.assertIn(self.client.get(reverse('notification-list')).status_code,
                      (401, 403))


class PreferenceAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.client.force_authenticate(self.user)
        self.url = reverse('notification-preferences')

    def test_preferences_are_created_lazily_with_documented_defaults(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['intensity'], Intensity.STANDARD)
        self.assertEqual(str(response.data['quiet_hours_start']), '21:30:00')
        self.assertEqual(response.data['active_rungs'], ['morning', 'evening'])

    def test_changing_intensity_changes_the_active_rungs(self):
        response = self.client.patch(
            self.url, {'intensity': Intensity.COMMITTED}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['active_rungs']), 4)

    def test_muting_a_type(self):
        response = self.client.patch(
            self.url, {'announcements_enabled': False}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(services.preferences_for(self.user).announcements_enabled)

    def test_an_invalid_timezone_is_rejected(self):
        response = self.client.patch(
            self.url, {'timezone': 'Mars/Olympus_Mons'}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_the_step_down_state_is_read_only(self):
        """The step-down is something the system reports, not a field a client sets."""
        preference = services.preferences_for(self.user)
        preference.consecutive_ignored_days = 5
        preference.save()

        self.client.patch(self.url, {'last_stepped_down_at': None}, format='json')

        preference.refresh_from_db()
        self.assertEqual(preference.consecutive_ignored_days, 5)

    def test_preferences_are_owner_scoped(self):
        other = make_user('other')
        services.preferences_for(other)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            services.preferences_for(self.user).user_id, self.user.id)


class PushSubscriptionAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.client.force_authenticate(self.user)
        self.url = reverse('notification-push')
        self.payload = {
            'endpoint': 'https://push.example/abc',
            'p256dh': 'key',
            'auth': 'auth',
            'user_agent': 'Chrome/Android',
        }

    def test_subscribing(self):
        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            PushSubscription.objects.filter(user=self.user, is_active=True).exists())

    def test_resubscribing_does_not_duplicate(self):
        self.client.post(self.url, self.payload, format='json')
        self.client.post(self.url, self.payload, format='json')

        self.assertEqual(PushSubscription.objects.filter(user=self.user).count(), 1)

    def test_unsubscribing(self):
        self.client.post(self.url, self.payload, format='json')

        response = self.client.delete(
            self.url, {'endpoint': self.payload['endpoint']}, format='json')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            PushSubscription.objects.filter(user=self.user, is_active=True).exists())

    def test_a_client_cannot_register_a_push_endpoint_for_another_user(self):
        """Ownership comes from the request, never from the body."""
        other = make_user('other')

        self.client.post(
            self.url, {**self.payload, 'user': str(other.id)}, format='json')

        subscription = PushSubscription.objects.get(endpoint=self.payload['endpoint'])
        self.assertEqual(subscription.user, self.user)

    def test_subscribing_requires_authentication(self):
        self.client.force_authenticate(None)

        self.assertIn(
            self.client.post(self.url, self.payload, format='json').status_code,
            (401, 403),
        )

    def test_there_is_no_send_endpoint(self):
        """
        docs/07 §10: "no feature may send around" the central service. An HTTP send
        endpoint would be precisely a way to route around it.
        """
        from django.urls import NoReverseMatch
        with self.assertRaises(NoReverseMatch):
            reverse('notification-send')
