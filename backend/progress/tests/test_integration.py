"""
Integration: real activity in other domains emits into the Progress stream.

These live with Progress because they assert on `SpiritualAction`/`StreakState`,
but they drive the *actual* bible/content code paths, not `record_action`
directly — that is the point of the wiring.
"""
import datetime

from django.urls import reverse
from rest_framework.test import APITestCase

from bible import services as bible_services
from bible.tests.base import make_passage, make_user
from content.models import Devotional
from progress.models import ActionType, SpiritualAction, StreakState


class ChapterReadIntegrationTests(APITestCase):
    def setUp(self):
        self.user = make_user()
        _, _, self.chapter, _ = make_passage()

    def test_reading_a_chapter_emits_a_spiritual_action(self):
        bible_services.record_chapter_read(self.user, self.chapter, completed=True)
        action = SpiritualAction.objects.get(user=self.user)
        self.assertEqual(ActionType.CHAPTER_READ, action.action_type)
        self.assertEqual(f'bible.chapter:{self.chapter.id}', action.source_reference)

    def test_reading_a_chapter_advances_the_streak(self):
        bible_services.record_chapter_read(self.user, self.chapter)
        state = StreakState.objects.get(user=self.user)
        self.assertEqual(1, state.current_length)


class DevotionalReadIntegrationTests(APITestCase):
    def setUp(self):
        self.user = make_user()
        self.devotional = Devotional.objects.create(
            date=datetime.date(2026, 7, 13), title='Today', content='Body.',
            status=Devotional.Status.PUBLISHED,
        )
        self.client.force_authenticate(self.user)

    def test_marking_a_devotional_read_emits_a_spiritual_action(self):
        response = self.client.post(reverse('devotional-mark-read', args=[self.devotional.id]))
        self.assertEqual(200, response.status_code)
        action = SpiritualAction.objects.get(user=self.user)
        self.assertEqual(ActionType.DEVOTIONAL_COMPLETED, action.action_type)
        self.assertEqual(f'content.devotional:{self.devotional.id}', action.source_reference)

    def test_rereading_the_same_devotional_does_not_re_emit(self):
        url = reverse('devotional-mark-read', args=[self.devotional.id])
        self.client.post(url)
        self.client.post(url)  # deduped by UserReadLog -> no second action
        self.assertEqual(1, SpiritualAction.objects.filter(user=self.user).count())
