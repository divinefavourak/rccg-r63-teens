"""
Grace-Day earning: +1 per completed 7-day week where all 7 days are genuinely
active (`docs/12-gamification.md` — "consistency generously funds future grace").
"""
import datetime

from django.test import TestCase

from progress import services
from progress.models import ActionType, GraceReason

from .base import make_user

D = datetime.date


class WeeklyEarningTests(TestCase):
    def setUp(self):
        self.user = make_user()

    BASE = D(2026, 7, 1)

    def _active(self, *day_numbers):
        # `n` is a 1-based day offset from BASE, so runs can cross month ends.
        for n in day_numbers:
            services.record_action(
                self.user, ActionType.CHAPTER_READ,
                occurred_on=self.BASE + datetime.timedelta(days=n - 1))

    def test_seven_active_days_earn_one_grace(self):
        self._active(*range(1, 8))  # 1..7
        self.assertEqual(1, services.grace_balance(self.user))
        self.assertEqual(0, services.streak_for(self.user).active_days_this_week)

    def test_six_active_days_earn_nothing(self):
        self._active(*range(1, 7))  # 1..6
        self.assertEqual(0, services.grace_balance(self.user))
        self.assertEqual(6, services.streak_for(self.user).active_days_this_week)

    def test_two_full_weeks_earn_two(self):
        self._active(*range(1, 15))  # 1..14
        self.assertEqual(2, services.grace_balance(self.user))

    def test_earning_respects_the_cap(self):
        self._active(*range(1, 36))  # 5 weeks -> would be 5, capped at 4
        self.assertEqual(4, services.grace_balance(self.user))

    def test_a_grace_covered_day_breaks_the_earning_week(self):
        # One grace on hand so a miss can be covered.
        services.grant_grace(self.user, 1, GraceReason.JOURNEY_EARNED)
        self._active(*range(1, 7))          # 1..6 active
        self._active(8)                     # miss the 7th -> grace covers it
        self._active(9, 10, 11, 12, 13)     # keep going

        state = services.streak_for(self.user)
        # The covered day reset the active-week run, so 13 calendar days in there
        # is still no earned week; the only grace movement was the cover (1 -> 0).
        self.assertEqual(6, state.active_days_this_week)
        self.assertEqual(0, services.grace_balance(self.user))

    def test_earned_grace_is_recorded_as_weekly(self):
        self._active(*range(1, 8))
        earned = self.user.grace_ledger.filter(reason=GraceReason.WEEKLY_EARNED)
        self.assertEqual(1, earned.count())
        self.assertEqual(1, earned.first().delta)
