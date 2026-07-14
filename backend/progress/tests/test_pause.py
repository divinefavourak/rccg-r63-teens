"""
Streak pause: a proactively-declared absence the streak survives intact
(`docs/12-gamification.md` "Extended absences").
"""
import datetime

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from progress import services
from progress.models import ActionType, GraceReason, StreakPause

from .base import make_user

D = datetime.date


class PauseServiceTests(TestCase):
    def setUp(self):
        self.user = make_user()

    def test_pause_spans_the_requested_inclusive_days(self):
        pause = services.pause_streak(self.user, D(2026, 7, 11), 3)
        self.assertEqual(D(2026, 7, 11), pause.start_on)
        self.assertEqual(D(2026, 7, 13), pause.end_on)   # 11, 12, 13

    def test_pause_longer_than_the_cap_is_rejected(self):
        with self.assertRaises(ValueError):
            services.pause_streak(self.user, D(2026, 7, 1), 15)

    def test_zero_day_pause_is_rejected(self):
        with self.assertRaises(ValueError):
            services.pause_streak(self.user, D(2026, 7, 1), 0)

    def test_a_third_pause_in_a_year_is_rejected(self):
        services.pause_streak(self.user, D(2026, 1, 1), 5)
        services.pause_streak(self.user, D(2026, 6, 1), 5)
        with self.assertRaises(ValueError):
            services.pause_streak(self.user, D(2026, 9, 1), 5)

    def test_the_budget_is_per_calendar_year(self):
        services.pause_streak(self.user, D(2026, 1, 1), 5)
        services.pause_streak(self.user, D(2026, 6, 1), 5)
        # A new year frees the budget again.
        services.pause_streak(self.user, D(2027, 1, 1), 5)
        self.assertEqual(3, StreakPause.objects.filter(user=self.user).count())


class PauseAwareStreakTests(TestCase):
    def setUp(self):
        self.user = make_user()

    def _read(self, day):
        services.record_action(
            self.user, ActionType.CHAPTER_READ, occurred_on=D(2026, 7, day))

    def test_a_paused_gap_resumes_the_streak_where_it_left_off(self):
        self._read(10)                                   # streak = 1
        services.pause_streak(self.user, D(2026, 7, 11), 3)  # 11, 12, 13
        self._read(14)                                   # gap fully paused
        state = services.streak_for(self.user)
        self.assertEqual(2, state.current_length)        # 10 + 14; paused days add none
        self.assertEqual(D(2026, 7, 10), state.started_on)

    def test_a_pause_does_not_consume_grace(self):
        services.grant_grace(self.user, 2, GraceReason.WEEKLY_EARNED)
        self._read(10)
        services.pause_streak(self.user, D(2026, 7, 11), 2)
        self._read(13)  # missed 11, 12 — both paused
        self.assertEqual(2, services.grace_balance(self.user))

    def test_a_gap_extending_past_the_pause_is_not_covered(self):
        self._read(10)
        services.pause_streak(self.user, D(2026, 7, 11), 2)  # covers 11, 12 only
        self._read(14)  # missed 11, 12, 13 — the 13th is not paused, no grace
        state = services.streak_for(self.user)
        self.assertEqual(1, state.current_length)        # reset


class PauseApiTests(APITestCase):
    def setUp(self):
        self.user = make_user()
        self.client.force_authenticate(self.user)

    def test_declaring_a_pause_returns_the_window(self):
        response = self.client.post(
            reverse('progress-pause'), {'start_on': '2026-07-11', 'days': 3})
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)
        self.assertEqual('2026-07-13', str(response.data['end_on']))

    def test_exceeding_the_yearly_budget_is_a_400(self):
        services.pause_streak(self.user, D(2026, 1, 1), 5)
        services.pause_streak(self.user, D(2026, 6, 1), 5)
        response = self.client.post(
            reverse('progress-pause'), {'start_on': '2026-09-01', 'days': 5})
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_too_long_a_pause_is_a_400(self):
        response = self.client.post(
            reverse('progress-pause'), {'start_on': '2026-07-01', 'days': 30})
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
