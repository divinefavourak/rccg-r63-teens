"""Tests for the Today assembler."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from bible import services as bible_services
from bible.importers import import_translation
from bible.models import BibleChapter, BibleTranslation
from common.dates import app_today
from content.models import Devotional, MemoryVerse, ScriptureReference, UserReadLog
from profiles.models import DailyChallenge
from progress.models import ActionType, SpiritualAction
from today import services

User = get_user_model()


def make_user(username='teen'):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x')


def make_translation():
    import_translation({
        'translation': {'code': 'WEB', 'name': 'World English Bible',
                        'is_public_domain': True, 'is_default': True},
        'books': [{'osis_code': 'John', 'chapters': [[
            'In the beginning was the Word.',
            'For God so loved the world.',
        ]]}],
    })
    return BibleTranslation.objects.get(code='WEB')


def make_devotional(on=None, published=True, with_verse=True):
    on = on or app_today()
    devotional = Devotional.objects.create(
        date=on,
        title='Chosen',
        slug=f'chosen-{on}',
        content='word ' * 400,          # 400 words -> 2 min read
        key_point='You are chosen.',
        status=(Devotional.Status.PUBLISHED if published else Devotional.Status.DRAFT),
    )
    if with_verse:
        MemoryVerse.objects.create(
            devotional=devotional,
            is_primary=True,
            reference_display='John 1:2',
            text_override='For God so loved the world.',
        )
    return devotional


class GreetingTests(TestCase):

    def test_greeting_follows_the_clock(self):
        self.assertEqual(services.greeting_for(7), 'Good morning')
        self.assertEqual(services.greeting_for(13), 'Good afternoon')
        self.assertEqual(services.greeting_for(20), 'Good evening')


class AssembleTests(TestCase):

    def setUp(self):
        self.user = make_user()
        self.translation = make_translation()

    def test_assembles_the_whole_screen_for_a_signed_in_teen(self):
        devotional = make_devotional()

        payload = services.assemble(self.user)

        self.assertEqual(payload['date'], app_today())
        self.assertTrue(payload['has_devotional'])
        self.assertEqual(payload['devotional'], devotional)
        self.assertIsNotNone(payload['memory_verse'])
        self.assertIsNotNone(payload['streak'])
        self.assertFalse(payload['devotional_completed'])

    def test_the_verse_of_the_day_is_the_devotionals_memory_verse(self):
        """One Day. One Verse. One Message. — there is no competing daily verse."""
        devotional = make_devotional()

        payload = services.assemble(self.user)

        self.assertEqual(payload['memory_verse'].devotional_id, devotional.id)
        self.assertTrue(payload['memory_verse'].is_primary)

    def test_a_pipeline_gap_is_a_state_not_an_error(self):
        """No devotional today: Today still renders — the streak is still true."""
        payload = services.assemble(self.user)

        self.assertFalse(payload['has_devotional'])
        self.assertIsNone(payload['devotional'])
        self.assertIsNone(payload['memory_verse'])
        self.assertIsNotNone(payload['streak'])

    def test_an_unpublished_devotional_does_not_surface(self):
        make_devotional(published=False)

        self.assertFalse(services.assemble(self.user)['has_devotional'])

    def test_a_guest_gets_the_public_half_and_null_personal_sections(self):
        from django.contrib.auth.models import AnonymousUser
        make_devotional()

        payload = services.assemble(AnonymousUser())

        self.assertTrue(payload['has_devotional'])
        self.assertIsNotNone(payload['memory_verse'])
        self.assertIsNone(payload['streak'])
        self.assertIsNone(payload['continue_reading'])
        self.assertFalse(payload['devotional_completed'])

    def test_devotional_completion_is_read_from_the_read_log(self):
        devotional = make_devotional()
        UserReadLog.objects.create(user=self.user, devotional=devotional)

        self.assertTrue(services.assemble(self.user)['devotional_completed'])

    def test_continue_reading_resolves_to_the_last_position(self):
        chapter = BibleChapter.objects.get(book__osis_code='John', number=1)
        bible_services.set_continue_reading(self.user, chapter, verse_number=2)

        payload = services.assemble(self.user)

        self.assertEqual(payload['continue_reading'].chapter_id, chapter.id)

    def test_scripture_cards_carry_anchor_references(self):
        devotional = make_devotional()
        ScriptureReference.objects.create(
            devotional=devotional, kind=ScriptureReference.Kind.ANCHOR,
            reference_display='John 1:1', book_osis='John', chapter_number=1,
            start_verse_number=1,
        )
        ScriptureReference.objects.create(
            devotional=devotional, kind=ScriptureReference.Kind.CROSS_REFERENCE,
            reference_display='John 1:2', book_osis='John', chapter_number=1,
            start_verse_number=2,
        )

        cards = services.assemble(self.user)['scripture_references']

        # Cross-references belong in the reader, not on the Today card.
        self.assertEqual([c.reference_display for c in cards], ['John 1:1'])


class ChallengeTests(TestCase):

    def setUp(self):
        self.user = make_user()
        self.challenge = DailyChallenge.objects.create(
            title='Memorise the verse',
            description='Say it out loud three times.',
            challenge_date=app_today(),
        )

    def test_todays_challenge_surfaces(self):
        payload = services.assemble(self.user)

        self.assertEqual(payload['challenge'], self.challenge)
        self.assertFalse(payload['challenge_completed'])

    def test_a_challenge_for_another_day_does_not_surface(self):
        from datetime import timedelta
        self.challenge.challenge_date = app_today() - timedelta(days=1)
        self.challenge.save()

        self.assertIsNone(services.assemble(self.user)['challenge'])

    def test_an_inactive_challenge_does_not_surface(self):
        self.challenge.is_active = False
        self.challenge.save()

        self.assertIsNone(services.assemble(self.user)['challenge'])

    def test_completing_records_one_spiritual_action(self):
        action, created = services.complete_challenge(self.user, self.challenge)

        self.assertTrue(created)
        self.assertEqual(action.action_type, ActionType.CHALLENGE_COMPLETED)
        self.assertEqual(
            SpiritualAction.objects.filter(
                user=self.user, action_type=ActionType.CHALLENGE_COMPLETED).count(),
            1,
        )
        self.assertTrue(services.assemble(self.user)['challenge_completed'])

    def test_completing_twice_is_idempotent(self):
        """A double-tap must not inflate the stats tiles."""
        services.complete_challenge(self.user, self.challenge)
        action, created = services.complete_challenge(self.user, self.challenge)

        self.assertFalse(created)
        self.assertIsNone(action)
        self.assertEqual(
            SpiritualAction.objects.filter(
                user=self.user, action_type=ActionType.CHALLENGE_COMPLETED).count(),
            1,
        )

    def test_a_completion_counts_toward_the_streak(self):
        services.complete_challenge(self.user, self.challenge)

        from progress import services as progress_services
        self.assertEqual(progress_services.streak_for(self.user).current_length, 1)


class TodayEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.url = reverse('today')
        make_translation()

    def test_today_is_public(self):
        make_devotional()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['has_devotional'])
        self.assertIsNone(response.data['streak'])

    def test_one_call_returns_every_card(self):
        """The point of the assembler: a client draws Today from a single request."""
        make_devotional()
        DailyChallenge.objects.create(
            title='Pray for a friend', description='One minute.',
            challenge_date=app_today())
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        for key in ['date', 'greeting', 'devotional', 'memory_verse',
                    'scripture_references', 'challenge', 'streak',
                    'grace_balance', 'continue_reading', 'devotional_completed',
                    'challenge_completed', 'has_devotional']:
            self.assertIn(key, response.data)

    def test_the_challenge_card_never_exposes_coins(self):
        """
        Coin/point gamification is banned (docs/12-gamification.md) and parked by
        the backend audit. The legacy column still exists; Today must not leak it.
        """
        DailyChallenge.objects.create(
            title='Pray', description='.', challenge_date=app_today(),
            coins_reward=50)
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertNotIn('coins_reward', response.data['challenge'])

    def test_the_devotional_card_carries_an_excerpt_and_reading_time(self):
        make_devotional()
        self.client.force_authenticate(self.user)

        card = self.client.get(self.url).data['devotional']

        self.assertEqual(card['excerpt'], 'You are chosen.')
        self.assertEqual(card['reading_time_minutes'], 2)   # 400 words @ 200wpm

    def test_pipeline_gap_returns_200_not_404(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['has_devotional'])
        self.assertIsNone(response.data['devotional'])


class CompleteChallengeEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.url = reverse('today-challenge-complete')

    def test_completing_the_challenge(self):
        DailyChallenge.objects.create(
            title='Pray', description='.', challenge_date=app_today())
        self.client.force_authenticate(self.user)

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['completed'])
        self.assertFalse(response.data['already_completed'])

    def test_completing_twice_reports_already_completed(self):
        DailyChallenge.objects.create(
            title='Pray', description='.', challenge_date=app_today())
        self.client.force_authenticate(self.user)

        self.client.post(self.url)
        response = self.client.post(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['already_completed'])

    def test_no_challenge_today_is_a_404(self):
        self.client.force_authenticate(self.user)

        self.assertEqual(self.client.post(self.url).status_code, 404)

    def test_a_guest_cannot_complete_a_challenge(self):
        DailyChallenge.objects.create(
            title='Pray', description='.', challenge_date=app_today())

        self.assertIn(self.client.post(self.url).status_code, (401, 403))
