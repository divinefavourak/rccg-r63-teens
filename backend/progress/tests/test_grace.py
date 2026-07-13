"""
Grace Days: the ledger, the held cap, monthly allocation, and grace-aware
streak recovery (`docs/12-gamification.md` "Grace Days").
"""
import datetime

from django.db import IntegrityError
from django.test import TestCase

from progress import services
from progress.models import ActionType, GraceDayLedger, GraceReason

from .base import make_user

D = datetime.date


class GraceBalanceTests(TestCase):
    def setUp(self):
        self.user = make_user()

    def test_balance_starts_at_zero(self):
        self.assertEqual(0, services.grace_balance(self.user))

    def test_grant_increases_balance(self):
        services.grant_grace(self.user, 2, GraceReason.MONTHLY_ALLOCATION)
        self.assertEqual(2, services.grace_balance(self.user))

    def test_grant_is_capped_at_four(self):
        services.grant_grace(self.user, 3, GraceReason.MONTHLY_ALLOCATION)
        granted = services.grant_grace(self.user, 3, GraceReason.WEEKLY_EARNED)
        self.assertEqual(1, granted)                 # only room for one more
        self.assertEqual(4, services.grace_balance(self.user))

    def test_grant_at_cap_writes_nothing(self):
        services.grant_grace(self.user, 4, GraceReason.MONTHLY_ALLOCATION)
        granted = services.grant_grace(self.user, 2, GraceReason.JOURNEY_EARNED)
        self.assertEqual(0, granted)
        self.assertEqual(4, services.grace_balance(self.user))


class MonthlyAllocationTests(TestCase):
    def setUp(self):
        self.user = make_user()

    def test_allocates_two_for_the_month(self):
        services.grant_monthly_allocation(self.user, D(2026, 7, 15))
        self.assertEqual(2, services.grace_balance(self.user))

    def test_is_idempotent_within_a_month(self):
        services.grant_monthly_allocation(self.user, D(2026, 7, 1))
        services.grant_monthly_allocation(self.user, D(2026, 7, 20))  # same month
        self.assertEqual(2, services.grace_balance(self.user))

    def test_a_new_month_allocates_again(self):
        services.grant_monthly_allocation(self.user, D(2026, 7, 1))
        services.grant_monthly_allocation(self.user, D(2026, 8, 1))
        self.assertEqual(4, services.grace_balance(self.user))

    def test_duplicate_monthly_ledger_row_is_rejected_at_the_db(self):
        month = D(2026, 7, 1)
        GraceDayLedger.objects.create(
            user=self.user, delta=2, reason=GraceReason.MONTHLY_ALLOCATION,
            effective_month=month,
        )
        with self.assertRaises(IntegrityError):
            GraceDayLedger.objects.create(
                user=self.user, delta=2, reason=GraceReason.MONTHLY_ALLOCATION,
                effective_month=month,
            )


class GraceAwareStreakTests(TestCase):
    def setUp(self):
        self.user = make_user()

    def _record(self, day):
        return services.record_action(
            self.user, ActionType.CHAPTER_READ, occurred_on=D(2026, 7, day)
        )

    def test_one_missed_day_is_covered_when_grace_available(self):
        services.grant_grace(self.user, 2, GraceReason.MONTHLY_ALLOCATION)
        self._record(13)
        self._record(15)  # missed the 14th
        state = services.streak_for(self.user)
        self.assertEqual(3, state.current_length)          # 13, 14 (grace), 15
        self.assertEqual(1, services.grace_balance(self.user))
        self.assertEqual(D(2026, 7, 13), state.started_on)

    def test_two_missed_days_consume_two_grace(self):
        services.grant_grace(self.user, 2, GraceReason.MONTHLY_ALLOCATION)
        self._record(13)
        self._record(16)  # missed 14 and 15
        state = services.streak_for(self.user)
        self.assertEqual(4, state.current_length)
        self.assertEqual(0, services.grace_balance(self.user))

    def test_three_missed_days_reset_even_with_grace(self):
        services.grant_grace(self.user, 4, GraceReason.MONTHLY_ALLOCATION)
        self._record(13)
        self._record(17)  # missed 14, 15, 16 — beyond the 2-consecutive limit
        state = services.streak_for(self.user)
        self.assertEqual(1, state.current_length)
        self.assertEqual(4, services.grace_balance(self.user))  # nothing spent
        self.assertEqual(D(2026, 7, 17), state.started_on)

    def test_insufficient_grace_resets_and_spends_nothing(self):
        services.grant_grace(self.user, 1, GraceReason.MONTHLY_ALLOCATION)
        self._record(13)
        self._record(16)  # 2 missed days, only 1 grace — cannot bridge
        state = services.streak_for(self.user)
        self.assertEqual(1, state.current_length)
        self.assertEqual(1, services.grace_balance(self.user))  # not partially spent

    def test_cover_records_the_bridged_day(self):
        services.grant_grace(self.user, 2, GraceReason.MONTHLY_ALLOCATION)
        self._record(13)
        self._record(15)
        cover = GraceDayLedger.objects.get(user=self.user, reason=GraceReason.STREAK_COVER)
        self.assertEqual(D(2026, 7, 14), cover.covered_on)
        self.assertEqual(-1, cover.delta)
