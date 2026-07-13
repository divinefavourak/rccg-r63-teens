"""Model-level guarantees for the Progress domain."""
import datetime

from django.test import TestCase

from progress.models import ActionType, SpiritualAction, StreakState

from .base import make_user


class SpiritualActionModelTests(TestCase):
    def setUp(self):
        self.user = make_user()

    def test_occurred_at_is_stamped_automatically(self):
        action = SpiritualAction.objects.create(
            user=self.user,
            action_type=ActionType.CHAPTER_READ,
            occurred_on=datetime.date(2026, 7, 13),
        )
        self.assertIsNotNone(action.occurred_at)

    def test_stream_is_ordered_newest_first(self):
        older = SpiritualAction.objects.create(
            user=self.user, action_type=ActionType.CHAPTER_READ,
            occurred_on=datetime.date(2026, 7, 12),
        )
        # Push its timestamp back explicitly: `auto_now_add` can tie on Windows'
        # coarse (~15ms) clock, and the assertion is about ordering, not speed.
        SpiritualAction.objects.filter(pk=older.pk).update(
            occurred_at=older.occurred_at - datetime.timedelta(minutes=1)
        )
        SpiritualAction.objects.create(
            user=self.user, action_type=ActionType.DEVOTIONAL_COMPLETED,
            occurred_on=datetime.date(2026, 7, 13),
        )
        newest = SpiritualAction.objects.filter(user=self.user).first()
        self.assertEqual(ActionType.DEVOTIONAL_COMPLETED, newest.action_type)

    def test_multiple_actions_allowed_on_the_same_day(self):
        for action_type in (ActionType.CHAPTER_READ, ActionType.VERSE_REVIEWED):
            SpiritualAction.objects.create(
                user=self.user, action_type=action_type,
                occurred_on=datetime.date(2026, 7, 13),
            )
        self.assertEqual(2, SpiritualAction.objects.filter(user=self.user).count())


class StreakStateModelTests(TestCase):
    def test_one_streak_state_per_user(self):
        user = make_user()
        StreakState.objects.create(user=user)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            StreakState.objects.create(user=user)
