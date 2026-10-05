"""Tests for native-app push: device registration and the Expo transport."""
from datetime import time
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from notifications import push, services
from notifications.models import NotificationType, PushDevice

User = get_user_model()

TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'
# Midday, so quiet hours never decide the outcome of a delivery test.
NOON = time(12, 0)
NIGHT = time(23, 0)


def make_user(username='teen'):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x')


class DeviceAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.client.force_authenticate(self.user)
        self.url = reverse('notification-devices')

    def test_registers_a_phone(self):
        response = self.client.post(
            self.url, {'token': TOKEN, 'platform': 'android'}, format='json')

        self.assertEqual(response.status_code, 201)
        device = PushDevice.objects.get(token=TOKEN)
        self.assertEqual(device.user, self.user)
        self.assertEqual(device.platform, 'android')
        self.assertTrue(device.is_active)

    def test_registering_twice_keeps_one_row(self):
        """The app reports its token on every launch."""
        for _ in range(2):
            response = self.client.post(self.url, {'token': TOKEN}, format='json')
            self.assertEqual(response.status_code, 201)

        self.assertEqual(PushDevice.objects.filter(token=TOKEN).count(), 1)

    def test_a_shared_phone_moves_to_whoever_signs_in(self):
        """It must not keep buzzing with the first teen's notifications."""
        services.register_device(make_user('sibling'), TOKEN)

        self.client.post(self.url, {'token': TOKEN}, format='json')

        self.assertEqual(PushDevice.objects.get(token=TOKEN).user, self.user)

    def test_rejects_something_that_is_not_an_expo_token(self):
        response = self.client.post(self.url, {'token': 'hello'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(PushDevice.objects.exists())

    def test_signing_out_silences_the_phone(self):
        services.register_device(self.user, TOKEN)

        response = self.client.delete(self.url, {'token': TOKEN}, format='json')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(PushDevice.objects.get(token=TOKEN).is_active)

    def test_cannot_silence_someone_elses_phone(self):
        services.register_device(make_user('other'), TOKEN)

        self.client.delete(self.url, {'token': TOKEN}, format='json')

        self.assertTrue(PushDevice.objects.get(token=TOKEN).is_active)

    def test_requires_sign_in(self):
        self.client.force_authenticate(None)

        response = self.client.post(self.url, {'token': TOKEN}, format='json')

        self.assertEqual(response.status_code, 401)


class DeviceDeliveryTests(TestCase):

    def setUp(self):
        self.user = make_user()

    def test_a_phone_alone_is_enough_to_push(self):
        """Before devices existed, no browser subscription meant no push at all."""
        allowed, reason = services.may_push(self.user, NotificationType.SYSTEM, at=NOON)
        self.assertEqual((allowed, reason), (False, 'no_subscription'))

        services.register_device(self.user, TOKEN)

        allowed, _ = services.may_push(self.user, NotificationType.SYSTEM, at=NOON)
        self.assertTrue(allowed)

    def test_send_reaches_the_phone_and_records_it(self):
        device = services.register_device(self.user, TOKEN)

        with mock.patch.object(push.LoggingDevicePushBackend, 'send', return_value=True) as sent:
            notification = services.send(
                self.user, NotificationType.SYSTEM, 'Hi', 'There', at=NOON)

        sent.assert_called_once()
        self.assertIsNotNone(notification.pushed_at)
        device.refresh_from_db()
        self.assertIsNotNone(device.last_used_at)

    def test_quiet_hours_still_apply_to_phones(self):
        services.register_device(self.user, TOKEN)

        with mock.patch.object(push.LoggingDevicePushBackend, 'send') as sent:
            notification = services.send(
                self.user, NotificationType.SYSTEM, 'Hi', 'There',
                at=NIGHT)

        sent.assert_not_called()
        self.assertIsNone(notification.pushed_at)
        self.assertEqual(notification.data['suppressed'], 'quiet_hours')

    def test_a_failing_phone_never_fails_the_sender(self):
        services.register_device(self.user, TOKEN)

        with mock.patch.object(
                push.LoggingDevicePushBackend, 'send', side_effect=push.PushDeliveryError('x')):
            notification = services.send(
                self.user, NotificationType.SYSTEM, 'Hi', 'There', at=NOON)

        # The inbox row is the durable record; only the interruption was lost.
        self.assertIsNotNone(notification)
        self.assertIsNone(notification.pushed_at)


@override_settings(NOTIFICATIONS_DEVICE_PUSH_BACKEND='notifications.push.ExpoPushBackend')
class ExpoBackendTests(TestCase):

    def setUp(self):
        self.user = make_user()
        self.device = services.register_device(self.user, TOKEN, platform='ios')
        self.notification = services.send(
            self.user, NotificationType.EVENT, 'Camp moved', 'Now Saturday',
            deep_link='/events/abc', at=NIGHT)

    def _response(self, payload):
        response = mock.Mock()
        response.json.return_value = payload
        response.raise_for_status.return_value = None
        return response

    def test_posts_the_message_expo_expects(self):
        with mock.patch('requests.post',
                        return_value=self._response({'data': {'status': 'ok'}})) as post:
            push.ExpoPushBackend().send(self.device, self.notification)

        message = post.call_args.kwargs['json']
        self.assertEqual(message['to'], TOKEN)
        self.assertEqual(message['title'], 'Camp moved')
        self.assertEqual(message['data']['url'], '/events/abc')
        self.assertEqual(message['data']['id'], str(self.notification.id))

    def test_an_uninstalled_app_is_retired_not_retried(self):
        ticket = {'data': {'status': 'error', 'details': {'error': 'DeviceNotRegistered'}}}

        with mock.patch('requests.post', return_value=self._response(ticket)):
            with self.assertRaises(push.PushDeviceGone):
                push.ExpoPushBackend().send(self.device, self.notification)

        self.device.refresh_from_db()
        self.assertFalse(self.device.is_active)
        self.assertIsNotNone(self.device.failed_at)

    def test_other_errors_leave_the_phone_registered(self):
        ticket = {'data': {'status': 'error', 'message': 'MessageRateExceeded',
                           'details': {'error': 'MessageRateExceeded'}}}

        with mock.patch('requests.post', return_value=self._response(ticket)):
            with self.assertRaises(push.PushDeliveryError):
                push.ExpoPushBackend().send(self.device, self.notification)

        self.device.refresh_from_db()
        self.assertTrue(self.device.is_active)
