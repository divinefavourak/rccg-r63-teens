"""
Progress read API: owner-only surfaces and the composed summary that joins
Progress figures with Bible reading stats.
"""
import datetime

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from bible import services as bible_services
from bible.tests.base import make_passage
from progress import services
from progress.models import ActionType, GraceReason

from .base import make_user

D = datetime.date


class StreakApiTests(APITestCase):
    def setUp(self):
        self.user = make_user()

    def test_streak_requires_authentication(self):
        response = self.client.get(reverse('progress-streak'))
        self.assertIn(response.status_code,
                      (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_streak_reports_current_and_longest(self):
        services.record_action(self.user, ActionType.CHAPTER_READ, occurred_on=D(2026, 7, 13))
        services.record_action(self.user, ActionType.CHAPTER_READ, occurred_on=D(2026, 7, 14))
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse('progress-streak'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(2, response.data['current_length'])
        self.assertEqual(2, response.data['longest_length'])


class SummaryApiTests(APITestCase):
    def setUp(self):
        self.user = make_user()

    def test_summary_composes_progress_and_bible_metrics(self):
        # Bible-owned reading (distinct chapters/books) via bible's public service.
        _, _, chapter, _ = make_passage()
        bible_services.record_chapter_read(self.user, chapter, completed=True)
        # Progress-owned actions.
        services.record_action(
            self.user, ActionType.DEVOTIONAL_COMPLETED, occurred_on=D(2026, 7, 13))
        services.grant_grace(self.user, 2, GraceReason.WEEKLY_EARNED)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse('progress-summary'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(1, response.data['chapters_read'])
        self.assertEqual(1, response.data['books_read'])
        self.assertEqual(1, response.data['devotionals_completed'])
        self.assertEqual(2, response.data['grace_balance'])
        self.assertEqual(1, response.data['current_streak'])

    def test_rereading_a_chapter_does_not_inflate_chapters_read(self):
        _, _, chapter, _ = make_passage()
        bible_services.record_chapter_read(self.user, chapter)
        bible_services.record_chapter_read(self.user, chapter)  # same chapter again
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse('progress-summary'))
        self.assertEqual(1, response.data['chapters_read'])


class ActionHistoryApiTests(APITestCase):
    def setUp(self):
        self.owner = make_user('owner')
        self.other = make_user('other')
        services.record_action(self.owner, ActionType.CHAPTER_READ, occurred_on=D(2026, 7, 13))

    def test_history_lists_only_the_requesters_actions(self):
        services.record_action(self.other, ActionType.CHAPTER_READ, occurred_on=D(2026, 7, 13))
        self.client.force_authenticate(self.owner)
        response = self.client.get(reverse('progress-action-list'))
        results = response.data.get('results', response.data)
        self.assertEqual(1, len(results))

    def test_a_foreign_action_is_not_retrievable(self):
        owner_action = self.owner.spiritual_actions.first()
        self.client.force_authenticate(self.other)
        response = self.client.get(
            reverse('progress-action-detail', args=[owner_action.id]))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)


class CalendarApiTests(APITestCase):
    def setUp(self):
        self.user = make_user()
        for day in (5, 5, 12, 20):  # 5th twice -> still one active day
            services.record_action(
                self.user, ActionType.CHAPTER_READ, occurred_on=D(2026, 7, day))
        self.client.force_authenticate(self.user)

    def test_calendar_returns_distinct_active_days(self):
        response = self.client.get(reverse('progress-calendar'), {'month': '2026-07'})
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual('2026-07', response.data['month'])
        self.assertEqual(['2026-07-05', '2026-07-12', '2026-07-20'],
                         [str(d) for d in response.data['active_days']])

    def test_a_different_month_is_empty(self):
        response = self.client.get(reverse('progress-calendar'), {'month': '2026-08'})
        self.assertEqual([], response.data['active_days'])

    def test_malformed_month_is_rejected(self):
        response = self.client.get(reverse('progress-calendar'), {'month': 'July'})
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)
