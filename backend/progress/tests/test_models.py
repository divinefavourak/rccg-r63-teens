"""Model-level guarantees for the Progress domain."""
import datetime
from unittest import mock

from django.test import TestCase
from django.utils import timezone

from common.models import AppendOnlyError
from progress.models import (
    ActionType, GraceDayLedger, GraceReason, SpiritualAction, StreakState,
)

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
        # Pin distinct creation instants: `auto_now_add` can tie on Windows'
        # coarse (~15ms) clock, and the model is append-only so we can't rewrite
        # occurred_at afterwards — the assertion is about ordering, not speed.
        earlier = timezone.now() - datetime.timedelta(minutes=1)
        with mock.patch('django.utils.timezone.now', return_value=earlier):
            SpiritualAction.objects.create(
                user=self.user, action_type=ActionType.CHAPTER_READ,
                occurred_on=datetime.date(2026, 7, 12),
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


class AppendOnlyEnforcementTests(TestCase):
    """The event stream and the Grace ledger reject edits at the persistence
    boundary — the immutability their docstrings advertise is enforced, not just
    hoped for. Deletion stays open so an account cascade can erase history."""

    def setUp(self):
        self.user = make_user()

    def test_saving_an_existing_action_is_refused(self):
        action = SpiritualAction.objects.create(
            user=self.user, action_type=ActionType.CHAPTER_READ,
            occurred_on=datetime.date(2026, 7, 13),
        )
        action.action_type = ActionType.DEVOTIONAL_COMPLETED
        with self.assertRaises(AppendOnlyError):
            action.save()

    def test_queryset_update_is_refused(self):
        SpiritualAction.objects.create(
            user=self.user, action_type=ActionType.CHAPTER_READ,
            occurred_on=datetime.date(2026, 7, 13),
        )
        with self.assertRaises(AppendOnlyError):
            SpiritualAction.objects.filter(user=self.user).update(source_reference='x')

    def test_ledger_update_is_refused(self):
        GraceDayLedger.objects.create(
            user=self.user, delta=2, reason=GraceReason.MONTHLY_ALLOCATION,
            effective_month=datetime.date(2026, 7, 1),
        )
        with self.assertRaises(AppendOnlyError):
            GraceDayLedger.objects.filter(user=self.user).update(delta=1)

    def test_deletion_is_still_allowed(self):
        SpiritualAction.objects.create(
            user=self.user, action_type=ActionType.CHAPTER_READ,
            occurred_on=datetime.date(2026, 7, 13),
        )
        SpiritualAction.objects.filter(user=self.user).delete()
        self.assertEqual(0, SpiritualAction.objects.filter(user=self.user).count())

    def test_bulk_create_upsert_is_refused(self):
        # Plain bulk_create (inserts) is fine — the cover path uses it — but the
        # upsert form would rewrite existing rows behind save().
        action = SpiritualAction(
            user=self.user, action_type=ActionType.CHAPTER_READ,
            occurred_on=datetime.date(2026, 7, 13),
        )
        with self.assertRaises(AppendOnlyError):
            SpiritualAction.objects.bulk_create(
                [action], update_conflicts=True,
                update_fields=['action_type'], unique_fields=['id'],
            )


class GraceLedgerConstraintTests(TestCase):
    def setUp(self):
        self.user = make_user()

    def test_monthly_allocation_requires_a_month(self):
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            GraceDayLedger.objects.create(
                user=self.user, delta=2, reason=GraceReason.MONTHLY_ALLOCATION,
                effective_month=None,
            )

    def test_streak_cover_must_be_negative(self):
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            GraceDayLedger.objects.create(
                user=self.user, delta=1, reason=GraceReason.STREAK_COVER,
                covered_on=datetime.date(2026, 7, 14),
            )


class StreakStateModelTests(TestCase):
    def test_one_streak_state_per_user(self):
        user = make_user()
        StreakState.objects.create(user=user)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            StreakState.objects.create(user=user)
