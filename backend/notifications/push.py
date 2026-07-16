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

        try:
            webpush(
                subscription_info={
                    'endpoint': subscription.endpoint,
                    'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth},
                },
                data=json.dumps(payload_for(notification)),
                vapid_private_key=private_key,
                vapid_claims={
                    'sub': f'mailto:{getattr(settings, "VAPID_ADMIN_EMAIL", "")}',
                },
            )
        except WebPushException as exc:
            status = getattr(getattr(exc, 'response', None), 'status_code', None)
            if status in (404, 410):
                from .services import retire_subscription
                retire_subscription(subscription)
                raise PushSubscriptionGone(subscription.endpoint) from exc
            raise PushDeliveryError(str(exc)) from exc

        return True


def push_backend():
    """The configured backend. Resolved per call so tests can override settings."""
    path = getattr(
        settings, 'NOTIFICATIONS_PUSH_BACKEND',
        'notifications.push.LoggingPushBackend',
    )
    return import_string(path)()
