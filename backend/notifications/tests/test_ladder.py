"""
Tests for the habit reminder ladder.

The property under test throughout: **a rung fires only if today's devotional is
still incomplete**, and completing it cancels every remaining rung. Because rungs
are evaluated at fire time rather than queued in advance, "cancellation" is not a
mechanism to test — it is the absence of one, and these tests prove the absence
behaves correctly.
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase

from common.dates import app_today
from content.models import Devotional, MemoryVerse, UserReadLog
from notifications import ladder, services
from notifications.models import (
    Intensity, LadderRung, Notification, NotificationType,
)

User = get_user_model()
LAGOS = ZoneInfo('Africa/Lagos')


def make_user(username='teen'):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x')


def make_devotional(on=None):
    on = on or app_today()
    devotional = Devotional.objects.create(
        date=on, title='Chosen', slug=f'chosen-{on}', content='Body.',
        status=Devotional.Status.PUBLISHED,
    )
    MemoryVerse.objects.create(
        devotional=devotional, is_primary=True,
        reference_display='John 3:16', text_override='For God so loved...',
    )
    return devotional


def at(hour, minute, on=None):
    """A timezone-aware Lagos datetime for `today` at the given wall-clock time."""
    on = on or app_today()
    return datetime.combine(on, time(hour, minute), tzinfo=LAGOS)


def subscribe(user):
    return services.subscribe(
        user, endpoint=f'https://push.example/{user.username}',
        p256dh='k', auth='a')


class DueRungTests(TestCase):

    def setUp(self):
        self.user = make_user()
        self.preference = services.preferences_for(self.user)   # Standard

    def test_a_rung_is_due_in_the_window_that_just_elapsed(self):
        due = ladder.due_rungs(self.preference, at(6, 32), window_minutes=5)

        self.assertEqual(due, [LadderRung.MORNING])   # morning_at = 06:30

    def test_no_rung_is_due_outside_the_window(self):
        self.assertEqual(ladder.due_rungs(self.preference, at(10, 0)), [])

    def test_a_rung_belongs_to_exactly_one_window(self):
        """
        Half-open on the left, closed on the right. A rung sitting exactly on a tick
        boundary must not be both missed by one window and claimed by the next.
        """
        on_boundary = ladder.due_rungs(self.preference, at(6, 30), window_minutes=5)
        next_window = ladder.due_rungs(self.preference, at(6, 35), window_minutes=5)

        self.assertEqual(on_boundary, [LadderRung.MORNING])
        self.assertEqual(next_window, [])

    def test_only_rungs_in_the_preset_are_due(self):
        """Standard = morning + evening. The afternoon rung must never fire."""
        self.assertEqual(ladder.due_rungs(self.preference, at(13, 32)), [])
        self.assertEqual(ladder.due_rungs(self.preference, at(18, 32)),
                         [LadderRung.EVENING])

    def test_committed_fires_all_four(self):
        self.preference.intensity = Intensity.COMMITTED
        self.preference.save()

        for hour, minute, rung in [
            (6, 32, LadderRung.MORNING), (13, 32, LadderRung.AFTERNOON),
            (18, 32, LadderRung.EVENING), (20, 47, LadderRung.FINAL),
        ]:
            self.assertEqual(
                ladder.due_rungs(self.preference, at(hour, minute)), [rung])

    def test_gentle_fires_only_the_morning(self):
        self.preference.intensity = Intensity.GENTLE
        self.preference.save()

        self.assertEqual(ladder.due_rungs(self.preference, at(6, 32)),
                         [LadderRung.MORNING])
        self.assertEqual(ladder.due_rungs(self.preference, at(18, 32)), [])


class DispatchTests(TestCase):

    def setUp(self):
        self.user = make_user()
        subscribe(self.user)
        services.preferences_for(self.user)
        self.devotional = make_devotional()

    def reminders(self):
        return Notification.objects.filter(
            user=self.user, notification_type=NotificationType.HABIT_REMINDER)

    def test_the_morning_rung_is_sent(self):
        sent = ladder.dispatch(now=at(6, 32))

        self.assertEqual(sent, 1)
        reminder = self.reminders().get()
        self.assertEqual(reminder.rung, LadderRung.MORNING)
        self.assertEqual(reminder.title, 'Good morning!')
        self.assertEqual(reminder.body,
                         "Today's devotional and memory verse are ready.")

    def test_the_reminder_carries_todays_devotional_and_verse(self):
        """
        §10: "Reminder copy always references *today's* devotional and verse — the
        notification is part of One Day. One Verse. One Message., not generic
        app-bait."
        """
        ladder.dispatch(now=at(6, 32))

        reminder = self.reminders().get()
        self.assertEqual(reminder.data['devotional_id'], str(self.devotional.id))
        self.assertEqual(reminder.data['memory_verse'], 'John 3:16')
        self.assertEqual(reminder.deep_link, f'/devotionals/{self.devotional.id}')

    def test_completing_the_devotional_cancels_every_remaining_rung(self):
        """The whole point. No cancellation machinery — the rung simply never fires."""
        ladder.dispatch(now=at(6, 32))               # morning goes out
        self.assertEqual(self.reminders().count(), 1)

        UserReadLog.objects.create(user=self.user, devotional=self.devotional)

        ladder.dispatch(now=at(18, 32))              # evening must not
        self.assertEqual(self.reminders().count(), 1)

    def test_a_teen_who_reads_before_the_first_rung_is_never_reminded(self):
        UserReadLog.objects.create(user=self.user, devotional=self.devotional)

        ladder.dispatch(now=at(6, 32))
        ladder.dispatch(now=at(18, 32))

        self.assertEqual(self.reminders().count(), 0)

    def test_an_incomplete_devotional_gets_the_evening_rung_too(self):
        ladder.dispatch(now=at(6, 32))
        ladder.dispatch(now=at(18, 32))

        self.assertEqual(
            sorted(self.reminders().values_list('rung', flat=True)),
            [LadderRung.EVENING, LadderRung.MORNING],
        )

    def test_a_repeated_tick_does_not_double_send(self):
        """The beat can fire twice; the teen must be buzzed once."""
        ladder.dispatch(now=at(6, 32))
        ladder.dispatch(now=at(6, 33))

        self.assertEqual(self.reminders().count(), 1)

    def test_no_devotional_today_means_no_reminder(self):
        """Nagging toward a devotional that does not exist is the purest app-bait."""
        Devotional.objects.all().delete()

        sent = ladder.dispatch(now=at(6, 32))

        self.assertEqual(sent, 0)
        self.assertEqual(self.reminders().count(), 0)

    def test_a_muted_teen_is_not_reminded(self):
        preference = services.preferences_for(self.user)
        preference.habit_reminders_enabled = False
        preference.save()

        ladder.dispatch(now=at(6, 32))

        self.assertEqual(self.reminders().count(), 0)

    def test_one_teens_completion_does_not_silence_another(self):
        other = make_user('other')
        subscribe(other)
        services.preferences_for(other)
        UserReadLog.objects.create(user=self.user, devotional=self.devotional)

        ladder.dispatch(now=at(6, 32))

        self.assertEqual(self.reminders().count(), 0)
        self.assertEqual(
            Notification.objects.filter(
                user=other, notification_type=NotificationType.HABIT_REMINDER).count(),
            1,
        )

    def test_rungs_fire_in_each_teens_own_timezone(self):
        """06:30 must mean *their* morning, not ours."""
        traveller = make_user('traveller')
        subscribe(traveller)
        preference = services.preferences_for(traveller)
        preference.timezone = 'America/New_York'    # UTC-4/5 vs Lagos UTC+1
        preference.save()

        # 06:32 in Lagos is the middle of the night in New York — no rung.
        ladder.dispatch(now=at(6, 32))

        self.assertEqual(
            Notification.objects.filter(user=traveller).count(), 0)


class CloseOutDayTests(TestCase):

    def setUp(self):
        self.user = make_user()
        subscribe(self.user)
        services.preferences_for(self.user)
        self.devotional = make_devotional()

    def test_a_reminded_teen_who_did_not_complete_counts_as_ignored(self):
        ladder.dispatch(now=at(6, 32))

        result = ladder.close_out_day()

        self.assertEqual(result, {'answered': 0, 'ignored': 1})
        self.assertEqual(
            services.preferences_for(self.user).consecutive_ignored_days, 1)

    def test_a_reminded_teen_who_completed_resets_the_run(self):
        preference = services.preferences_for(self.user)
        preference.consecutive_ignored_days = 3
        preference.save()
        ladder.dispatch(now=at(6, 32))
        UserReadLog.objects.create(user=self.user, devotional=self.devotional)

        result = ladder.close_out_day()

        self.assertEqual(result['answered'], 1)
        preference.refresh_from_db()
        self.assertEqual(preference.consecutive_ignored_days, 0)

    def test_a_teen_who_was_never_reminded_is_not_counted_as_ignoring(self):
        """
        A teen cannot ignore a reminder we never sent. Counting that day toward a
        step-down would punish them for our own empty pipeline.
        """
        preference = services.preferences_for(self.user)
        preference.habit_reminders_enabled = False
        preference.save()

        result = ladder.close_out_day()

        self.assertEqual(result, {'answered': 0, 'ignored': 0})
        preference.refresh_from_db()
        self.assertEqual(preference.consecutive_ignored_days, 0)

    def test_seven_ignored_days_step_the_intensity_down(self):
        preference = services.preferences_for(self.user)
        preference.consecutive_ignored_days = 6
        preference.save()
        ladder.dispatch(now=at(6, 32))

        ladder.close_out_day()

        preference.refresh_from_db()
        self.assertEqual(preference.intensity, Intensity.GENTLE)
