"""
The central notification service.

`docs/07-feature-specifications.md` §10 is unambiguous: "A central notification
service enforces ladder logic, presets, quiet hours, and step-down — **no feature
may send around it.**" So `send()` is the only way a notification reaches a teen,
and every rule the docs impose is applied here rather than trusted to callers:

* **Per-type consent.** A teen who muted announcements gets no announcement push.
* **Quiet hours** (default 21:30–06:00) are absolute — except for transactional
  messages, because a teen who just paid for a ticket is waiting for the ticket.
* **The announcement cap:** "never more than one announcement push per day" (§10,
  §17). The second announcement of a day lands in the inbox silently.
* **Idempotence.** The ladder runs on a scheduler that can fire twice; `dedupe_key`
  makes a double-fire a no-op rather than a double buzz.

**Suppression means "no push", not "no message".** A suppressed notification is
still written to the inbox, because the inbox is passive — it does not interrupt
anyone. Dropping the message entirely would mean a teen who happens to open the
app at 22:00 never learns their event was moved. The only thing quiet hours and
caps take away is the right to *interrupt*.
"""
import logging
import threading

from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from common.dates import app_today, day_bounds

from .models import (
    IGNORED_DAYS_BEFORE_STEP_DOWN, STEP_DOWN, Notification, NotificationPreference,
    NotificationType, PushDevice, PushSubscription,
)
from .push import (
    LoggingDevicePushBackend, LoggingPushBackend, device_push_backend, push_backend,
)

logger = logging.getLogger(__name__)

# The only type that may interrupt during quiet hours. A receipt, a ticket, a
# payment confirmation: the teen performed an action seconds ago and is waiting
# for the result. Everything else can wait until morning.
QUIET_HOURS_EXEMPT = {NotificationType.TRANSACTIONAL}


def preferences_for(user):
    """The user's preferences, created lazily with the documented defaults."""
    preference, _ = NotificationPreference.objects.get_or_create(user=user)
    return preference


def _local_now(preference):
    """`timezone.now()` in the teen's own timezone."""
    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo(preference.timezone)
    except Exception:
        # An invalid stored timezone must not stop a notification. Fall back to
        # the app default rather than raising into whatever feature called send().
        logger.warning('Invalid timezone %r for user %s', preference.timezone,
                       preference.user_id)
        return timezone.localtime()
    return timezone.now().astimezone(tz)


def _announcement_cap_spent(user, today):
    """
    Has an announcement already been *pushed* to this user today? (§10, §17)

    Bounded by the app day in Lagos, not by `created_at__date`. That lookup extracts
    the date in `settings.TIME_ZONE`, which is UTC — so it would compare a Lagos date
    against a UTC one and mis-file everything sent in the first hour of a Nigerian
    day, letting a second announcement through the cap.
    """
    start, end = day_bounds(today)
    return Notification.objects.filter(
        user=user,
        notification_type=NotificationType.ANNOUNCEMENT,
        pushed_at__isnull=False,
        created_at__gte=start,
        created_at__lt=end,
    ).exists()


def may_push(user, notification_type, preference=None, at=None, today=None):
    """
    May we *interrupt* this user with this type right now?

    Returns `(allowed, reason)`. The reason is recorded rather than discarded so
    §10's guardrail metrics ("opt-out rate", "% of days resolved at rung 1") have
    something to read, and so a support question — "why didn't I get it?" — has an
    answer.
    """
    preference = preference or preferences_for(user)

    if not preference.type_enabled(notification_type):
        return False, 'type_muted'

    if notification_type not in QUIET_HOURS_EXEMPT:
        local_now = at or _local_now(preference).time()
        if preference.in_quiet_hours(local_now):
            return False, 'quiet_hours'

    if notification_type == NotificationType.ANNOUNCEMENT:
        if _announcement_cap_spent(user, today or app_today()):
            return False, 'announcement_cap'

    if not (
        PushSubscription.objects.filter(user=user, is_active=True).exists()
        or PushDevice.objects.filter(user=user, is_active=True).exists()
    ):
        return False, 'no_subscription'

    return True, ''


def send(user, notification_type, title, body, *, deep_link='', data=None,
         rung='', dedupe_key='', at=None, defer_push=False):
    """
    The one way a notification reaches a teen.

    Always writes the inbox row. Pushes only if `may_push` allows it. Returns the
    `Notification`, or None if `dedupe_key` says this exact message was already
    delivered (the scheduler fired twice).

    `at` is the teen's *local* time to evaluate quiet hours against. Callers that
    know it should pass it — the ladder does, because it dispatches for a specific
    local moment, which is not necessarily the moment the worker happens to run.
    Omitted, it is derived from the clock.

    `defer_push` is for callers inside a web request. The inbox row is written
    here and now; the push, which is a call to another company's server with a
    ten-second timeout per device, goes out after the response. `pushed_at` is
    then set a moment later, so a caller that reads it straight away, or relies
    on the announcement cap, must not defer.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return None

    preference = preferences_for(user)
    allowed, reason = may_push(
        user, notification_type, preference=preference, at=at)

    try:
        with transaction.atomic():
            notification = Notification.objects.create(
                user=user,
                notification_type=notification_type,
                rung=rung,
                title=title,
                body=body,
                deep_link=deep_link,
                data={**(data or {}), **({'suppressed': reason} if reason else {})},
                dedupe_key=dedupe_key,
            )
    except IntegrityError:
        # The unique (user, dedupe_key) constraint fired: this message already
        # exists. A retried worker must be a no-op, not a second buzz.
        logger.info('Duplicate notification suppressed for %s (%s)', user, dedupe_key)
        return None

    if allowed:
        if defer_push:
            # After the caller's transaction commits: the background thread
            # reads the row on its own connection and must be able to see it.
            transaction.on_commit(lambda: _push_in_background(notification.pk))
        else:
            _push(notification)

    return notification


def _push_in_background(notification_id):
    """
    Deliver one notification's push off the request thread.

    A thread, as the event emails already use, so it works whether or not a
    Celery worker is running. If the process dies mid-send the push is lost and
    the inbox row is not: the inbox is the durable record.
    """
    def work():
        try:
            _push(Notification.objects.select_related('user').get(pk=notification_id))
        except Exception:
            logger.exception('Background push failed for notification %s', notification_id)
        finally:
            # The thread opened its own database connection; nothing else will
            # close it.
            connection.close()

    threading.Thread(target=work, daemon=True, name='notification-push').start()


def _push(notification):
    """Fan the notification out to the user's browsers and phones."""
    subscriptions = PushSubscription.objects.filter(
        user=notification.user, is_active=True,
    )
    delivered = False
    # Which kind of device took it. Not stored: `send_test` reads it straight
    # off the object to say what actually got through.
    notification.delivered_via = set()
    for subscription in subscriptions:
        try:
            push_backend().send(subscription, notification)
        except Exception:
            # One dead browser endpoint must not stop the other devices, and must
            # never fail the caller's transaction — the inbox row is already
            # committed and is the durable record.
            logger.exception('Push failed for subscription %s', subscription.id)
            continue
        delivered = True
        notification.delivered_via.add('browser')

    devices = PushDevice.objects.filter(user=notification.user, is_active=True)
    for device in devices:
        try:
            device_push_backend().send(device, notification)
        except Exception:
            # Same rule as above: an uninstalled app is not the caller's problem.
            logger.exception('Push failed for device %s', device.id)
            continue
        PushDevice.objects.filter(pk=device.pk).update(last_used_at=timezone.now())
        delivered = True
        notification.delivered_via.add('phone')

    if delivered:
        notification.pushed_at = timezone.now()
        notification.save(update_fields=['pushed_at', 'updated_at'])
    return delivered


def send_test(user):
    """
    Send this person one notification because they asked for it, and say what
    became of it.

    The answer to "are notifications working on this phone?", which otherwise
    means waiting for a reminder that may never come and guessing why. It goes
    through `send` like everything else, as a transactional message: the person
    tapped a button a second ago and is waiting for the result, which is exactly
    what that type is for, so neither quiet hours nor a muted type hides it.

    Returns `{'sent': bool, 'reason': str}`. The reasons, in the order they are
    ruled out:

    - `not_registered`: no browser or phone of theirs is known to the server.
    - `delivery_failed`: a real push service was asked and none accepted it.
    - `not_switched_on`: it "went", but only to a backend that writes to the
      log. The deployment has not turned real delivery on for what they hold.

    "Sent" means a real push service accepted it. A log line never counts,
    even when it sits beside a real attempt that failed.
    """
    notification = send(
        user,
        NotificationType.TRANSACTIONAL,
        'Notifications are working',
        'This is the test you asked for. Reminders will arrive just like this.',
        deep_link='/settings/notifications',
        data={'test': True},
    )
    if notification is None or notification.data.get('suppressed'):
        return {'sent': False, 'reason': 'not_registered'}

    # Each kind of device this person holds is either served by a real push
    # service or by the backend that only writes to the log.
    holds = {
        'browser': PushSubscription.objects.filter(user=user, is_active=True).exists(),
        'phone': PushDevice.objects.filter(user=user, is_active=True).exists(),
    }
    real = {
        'browser': not isinstance(push_backend(), LoggingPushBackend),
        'phone': not isinstance(device_push_backend(), LoggingDevicePushBackend),
    }
    delivered_via = getattr(notification, 'delivered_via', set())

    if any(real[kind] for kind in delivered_via):
        return {'sent': True, 'reason': ''}
    if any(holds[kind] and real[kind] for kind in holds):
        # A real service was tried for something they hold, and it is not among
        # the ones that took it.
        return {'sent': False, 'reason': 'delivery_failed'}
    if delivered_via:
        return {'sent': False, 'reason': 'not_switched_on'}
    return {'sent': False, 'reason': 'delivery_failed'}


# ---------------------------------------------------------------------------
# Inbox
# ---------------------------------------------------------------------------

def inbox(user):
    return Notification.objects.filter(user=user)


def unread_count(user):
    return Notification.objects.filter(user=user, read_at__isnull=True).count()


def mark_read(user, notification_ids=None):
    """Mark some or all of a user's notifications read. Returns the number changed."""
    queryset = Notification.objects.filter(user=user, read_at__isnull=True)
    if notification_ids is not None:
        queryset = queryset.filter(id__in=notification_ids)
    return queryset.update(read_at=timezone.now())


# ---------------------------------------------------------------------------
# Push subscriptions
# ---------------------------------------------------------------------------

def subscribe(user, endpoint, p256dh, auth, user_agent=''):
    """
    Register (or reclaim) a browser push endpoint.

    `endpoint` is globally unique, so a shared device that a second teen signs in
    on *moves* to them rather than fanning every push out to both. This is a
    safeguarding property as much as a correctness one.
    """
    subscription, _ = PushSubscription.objects.update_or_create(
        endpoint=endpoint,
        defaults={
            'user': user, 'p256dh': p256dh, 'auth': auth,
            'user_agent': user_agent, 'is_active': True, 'failed_at': None,
        },
    )
    return subscription


def unsubscribe(user, endpoint):
    return PushSubscription.objects.filter(user=user, endpoint=endpoint).update(
        is_active=False,
    )


def retire_subscription(subscription):
    """Called when the push service says the endpoint is gone (HTTP 404/410)."""
    subscription.is_active = False
    subscription.failed_at = timezone.now()
    subscription.save(update_fields=['is_active', 'failed_at', 'updated_at'])


# ---------------------------------------------------------------------------
# Phones (the native app)
# ---------------------------------------------------------------------------

def register_device(user, token, platform='', device_name=''):
    """
    Register (or reclaim) a phone's push token.

    An upsert on `token`, so the app can call this on every launch without
    piling up rows, and so a phone a second teen signs in on moves to them.
    """
    device, _ = PushDevice.objects.update_or_create(
        token=token,
        defaults={
            'user': user, 'platform': platform, 'device_name': device_name,
            'is_active': True, 'failed_at': None,
        },
    )
    return device


def unregister_device(user, token):
    """Signing out on a phone: stop sending this account's pushes to it."""
    return PushDevice.objects.filter(user=user, token=token).update(is_active=False)


def retire_device(device):
    """Called when the push service says the app is gone (`DeviceNotRegistered`)."""
    device.is_active = False
    device.failed_at = timezone.now()
    device.save(update_fields=['is_active', 'failed_at', 'updated_at'])


# ---------------------------------------------------------------------------
# Step-down — "software-enforced respect" (docs/12-gamification.md)
# ---------------------------------------------------------------------------

def record_reminder_ignored(user):
    """
    A day passed in which reminders were sent and the devotional was not completed.

    After 7 consecutive such days the intensity steps down one level, with a
    transparent note. "Fatigue is a product failure, not a user failure."
    """
    preference = preferences_for(user)
    preference.consecutive_ignored_days += 1

    if preference.consecutive_ignored_days < IGNORED_DAYS_BEFORE_STEP_DOWN:
        preference.save(update_fields=['consecutive_ignored_days', 'updated_at'])
        return False

    previous = preference.intensity
    stepped = STEP_DOWN[previous]
    preference.consecutive_ignored_days = 0

    if stepped == previous:
        # Already at the floor (Gentle). One morning invitation stays — a teen who
        # asked for reminders keeps one — but the counter resets so we do not
        # re-announce a step-down that did not happen.
        preference.save(update_fields=['consecutive_ignored_days', 'updated_at'])
        return False

    preference.intensity = stepped
    preference.last_stepped_down_at = timezone.now()
    preference.save(update_fields=[
        'intensity', 'consecutive_ignored_days', 'last_stepped_down_at', 'updated_at',
    ])

    # Transparent, and reversible in one tap. The teen is told, not managed.
    send(
        user,
        NotificationType.SYSTEM,
        "We've quieted things down",
        'We noticed our reminders have not been landing, so we have eased off. '
        'You can turn them back up any time.',
        deep_link='/settings/notifications',
        data={'stepped_from': previous, 'stepped_to': stepped},
    )
    return True


def record_reminder_answered(user):
    """The teen completed the devotional — the ignored-day run resets."""
    preference = preferences_for(user)
    if preference.consecutive_ignored_days:
        preference.consecutive_ignored_days = 0
        preference.save(update_fields=['consecutive_ignored_days', 'updated_at'])
