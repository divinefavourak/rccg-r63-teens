"""
Tests for the central notification service.

The service exists to *refuse* things — quiet hours, muted types, the
announcement cap, duplicate sends. Most of these tests assert a refusal.
"""
from datetime import time
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from notifications import services
from notifications.models import (
    Intensity, LadderRung, Notification, NotificationPreference, NotificationType,
    PushSubscription,
)

User = get_user_model()


def make_user(username='teen'):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x')


def subscribe(user, endpoint='https://push.example/abc'):
    return services.subscribe(user, endpoint=endpoint, p256dh='key', auth='auth')


class QuietHoursTests(TestCase):
    """The overnight wrap is the bug this class exists to prevent."""

    def setUp(self):
        self.preference = NotificationPreference(
            quiet_hours_start=time(21, 30), quiet_hours_end=time(6, 0),
        )

    def test_late_evening_is_quiet(self):
        self.assertTrue(self.preference.in_quiet_hours(time(22, 0)))

    def test_after_midnight_is_quiet(self):
        """
        The naive `start <= t <= end` check returns False here — for 00:30, and for
        every other hour of the night quiet hours exist to protect.
        """
        self.assertTrue(self.preference.in_quiet_hours(time(0, 30)))
        self.assertTrue(self.preference.in_quiet_hours(time(3, 0)))
        self.assertTrue(self.preference.in_quiet_hours(time(5, 59)))

    def test_daytime_is_not_quiet(self):
        for at in [time(6, 0), time(6, 30), time(13, 30), time(20, 45), time(21, 29)]:
            self.assertFalse(self.preference.in_quiet_hours(at), at)

    def test_the_final_rung_sits_before_quiet_hours(self):
        """docs/12: "always before quiet hours" — 20:45 against a 21:30 start."""
        preference = NotificationPreference()
        self.assertFalse(preference.in_quiet_hours(preference.final_at))

    def test_a_same_day_window_still_works(self):
        preference = NotificationPreference(
            quiet_hours_start=time(1, 0), quiet_hours_end=time(6, 0))

        self.assertTrue(preference.in_quiet_hours(time(3, 0)))
        self.assertFalse(preference.in_quiet_hours(time(22, 0)))


class ActiveRungTests(TestCase):

    def test_the_presets_fire_the_documented_rungs(self):
        preference = NotificationPreference()

        preference.intensity = Intensity.GENTLE
        self.assertEqual(preference.active_rungs(), [LadderRung.MORNING])

        preference.intensity = Intensity.STANDARD
        self.assertEqual(preference.active_rungs(),
                         [LadderRung.MORNING, LadderRung.EVENING])

        preference.intensity = Intensity.COMMITTED
        self.assertEqual(len(preference.active_rungs()), 4)

    def test_standard_is_the_default(self):
        self.assertEqual(NotificationPreference().intensity, Intensity.STANDARD)

    def test_a_rung_toggle_narrows_the_preset(self):
        preference = NotificationPreference(intensity=Intensity.STANDARD)
        preference.evening_rung_enabled = False

        self.assertEqual(preference.active_rungs(), [LadderRung.MORNING])

    def test_a_rung_toggle_cannot_widen_the_preset(self):
        """
        "The app never chooses for them upward" (docs/12). A teen on Gentle with the
        evening rung toggled on is still on Gentle — otherwise the preset would
        stop meaning anything.
        """
        preference = NotificationPreference(intensity=Intensity.GENTLE)
        preference.evening_rung_enabled = True
        preference.final_rung_enabled = True

        self.assertEqual(preference.active_rungs(), [LadderRung.MORNING])


class SendTests(TestCase):

    def setUp(self):
        self.user = make_user()
        subscribe(self.user)

    def test_a_send_writes_the_inbox_row_and_pushes(self):
        notification = services.send(
            self.user, NotificationType.SYSTEM, 'Hello', 'Body.')

        self.assertIsNotNone(notification)
        self.assertIsNotNone(notification.pushed_at)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)

    def test_a_muted_type_still_reaches_the_inbox_but_does_not_push(self):
        """
        Suppression means "no interruption", not "no message". The inbox is
        passive; dropping the row would mean a teen who opens the app never learns
        what happened.
        """
        preference = services.preferences_for(self.user)
        preference.announcements_enabled = False
        preference.save()

        notification = services.send(
            self.user, NotificationType.ANNOUNCEMENT, 'Camp', 'Registration open.')

        self.assertIsNotNone(notification)
        self.assertIsNone(notification.pushed_at)
        self.assertEqual(notification.data['suppressed'], 'type_muted')

    def test_a_user_with_no_subscription_still_gets_the_inbox_row(self):
        user = make_user('nosub')

        notification = services.send(user, NotificationType.SYSTEM, 'Hi', 'Body.')

        self.assertIsNotNone(notification)
        self.assertIsNone(notification.pushed_at)
        self.assertEqual(notification.data['suppressed'], 'no_subscription')

    def test_dedupe_key_makes_a_repeat_send_a_no_op(self):
        """The scheduler can fire twice; the teen must be buzzed once."""
        first = services.send(
            self.user, NotificationType.HABIT_REMINDER, 'Morning', 'Ready.',
            dedupe_key='habit:2026-07-14:morning')
        second = services.send(
            self.user, NotificationType.HABIT_REMINDER, 'Morning', 'Ready.',
            dedupe_key='habit:2026-07-14:morning')

        self.assertIsNotNone(first)
        self.assertIsNone(second)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)

    def test_the_same_dedupe_key_for_a_different_user_is_not_a_duplicate(self):
        other = make_user('other')

        services.send(self.user, NotificationType.HABIT_REMINDER, 'M', 'B',
                      dedupe_key='habit:2026-07-14:morning')
        second = services.send(other, NotificationType.HABIT_REMINDER, 'M', 'B',
                               dedupe_key='habit:2026-07-14:morning')

        self.assertIsNotNone(second)

    def test_a_dead_push_endpoint_does_not_fail_the_send(self):
        """The inbox row is the durable record; a broken browser must not lose it."""
        with mock.patch('notifications.push.LoggingPushBackend.send',
                        side_effect=Exception('endpoint exploded')):
            notification = services.send(
                self.user, NotificationType.SYSTEM, 'Hi', 'Body.')

        self.assertIsNotNone(notification)
        self.assertIsNone(notification.pushed_at)

    def test_one_dead_endpoint_does_not_stop_the_other_devices(self):
        subscribe(self.user, endpoint='https://push.example/second')
        calls = []

        def flaky(subscription, notification):
            calls.append(subscription.endpoint)
            if subscription.endpoint.endswith('abc'):
                raise Exception('dead')
            return True

        with mock.patch('notifications.push.LoggingPushBackend.send', flaky):
            notification = services.send(
                self.user, NotificationType.SYSTEM, 'Hi', 'Body.')

        self.assertEqual(len(calls), 2)
        self.assertIsNotNone(notification.pushed_at)   # the live device got it


class QuietHoursSendTests(TestCase):

    def setUp(self):
        self.user = make_user()
        subscribe(self.user)

    def _send_at(self, hour, minute, notification_type):
        at = time(hour, minute)
        with mock.patch.object(
            services, '_local_now',
            return_value=mock.Mock(time=lambda: at),
        ):
            return services.send(self.user, notification_type, 'T', 'B')

    def test_a_habit_reminder_inside_quiet_hours_does_not_push(self):
        notification = self._send_at(23, 0, NotificationType.HABIT_REMINDER)

        self.assertIsNone(notification.pushed_at)
        self.assertEqual(notification.data['suppressed'], 'quiet_hours')

    def test_a_transactional_message_may_interrupt_during_quiet_hours(self):
        """A teen who just paid for a ticket is waiting for the ticket."""
        notification = self._send_at(23, 0, NotificationType.TRANSACTIONAL)

        self.assertIsNotNone(notification.pushed_at)

    def test_a_habit_reminder_outside_quiet_hours_pushes(self):
        notification = self._send_at(6, 30, NotificationType.HABIT_REMINDER)

        self.assertIsNotNone(notification.pushed_at)


class AnnouncementCapTests(TestCase):
    """docs/07 §10, §17: "never more than one announcement push per day"."""

    def setUp(self):
        self.user = make_user()
        subscribe(self.user)

    def test_the_first_announcement_of_the_day_pushes(self):
        notification = services.send(
            self.user, NotificationType.ANNOUNCEMENT, 'Camp', 'Open.')

        self.assertIsNotNone(notification.pushed_at)

    def test_the_second_announcement_of_the_day_is_inbox_only(self):
        services.send(self.user, NotificationType.ANNOUNCEMENT, 'Camp', 'Open.')

        second = services.send(
            self.user, NotificationType.ANNOUNCEMENT, 'Choir', 'Rehearsal moved.')

        self.assertIsNotNone(second)                       # still delivered
        self.assertIsNone(second.pushed_at)                # but does not buzz
        self.assertEqual(second.data['suppressed'], 'announcement_cap')

    def test_the_cap_does_not_affect_other_types(self):
        services.send(self.user, NotificationType.ANNOUNCEMENT, 'Camp', 'Open.')

        event = services.send(self.user, NotificationType.EVENT, 'Event', 'Moved.')

        self.assertIsNotNone(event.pushed_at)


class StepDownTests(TestCase):
    """docs/12: "7 consecutive days of ignored reminders auto-steps intensity down"."""

    def setUp(self):
        self.user = make_user()
        subscribe(self.user)

    def test_six_ignored_days_do_not_step_down(self):
        for _ in range(6):
            services.record_reminder_ignored(self.user)

        preference = services.preferences_for(self.user)
        self.assertEqual(preference.intensity, Intensity.STANDARD)
        self.assertEqual(preference.consecutive_ignored_days, 6)

    def test_seven_ignored_days_step_down_one_level(self):
        for _ in range(7):
            services.record_reminder_ignored(self.user)

        preference = services.preferences_for(self.user)
        self.assertEqual(preference.intensity, Intensity.GENTLE)
        self.assertEqual(preference.consecutive_ignored_days, 0)
        self.assertIsNotNone(preference.last_stepped_down_at)

    def test_a_step_down_tells_the_teen(self):
        """"with a transparent in-app note" — the teen is told, not managed."""
        for _ in range(7):
            services.record_reminder_ignored(self.user)

        note = Notification.objects.filter(
            user=self.user, notification_type=NotificationType.SYSTEM).first()
        self.assertIsNotNone(note)
        self.assertIn('quieted things down', note.title)
        self.assertEqual(note.data['stepped_to'], Intensity.GENTLE)

    def test_completing_the_devotional_resets_the_ignored_run(self):
        for _ in range(5):
            services.record_reminder_ignored(self.user)

        services.record_reminder_answered(self.user)

        self.assertEqual(
            services.preferences_for(self.user).consecutive_ignored_days, 0)

    def test_gentle_is_the_floor_and_does_not_step_down_to_silence(self):
        """A teen who asked for reminders keeps one."""
        preference = services.preferences_for(self.user)
        preference.intensity = Intensity.GENTLE
        preference.save()

        for _ in range(7):
            services.record_reminder_ignored(self.user)

        preference.refresh_from_db()
        self.assertEqual(preference.intensity, Intensity.GENTLE)

    def test_committed_steps_down_to_standard_then_gentle(self):
        preference = services.preferences_for(self.user)
        preference.intensity = Intensity.COMMITTED
        preference.save()

        for _ in range(7):
            services.record_reminder_ignored(self.user)
        preference.refresh_from_db()
        self.assertEqual(preference.intensity, Intensity.STANDARD)

        for _ in range(7):
            services.record_reminder_ignored(self.user)
        preference.refresh_from_db()
        self.assertEqual(preference.intensity, Intensity.GENTLE)


class SubscriptionTests(TestCase):

    def test_resubscribing_the_same_endpoint_upserts(self):
        """A service-worker update re-subscribes; the teen must not buzz twice."""
        user = make_user()
        subscribe(user)
        subscribe(user)

        self.assertEqual(PushSubscription.objects.filter(user=user).count(), 1)

    def test_an_endpoint_moves_to_the_teen_who_signed_in_last(self):
        """
        A shared device. The endpoint belongs to the browser, not the account — if
        it stayed with the first user, the second teen's notifications would fan
        out to a device the first teen is holding.
        """
        first, second = make_user('first'), make_user('second')
        subscribe(first, endpoint='https://push.example/shared')

        subscribe(second, endpoint='https://push.example/shared')

        self.assertEqual(PushSubscription.objects.count(), 1)
        self.assertEqual(
            PushSubscription.objects.get(endpoint='https://push.example/shared').user,
            second,
        )

    def test_unsubscribe_deactivates(self):
        user = make_user()
        subscribe(user)

        services.unsubscribe(user, 'https://push.example/abc')

        self.assertFalse(
            PushSubscription.objects.filter(user=user, is_active=True).exists())


class InboxTests(TestCase):

    def setUp(self):
        self.user = make_user()
        self.other = make_user('other')

    def test_unread_count_and_mark_read(self):
        services.send(self.user, NotificationType.SYSTEM, 'A', 'B')
        services.send(self.user, NotificationType.SYSTEM, 'C', 'D')

        self.assertEqual(services.unread_count(self.user), 2)

        services.mark_read(self.user)

        self.assertEqual(services.unread_count(self.user), 0)

    def test_mark_read_accepts_specific_ids(self):
        first = services.send(self.user, NotificationType.SYSTEM, 'A', 'B')
        services.send(self.user, NotificationType.SYSTEM, 'C', 'D')

        services.mark_read(self.user, notification_ids=[first.id])

        self.assertEqual(services.unread_count(self.user), 1)

    def test_the_inbox_is_owner_scoped(self):
        services.send(self.other, NotificationType.SYSTEM, 'Theirs', 'B')

        self.assertEqual(services.inbox(self.user).count(), 0)
