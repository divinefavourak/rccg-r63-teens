"""Tests for `common.scheduler`: the beat schedule driven by an outside timer."""
from datetime import datetime, timedelta
from unittest import mock
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse

from common import scheduler

LAGOS = ZoneInfo('Africa/Lagos')
LOCAL_CACHE = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

LADDER = 'notifications.tasks.dispatch_habit_ladder'
CLOSE_OUT = 'notifications.tasks.close_out_reminder_day'
EVENT_REMINDERS = 'events.tasks.send_event_reminders'


def lagos(hour, minute):
    return datetime(2026, 10, 12, hour, minute, tzinfo=LAGOS)


class DueTaskTests(TestCase):

    def test_the_ladder_is_due_on_every_five_minute_mark(self):
        self.assertIn(LADDER, scheduler.due_tasks(lagos(14, 0), lagos(14, 5)))

    def test_nothing_daily_is_due_in_an_ordinary_window(self):
        due = scheduler.due_tasks(lagos(14, 0), lagos(14, 5))

        self.assertNotIn(CLOSE_OUT, due)
        self.assertNotIn(EVENT_REMINDERS, due)

    def test_a_daily_task_is_due_in_the_window_its_time_falls_in(self):
        self.assertIn(CLOSE_OUT, scheduler.due_tasks(lagos(21, 58), lagos(22, 3)))

    def test_a_task_on_the_boundary_belongs_to_one_window_only(self):
        """22:00 is the end of one window and the start of the next."""
        self.assertIn(CLOSE_OUT, scheduler.due_tasks(lagos(21, 55), lagos(22, 0)))
        self.assertNotIn(CLOSE_OUT, scheduler.due_tasks(lagos(22, 0), lagos(22, 5)))

    def test_a_late_call_still_catches_what_it_missed(self):
        """The timer skipped 09:00; the 09:20 call covers it."""
        self.assertIn(EVENT_REMINDERS, scheduler.due_tasks(lagos(8, 55), lagos(9, 20)))

    def test_times_are_read_in_the_schedules_own_timezone(self):
        """22:00 in Lagos is 21:00 UTC."""
        utc = ZoneInfo('UTC')
        start = datetime(2026, 10, 12, 20, 58, tzinfo=utc)

        self.assertIn(CLOSE_OUT, scheduler.due_tasks(start, start + timedelta(minutes=5)))


@override_settings(CACHES=LOCAL_CACHE)
class WindowTests(TestCase):

    def setUp(self):
        cache.clear()

    def test_the_first_call_covers_one_interval(self):
        start, end = scheduler.open_window(lagos(14, 5))

        self.assertEqual(end - start, timedelta(minutes=5))

    def test_the_next_call_starts_where_the_last_one_finished(self):
        scheduler.close_window(lagos(14, 5))

        start, end = scheduler.open_window(lagos(14, 17))

        self.assertEqual(start, lagos(14, 5))
        self.assertEqual(end, lagos(14, 17))

    def test_a_call_that_never_finished_is_covered_by_the_next(self):
        """The process died mid-run: its window was opened and never closed."""
        scheduler.close_window(lagos(8, 55))
        scheduler.open_window(lagos(9, 0))

        start, _ = scheduler.open_window(lagos(9, 5))

        self.assertEqual(start, lagos(8, 55))

    def test_a_long_silence_is_not_replayed_in_full(self):
        scheduler.close_window(lagos(1, 0))

        start, end = scheduler.open_window(lagos(14, 0))

        self.assertEqual(end - start, timedelta(minutes=scheduler.MAX_WINDOW_MINUTES))


class RunTests(TestCase):

    def test_the_ladder_gets_the_window_capped(self):
        with mock.patch('notifications.ladder.dispatch', return_value=3) as dispatch:
            results = scheduler.run({LADDER: lagos(14, 5)}, window_minutes=120)

        dispatch.assert_called_once_with(
            window_minutes=scheduler.MAX_LADDER_WINDOW_MINUTES)
        self.assertEqual(results, {LADDER: '3 sent'})

    def test_one_failure_does_not_stop_the_rest(self):
        with mock.patch('notifications.ladder.dispatch', side_effect=RuntimeError('boom')), \
                mock.patch('events.tasks.send_event_reminders.apply') as apply:
            apply.return_value.failed.return_value = False
            results = scheduler.run(
                {LADDER: lagos(9, 0), EVENT_REMINDERS: lagos(9, 0)}, window_minutes=5)

        self.assertEqual(results, {LADDER: 'failed', EVENT_REMINDERS: 'ok'})

    def test_a_late_close_out_is_told_which_day_it_was_for(self):
        """22:00 on the 12th, run after midnight, still closes the 12th."""
        with mock.patch('notifications.tasks.close_out_reminder_day.apply') as apply:
            apply.return_value.failed.return_value = False
            scheduler.run({CLOSE_OUT: lagos(22, 0)}, window_minutes=150)

        self.assertEqual(apply.call_args.kwargs['kwargs'], {'on': '2026-10-12'})


@override_settings(CACHES=LOCAL_CACHE)
class TickViewTests(TestCase):

    def setUp(self):
        cache.clear()
        self.url = reverse('scheduler-tick')

    def test_is_not_there_until_a_secret_is_set(self):
        with override_settings(SCHEDULER_SECRET=''):
            self.assertEqual(self.client.post(self.url).status_code, 404)

    @override_settings(SCHEDULER_SECRET='s3cret')
    def test_refuses_a_caller_without_the_secret(self):
        self.assertEqual(self.client.post(self.url).status_code, 403)
        wrong = self.client.post(self.url, HTTP_AUTHORIZATION='Bearer nope')
        self.assertEqual(wrong.status_code, 403)

    @override_settings(SCHEDULER_SECRET='s3cret')
    def test_only_answers_a_post(self):
        response = self.client.get(self.url, HTTP_AUTHORIZATION='Bearer s3cret')

        self.assertEqual(response.status_code, 405)

    @override_settings(SCHEDULER_SECRET='s3cret')
    def test_runs_what_is_due_and_says_so(self):
        due = {LADDER: lagos(14, 5)}
        with mock.patch.object(scheduler, 'due_tasks', return_value=due), \
                mock.patch.object(scheduler, '_run_in_background') as background:
            try:
                response = self.client.post(self.url, HTTP_AUTHORIZATION='Bearer s3cret')
            finally:
                # The stand-in never runs, so it never lets the lock go.
                scheduler._running.release()

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['due'], [LADDER])
        background.assert_called_once()
        self.assertEqual(background.call_args.args[0], due)

    @override_settings(SCHEDULER_SECRET='s3cret')
    def test_a_call_with_nothing_due_moves_the_window_on(self):
        with mock.patch.object(scheduler, 'due_tasks', return_value={}):
            self.client.post(self.url, HTTP_AUTHORIZATION='Bearer s3cret')

        self.assertIsNotNone(cache.get(scheduler.LAST_TICK_KEY))
        self.assertTrue(scheduler._running.acquire(blocking=False))
        scheduler._running.release()

    @override_settings(SCHEDULER_SECRET='s3cret')
    def test_a_call_during_a_run_does_not_start_another(self):
        scheduler._running.acquire()
        try:
            with mock.patch.object(scheduler, '_run_in_background') as background:
                response = self.client.post(self.url, HTTP_AUTHORIZATION='Bearer s3cret')
        finally:
            scheduler._running.release()

        self.assertEqual(response.json(), {'due': [], 'busy': True})
        background.assert_not_called()
