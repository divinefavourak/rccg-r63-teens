"""
The streak engine, driven through `record_action`.

Days are passed explicitly so the timeline is deterministic; the default
(`user_today`) is covered separately.
"""
import datetime
from unittest import mock

from django.test import TestCase

from progress import services
from progress.models import ActionType, SpiritualAction

from .base import make_user

D = datetime.date


class RecordActionTests(TestCase):
    def setUp(self):
        self.user = make_user()

    def _record(self, day, action_type=ActionType.CHAPTER_READ, **kw):
        return services.record_action(
            self.user, action_type, occurred_on=D(2026, 7, day), **kw
        )

    def test_records_the_action_in_the_stream(self):
        self._record(13, source_reference='bible.chapter:abc')
        action = SpiritualAction.objects.get(user=self.user)
        self.assertEqual(ActionType.CHAPTER_READ, action.action_type)
        self.assertEqual('bible.chapter:abc', action.source_reference)

    def test_unknown_action_type_is_rejected(self):
        with self.assertRaises(ValueError):
            services.record_action(self.user, 'not_a_real_action')

    def test_first_action_starts_a_one_day_streak(self):
        self._record(13)
        state = services.streak_for(self.user)
        self.assertEqual(1, state.current_length)
        self.assertEqual(D(2026, 7, 13), state.started_on)
        self.assertEqual(D(2026, 7, 13), state.last_active_on)

    def test_consecutive_days_extend_the_streak(self):
        for day in (13, 14, 15):
            self._record(day)
        state = services.streak_for(self.user)
        self.assertEqual(3, state.current_length)
        self.assertEqual(D(2026, 7, 13), state.started_on)

    def test_second_action_same_day_does_not_advance_the_streak(self):
        self._record(13, action_type=ActionType.CHAPTER_READ)
        self._record(13, action_type=ActionType.VERSE_REVIEWED)
        state = services.streak_for(self.user)
        self.assertEqual(1, state.current_length)
        self.assertEqual(2, SpiritualAction.objects.filter(user=self.user).count())

    def test_a_gap_resets_the_streak_to_one(self):
        self._record(13)
        self._record(14)
        self._record(17)  # missed 15 and 16
        state = services.streak_for(self.user)
        self.assertEqual(1, state.current_length)
        self.assertEqual(D(2026, 7, 17), state.started_on)

    def test_longest_streak_survives_a_reset(self):
        for day in (13, 14, 15):
            self._record(day)
        self._record(20)  # break
        state = services.streak_for(self.user)
        self.assertEqual(1, state.current_length)
        self.assertEqual(3, state.longest_length)

    def test_backfilled_earlier_day_does_not_rewrite_the_streak(self):
        self._record(15)
        self._record(13)  # arrives late, older day
        state = services.streak_for(self.user)
        self.assertEqual(1, state.current_length)
        self.assertEqual(D(2026, 7, 15), state.last_active_on)

    def test_default_day_is_the_users_local_today(self):
        with mock.patch('progress.services.user_today', return_value=D(2026, 7, 13)):
            services.record_action(self.user, ActionType.DEVOTIONAL_COMPLETED)
        action = SpiritualAction.objects.get(user=self.user)
        self.assertEqual(D(2026, 7, 13), action.occurred_on)
