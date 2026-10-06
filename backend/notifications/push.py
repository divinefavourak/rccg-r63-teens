"""
Push transport.

Delivery is a *transport* concern, kept behind an interface so the rules that
matter — consent, quiet hours, the announcement cap — live in one place
(`services.py`) and cannot be re-implemented per channel. Swapping WebPush for
FCM later must not touch a single policy decision.

The default backend logs rather than delivers. Real WebPush needs a VAPID key
pair configured in the environment, which is an ops task, not a code one; until
`NOTIFICATIONS_PUSH_BACKEND` names a real backend, the product behaves correctly
in every respect except the interruption itself — inbox rows are written,
preferences honoured, dedupe enforced. That is the honest failure mode: a missing
key silently degrades push, it does not silently drop messages.

To enable real delivery, install `pywebpush`, set `VAPID_PRIVATE_KEY` /
`VAPID_PUBLIC_KEY` / `VAPID_ADMIN_EMAIL`, and point
`NOTIFICATIONS_PUSH_BACKEND` at `notifications.push.WebPushBackend`.

The native app has its own pair of backends further down, chosen by
`NOTIFICATIONS_DEVICE_PUSH_BACKEND`. Point it at
`notifications.push.ExpoPushBackend` to deliver to phones.
"""
import json
import logging

from django.conf import settings
from django.utils.module_loading import import_string

logger = logging.getLogger(__name__)


class PushDeliveryError(Exception):
    """Delivery failed but the endpoint may still be good — worth retrying."""


class PushSubscriptionGone(Exception):
    """The endpoint is dead (HTTP 404/410). Retire it; never retry."""


def payload_for(notification):
    """The JSON a service worker receives. One shape, every backend."""
    return {
        'title': notification.title,
        'body': notification.body,
        'url': notification.deep_link,
        'type': notification.notification_type,
        'id': str(notification.id),
        'data': notification.data,
    }


class BasePushBackend:
    def send(self, subscription, notification):
        raise NotImplementedError


class LoggingPushBackend(BasePushBackend):
    """The default. Records what *would* have been sent."""

    def send(self, subscription, notification):
        logger.info(
            'PUSH -> %s: %s',
            subscription.endpoint[:60],
            json.dumps(payload_for(notification)),
        )
        return True


class WebPushBackend(BasePushBackend):
    """
    Real PWA delivery via VAPID WebPush.

    A 404 or 410 from the push service means the browser threw the subscription
    away (cleared data, uninstalled the PWA). That is not an error to retry — it
    is an instruction to forget the endpoint, which is why it raises a distinct
    exception the caller retires the row on.
    """

    def send(self, subscription, notification):
        try:
            from pywebpush import WebPushException, webpush
        except ImportError as exc:
            raise PushDeliveryError(
                'pywebpush is not installed; cannot use WebPushBackend.'
            ) from exc

        private_key = getattr(settings, 'VAPID_PRIVATE_KEY', None)
        if not private_key:
            raise PushDeliveryError('VAPID_PRIVATE_KEY is not configured.')
        # The push services require a contact address in every request. Without
        # one the library fails deep inside signing with "Missing 'sub' from
        # claims", which says nothing about which setting to fix.
        admin_email = getattr(settings, 'VAPID_ADMIN_EMAIL', '')
        if not admin_email:
            raise PushDeliveryError('VAPID_ADMIN_EMAIL is not configured.')

        try:
            webpush(
                subscription_info={
                    'endpoint': subscription.endpoint,
                    'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth},
                },
                data=json.dumps(payload_for(notification)),
                vapid_private_key=private_key,
                vapid_claims={'sub': f'mailto:{admin_email}'},
            )
        except WebPushException as exc:
            status = getattr(getattr(exc, 'response', None), 'status_code', None)
            if status in (404, 410):
                from .services import retire_subscription
                retire_subscription(subscription)
                raise PushSubscriptionGone(subscription.endpoint) from exc
            raise PushDeliveryError(str(exc)) from exc

        return True


# ---------------------------------------------------------------------------
# Native app (Expo)
# ---------------------------------------------------------------------------

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'


class PushDeviceGone(Exception):
    """The app was uninstalled or its token rotated. Retire it; never retry."""


def expo_message_for(device, notification):
    """What Expo's push service is asked to deliver to one phone."""
    payload = payload_for(notification)
    return {
        'to': device.token,
        'title': payload['title'],
        'body': payload['body'],
        'sound': 'default',
        # Android posts into this channel; the app creates it on first launch.
        'channelId': 'default',
        # Only what the app needs to route the tap. Kept small: the inbox row,
        # fetched by id, is the full message.
        'data': {'id': payload['id'], 'url': payload['url'], 'type': payload['type']},
    }


class BaseDevicePushBackend:
    def send(self, device, notification):
        raise NotImplementedError


class LoggingDevicePushBackend(BaseDevicePushBackend):
    """The default. Records what *would* have been sent to the phone."""

    def send(self, device, notification):
        logger.info(
            'DEVICE PUSH -> %s: %s',
            device.token[:32],
            json.dumps(expo_message_for(device, notification)),
        )
        return True


class ExpoPushBackend(BaseDevicePushBackend):
    """
    Real delivery to the native app through Expo's push service, which forwards
    to APNs and FCM so the server holds neither set of credentials.

    Expo answers 200 even when a single message fails, with the failure in the
    ticket. `DeviceNotRegistered` is the phone's equivalent of WebPush's 410: the
    app is gone, so the token is retired instead of being retried for ever.
    """

    timeout = 10

    def send(self, device, notification):
        import requests

        headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
        access_token = getattr(settings, 'EXPO_ACCESS_TOKEN', None)
        if access_token:
            headers['Authorization'] = f'Bearer {access_token}'

        try:
            response = requests.post(
                EXPO_PUSH_URL,
                json=expo_message_for(device, notification),
                headers=headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
            ticket = response.json().get('data') or {}
        except (requests.RequestException, ValueError) as exc:
            raise PushDeliveryError(str(exc)) from exc

        # A single message comes back as one ticket; tolerate the list form too.
        if isinstance(ticket, list):
            ticket = ticket[0] if ticket else {}

        if ticket.get('status') == 'ok':
            return True

        error = (ticket.get('details') or {}).get('error')
        if error == 'DeviceNotRegistered':
            from .services import retire_device
            retire_device(device)
            raise PushDeviceGone(device.token)
        raise PushDeliveryError(ticket.get('message') or error or 'Expo rejected the push.')


def device_push_backend():
    """The configured native-app backend. Resolved per call, as `push_backend` is."""
    path = getattr(
        settings, 'NOTIFICATIONS_DEVICE_PUSH_BACKEND',
        'notifications.push.LoggingDevicePushBackend',
    )
    return import_string(path)()


def push_backend():
    """The configured backend. Resolved per call so tests can override settings."""
    path = getattr(
        settings, 'NOTIFICATIONS_PUSH_BACKEND',
        'notifications.push.LoggingPushBackend',
    )
    return import_string(path)()
