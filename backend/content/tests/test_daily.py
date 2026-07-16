"""
The daily experience: today's devotional, today's memory verse, and the Verse of
the Day.

The invariant under test throughout: **the Verse of the Day is today's
devotional's primary memory verse.** Not random, not separately stored, not
independently selectable.
"""
import datetime
from unittest import mock

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from bible.tests.base import make_passage, make_user
from content.models import Devotional, DiscussionQuestion, MemoryVerse, ScriptureReference
from content.services import daily


def make_devotional(date, title='Today', status=Devotional.Status.PUBLISHED, **kwargs):
    return Devotional.objects.create(
        date=date, title=title, content='Message body.', status=status, **kwargs
    )


def make_memory_verse(devotional, reference='John 3:16', is_primary=True, **kwargs):
    kwargs.setdefault('text_override', 'For God so loved the world...')
    return MemoryVerse.objects.create(
        devotional=devotional, reference_display=reference, is_primary=is_primary, **kwargs
    )


class MemoryVerseModelTests(TestCase):
    def setUp(self):
        self.devotional = make_devotional(datetime.date(2026, 7, 9))

    def test_only_one_primary_memory_verse_per_devotional(self):
        make_memory_verse(self.devotional)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                make_memory_verse(self.devotional, reference='Romans 8:28')

    def test_secondary_memory_verses_are_allowed(self):
        make_memory_verse(self.devotional)
        make_memory_verse(self.devotional, reference='Romans 8:28', is_primary=False)
        self.assertEqual(2, self.devotional.memory_verses.count())

    def test_two_devotionals_may_each_have_a_primary(self):
        other = make_devotional(datetime.date(2026, 7, 10), title='Tomorrow')
        make_memory_verse(self.devotional)
        make_memory_verse(other, reference='Psalm 23:1')
        self.assertEqual(2, MemoryVerse.objects.filter(is_primary=True).count())

    def test_text_prefers_the_override(self):
        verse = make_memory_verse(self.devotional, text_override='Quoted text.')
        self.assertEqual('Quoted text.', verse.text)

    def test_text_derives_from_scripture_when_no_override(self):
        _, _, _, verses = make_passage(verse_numbers=(16,))
        verse = MemoryVerse.objects.create(
            devotional=self.devotional, reference_display='John 3:16',
            start_verse=verses[0], text_override='',
        )
        self.assertEqual('Verse 16 text.', verse.text)

    def test_text_spans_a_verse_range(self):
        _, _, _, verses = make_passage(verse_numbers=(16, 17, 18))
        verse = MemoryVerse.objects.create(
            devotional=self.devotional, reference_display='John 3:16-18',
            start_verse=verses[0], end_verse=verses[2], text_override='',
        )
        self.assertEqual('Verse 16 text. Verse 17 text. Verse 18 text.', verse.text)

    def test_unlinked_verse_without_override_is_invalid(self):
        verse = MemoryVerse(
            devotional=self.devotional, reference_display='John 3:16', text_override=''
        )
        with self.assertRaises(ValidationError):
            verse.clean()

    def test_end_verse_without_start_is_invalid(self):
        _, _, _, verses = make_passage(verse_numbers=(16,))
        verse = MemoryVerse(
            devotional=self.devotional, reference_display='x',
            text_override='t', end_verse=verses[0],
        )
        with self.assertRaises(ValidationError):
            verse.clean()


class VerseOfTheDayTests(TestCase):
    """The single-source-of-truth rule."""

    def setUp(self):
        self.today = datetime.date(2026, 7, 9)
        patcher = mock.patch('content.services.daily.app_today', return_value=self.today)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_verse_of_the_day_is_todays_primary_memory_verse(self):
        devotional = make_devotional(self.today)
        primary = make_memory_verse(devotional, reference='John 3:16')
        make_memory_verse(devotional, reference='Romans 8:28', is_primary=False)

        self.assertEqual(primary, daily.verse_of_the_day())
        self.assertEqual(primary, daily.todays_memory_verse())
        self.assertEqual(devotional, daily.todays_devotional())

    def test_verse_of_the_day_is_deterministic(self):
        """Not randomly generated: repeated calls return the same verse."""
        devotional = make_devotional(self.today)
        primary = make_memory_verse(devotional)
        results = {daily.verse_of_the_day().pk for _ in range(5)}
        self.assertEqual({primary.pk}, results)

    def test_verse_of_the_day_ignores_other_days(self):
        yesterday = make_devotional(self.today - datetime.timedelta(days=1), title='Yesterday')
        make_memory_verse(yesterday, reference='Psalm 1:1')
        tomorrow = make_devotional(self.today + datetime.timedelta(days=1), title='Tomorrow')
        make_memory_verse(tomorrow, reference='Psalm 2:1')

        self.assertIsNone(daily.verse_of_the_day())

    def test_no_devotional_today_yields_no_verse(self):
        self.assertIsNone(daily.todays_devotional())
        self.assertIsNone(daily.todays_memory_verse())
        self.assertIsNone(daily.verse_of_the_day())

    def test_devotional_without_a_primary_verse_yields_no_verse(self):
        devotional = make_devotional(self.today)
        make_memory_verse(devotional, is_primary=False)
        self.assertIsNotNone(daily.todays_devotional())
        self.assertIsNone(daily.verse_of_the_day())

    def test_unpublished_devotional_is_not_todays_devotional(self):
        devotional = make_devotional(self.today, status=Devotional.Status.DRAFT)
        make_memory_verse(devotional)
        self.assertIsNone(daily.todays_devotional())
        self.assertIsNone(daily.verse_of_the_day())
        # ...but an editor previewing drafts can still fetch it.
        self.assertEqual(devotional, daily.todays_devotional(published_only=False))

    def test_primary_memory_verse_uses_prefetched_rows(self):
        devotional = make_devotional(self.today)
        make_memory_verse(devotional)
        fetched = daily.todays_devotional()
        with self.assertNumQueries(0):
            self.assertIsNotNone(daily.primary_memory_verse(fetched))

    def test_primary_memory_verse_of_none_is_none(self):
        self.assertIsNone(daily.primary_memory_verse(None))


class AppTimezoneTests(TestCase):
    """The day boundary is Lagos, not UTC."""

    def test_late_utc_evening_is_already_the_next_lagos_day(self):
        from common.dates import app_today
        # 23:30 UTC on 9 July is 00:30 on 10 July in Lagos (UTC+1).
        moment = datetime.datetime(2026, 7, 9, 23, 30, tzinfo=datetime.timezone.utc)
        with mock.patch('common.dates.timezone.now', return_value=moment):
            self.assertEqual(datetime.date(2026, 7, 10), app_today())

    def test_midday_utc_is_the_same_lagos_day(self):
        from common.dates import app_today
        moment = datetime.datetime(2026, 7, 9, 12, 0, tzinfo=datetime.timezone.utc)
        with mock.patch('common.dates.timezone.now', return_value=moment):
            self.assertEqual(datetime.date(2026, 7, 9), app_today())


class PublishGateTests(TestCase):
    def test_devotional_without_a_primary_verse_cannot_publish(self):
        devotional = make_devotional(datetime.date(2026, 7, 9), status=Devotional.Status.DRAFT)
        with self.assertRaises(ValidationError):
            daily.validate_publishable(devotional)

    def test_devotional_with_a_primary_verse_may_publish(self):
        devotional = make_devotional(datetime.date(2026, 7, 9), status=Devotional.Status.DRAFT)
        make_memory_verse(devotional)
        self.assertTrue(daily.validate_publishable(devotional))

    def test_a_secondary_verse_alone_does_not_satisfy_the_gate(self):
        devotional = make_devotional(datetime.date(2026, 7, 9), status=Devotional.Status.DRAFT)
        make_memory_verse(devotional, is_primary=False)
        with self.assertRaises(ValidationError):
            daily.validate_publishable(devotional)


class ScriptureReferenceTests(TestCase):
    def setUp(self):
        self.devotional = make_devotional(datetime.date(2026, 7, 9))

    def test_reference_resolves_against_a_translation(self):
        translation, _, _, _ = make_passage(verse_numbers=(16, 17))
        reference = ScriptureReference.objects.create(
            devotional=self.devotional, reference_display='John 3:16-17',
            book_osis='John', chapter_number=3,
            start_verse_number=16, end_verse_number=17,
        )
        self.assertEqual([16, 17], [v.number for v in reference.resolve(translation)])

    def test_reference_to_unimported_text_resolves_empty(self):
        translation, _, _, _ = make_passage()
        reference = ScriptureReference.objects.create(
            devotional=self.devotional, reference_display='Revelation 22:1',
            book_osis='Rev', chapter_number=22, start_verse_number=1,
        )
        self.assertEqual(0, reference.resolve(translation).count())

    def test_inverted_verse_range_is_invalid(self):
        reference = ScriptureReference(
            devotional=self.devotional, reference_display='x', book_osis='John',
            chapter_number=3, start_verse_number=17, end_verse_number=16,
        )
        with self.assertRaises(ValidationError):
            reference.clean()

    def test_end_verse_without_start_is_invalid(self):
        reference = ScriptureReference(
            devotional=self.devotional, reference_display='x', book_osis='John',
            chapter_number=3, end_verse_number=16,
        )
        with self.assertRaises(ValidationError):
            reference.clean()


class DailyApiTests(APITestCase):
    def setUp(self):
        self.today = datetime.date(2026, 7, 9)
        patcher = mock.patch('content.services.daily.app_today', return_value=self.today)
        patcher.start()
        self.addCleanup(patcher.stop)

        view_patcher = mock.patch('content.views.app_today', return_value=self.today)
        view_patcher.start()
        self.addCleanup(view_patcher.stop)

        self.devotional = make_devotional(self.today)
        self.primary = make_memory_verse(self.devotional, reference='John 3:16')

    def test_verse_of_the_day_is_public(self):
        response = self.client.get(reverse('verse-of-the-day'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual('John 3:16', response.data['reference_display'])
        self.assertTrue(response.data['is_primary'])

    def test_verse_of_the_day_matches_todays_memory_verse_endpoint(self):
        votd = self.client.get(reverse('verse-of-the-day'))
        memory = self.client.get(reverse('devotional-todays-memory-verse'))
        self.assertEqual(status.HTTP_200_OK, memory.status_code)
        self.assertEqual(votd.data['id'], memory.data['id'])

    def test_verse_of_the_day_404s_on_a_pipeline_gap(self):
        self.primary.delete()
        response = self.client.get(reverse('verse-of-the-day'))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_todays_devotional_embeds_the_memory_verse(self):
        response = self.client.get(reverse('devotional-today'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual('John 3:16', response.data['memory_verse']['reference_display'])

    def test_devotional_detail_embeds_references_and_questions(self):
        ScriptureReference.objects.create(
            devotional=self.devotional, reference_display='Psalm 139:14',
            book_osis='Ps', chapter_number=139, start_verse_number=14,
        )
        DiscussionQuestion.objects.create(
            devotional=self.devotional, text='What does this mean to you?', order=1
        )
        response = self.client.get(reverse('devotional-detail', args=[self.devotional.id]))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(1, len(response.data['scripture_references']))
        self.assertEqual(1, len(response.data['discussion_questions']))

    def test_memory_verse_write_requires_content_manage(self):
        self.client.force_authenticate(make_user('teen'))
        response = self.client.post(
            reverse('memory-verse-list'),
            {'devotional': str(self.devotional.id), 'reference_display': 'X',
             'text_override': 'y'},
        )
        self.assertEqual(status.HTTP_403_FORBIDDEN, response.status_code)

    def test_memory_verse_read_is_public(self):
        response = self.client.get(reverse('memory-verse-list'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)

    def test_memory_verse_payload_has_null_translation_fields_when_unlinked(self):
        """The keys must exist as null, not vanish, when no translation is set."""
        response = self.client.get(reverse('verse-of-the-day'))
        self.assertIn('translation_code', response.data)
        self.assertIn('attribution', response.data)
        self.assertIsNone(response.data['translation_code'])
        self.assertIsNone(response.data['attribution'])

    def test_memory_verse_payload_carries_attribution_when_linked(self):
        translation, _, _, _ = make_passage()
        self.primary.translation = translation
        self.primary.save(update_fields=['translation'])
        response = self.client.get(reverse('verse-of-the-day'))
        self.assertEqual('WEB', response.data['translation_code'])
        self.assertEqual('(WEB)', response.data['attribution'])


class MemoryVerseWriteApiTests(APITestCase):
    """Admin writes to memory verses go through `content.manage`."""

    @classmethod
    def setUpTestData(cls):
        from django.core.management import call_command
        from hierarchy import services as hierarchy_services
        from identity.authorization import assign_role
        from identity.models import Role

        call_command('seed_rbac', verbosity=0)
        national = hierarchy_services.create_root('RCCG National')
        cls.editor = make_user('editor')
        assign_role(
            cls.editor,
            Role.objects.get(code='national_coordinator'),
            national,
            enforce_escalation=False,
        )
        cls.devotional = make_devotional(datetime.date(2026, 7, 9))

    def setUp(self):
        self.client.force_authenticate(self.editor)

    def test_editor_can_create_a_primary_memory_verse(self):
        response = self.client.post(reverse('memory-verse-list'), {
            'devotional': str(self.devotional.id),
            'reference_display': 'John 3:16',
            'text_override': 'For God so loved the world...',
            'is_primary': True,
        })
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)

    def test_second_primary_memory_verse_is_a_400_not_a_500(self):
        make_memory_verse(self.devotional)
        response = self.client.post(reverse('memory-verse-list'), {
            'devotional': str(self.devotional.id),
            'reference_display': 'Romans 8:28',
            'text_override': 'And we know...',
            'is_primary': True,
        })
        self.assertEqual(status.HTTP_400_BAD_REQUEST, response.status_code)

    def test_a_secondary_memory_verse_is_accepted_alongside_a_primary(self):
        make_memory_verse(self.devotional)
        response = self.client.post(reverse('memory-verse-list'), {
            'devotional': str(self.devotional.id),
            'reference_display': 'Romans 8:28',
            'text_override': 'And we know...',
            'is_primary': False,
        })
        self.assertEqual(status.HTTP_201_CREATED, response.status_code)

    def test_updating_the_existing_primary_does_not_clash_with_itself(self):
        primary = make_memory_verse(self.devotional)
        response = self.client.patch(
            reverse('memory-verse-detail', args=[primary.id]),
            {'reference_display': 'John 3:16-17'},
        )
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual('John 3:16-17', response.data['reference_display'])


class DraftDevotionalPartsArePrivateTests(APITestCase):
    """
    A devotional's parts are reachable by their own URLs, so the published-only
    gate has to be applied to *their* querysets too. Filtering only
    `/devotionals/` would still let anyone read an unreleased devotional's
    memory verse via `/memory-verses/?devotional=<draft-id>`.
    """

    @classmethod
    def setUpTestData(cls):
        cls.draft = make_devotional(
            datetime.date(2026, 7, 8), title='Unreleased', status=Devotional.Status.DRAFT
        )
        cls.published = make_devotional(datetime.date(2026, 7, 9))
        cls.draft_verse = make_memory_verse(cls.draft, reference='Unreleased 1:1')
        cls.public_verse = make_memory_verse(cls.published)
        cls.draft_question = DiscussionQuestion.objects.create(
            devotional=cls.draft, text='Unreleased question?'
        )
        cls.draft_reference = ScriptureReference.objects.create(
            devotional=cls.draft, reference_display='Unreleased 1:1',
            book_osis='John', chapter_number=1,
        )

    def _ids(self, url, **params):
        response = self.client.get(url, params)
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        results = response.data.get('results', response.data)
        return {item['id'] for item in results}

    def test_anonymous_memory_verse_list_omits_draft_verses(self):
        ids = self._ids(reverse('memory-verse-list'))
        self.assertIn(str(self.public_verse.id), ids)
        self.assertNotIn(str(self.draft_verse.id), ids)

    def test_filtering_by_a_draft_devotional_returns_nothing(self):
        self.assertEqual(
            set(), self._ids(reverse('memory-verse-list'), devotional=str(self.draft.id))
        )

    def test_anonymous_retrieve_of_a_draft_memory_verse_is_404(self):
        response = self.client.get(reverse('memory-verse-detail', args=[self.draft_verse.id]))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_anonymous_retrieve_of_a_draft_discussion_question_is_404(self):
        response = self.client.get(
            reverse('discussion-question-detail', args=[self.draft_question.id])
        )
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_anonymous_retrieve_of_a_draft_scripture_reference_is_404(self):
        response = self.client.get(
            reverse('scripture-reference-detail', args=[self.draft_reference.id])
        )
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_a_content_manager_still_sees_draft_parts(self):
        from django.core.management import call_command
        from hierarchy import services as hierarchy_services
        from identity.authorization import assign_role
        from identity.models import Role

        call_command('seed_rbac', verbosity=0)
        editor = make_user('draft-editor')
        assign_role(
            editor,
            Role.objects.get(code='national_coordinator'),
            hierarchy_services.create_root('RCCG National'),
            enforce_escalation=False,
        )
        self.client.force_authenticate(editor)
        self.assertIn(str(self.draft_verse.id), self._ids(reverse('memory-verse-list')))


class PublishActionTests(TestCase):
    """
    The admin's bulk publish must go through the review service — not a bulk
    UPDATE (which would leave `published_at` null), and not `devotional.publish()`
    (which would make the admin a one-click hole in the two-person rule).
    """

    def _publish_via_admin(self, devotional):
        from content.admin import DevotionalAdmin

        admin_instance = DevotionalAdmin(Devotional, mock.Mock())
        with mock.patch.object(DevotionalAdmin, 'message_user'):
            admin_instance.publish_selected(
                mock.Mock(), Devotional.objects.filter(pk=devotional.pk)
            )

    def _approved_devotional(self, on=datetime.date(2026, 7, 9)):
        """A devotional that has passed the two-person gate."""
        from content.services import review

        devotional = make_devotional(on, status=Devotional.Status.DRAFT)
        make_memory_verse(devotional)

        review.submit_for_review(devotional, make_user('pub-author'))
        review.approve(devotional, make_user('pub-reviewer'))
        return devotional

    def test_publishing_an_approved_devotional_stamps_published_at(self):
        devotional = self._approved_devotional()

        self._publish_via_admin(devotional)

        devotional.refresh_from_db()
        self.assertEqual(Devotional.Status.PUBLISHED, devotional.status)
        self.assertIsNotNone(devotional.published_at)

    def test_the_admin_cannot_publish_an_unreviewed_draft(self):
        """
        docs/07-feature-specifications.md §5 — the two-person rule. An admin action
        that called `devotional.publish()` directly would let one person push
        region-wide content live alone, which is precisely what the rule forbids.
        """
        devotional = make_devotional(
            datetime.date(2026, 7, 10), status=Devotional.Status.DRAFT
        )
        make_memory_verse(devotional)

        self._publish_via_admin(devotional)

        devotional.refresh_from_db()
        self.assertEqual(Devotional.Status.DRAFT, devotional.status)
        self.assertIsNone(devotional.published_at)

    def test_the_publish_gate_reads_prefetched_verses_without_extra_queries(self):
        devotional = make_devotional(datetime.date(2026, 7, 9))
        make_memory_verse(devotional)
        prefetched = Devotional.objects.prefetch_related('memory_verses').get(pk=devotional.pk)
        with self.assertNumQueries(0):
            daily.validate_publishable(prefetched)


class DevotionalRegressionTests(APITestCase):
    """Existing devotional behaviour must survive the Scripture phase."""

    def setUp(self):
        self.today = datetime.date(2026, 7, 9)
        patcher = mock.patch('content.views.app_today', return_value=self.today)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.devotional = make_devotional(self.today)

    def test_devotional_list_still_works(self):
        response = self.client.get(reverse('devotional-list'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertEqual(1, response.data['count'])

    def test_today_endpoint_still_works_without_a_memory_verse(self):
        """A legacy devotional with no MemoryVerse row still renders."""
        response = self.client.get(reverse('devotional-today'))
        self.assertEqual(status.HTTP_200_OK, response.status_code)
        self.assertIsNone(response.data['memory_verse'])

    def test_legacy_memory_verse_string_fields_are_untouched(self):
        self.devotional.memory_verse_passage = 'John 3:16'
        self.devotional.memory_verse_content = 'For God so loved...'
        self.devotional.save()
        response = self.client.get(reverse('devotional-detail', args=[self.devotional.id]))
        self.assertEqual('John 3:16', response.data['memory_verse_passage'])

    def test_today_endpoint_404s_when_no_devotional(self):
        self.devotional.delete()
        response = self.client.get(reverse('devotional-today'))
        self.assertEqual(status.HTTP_404_NOT_FOUND, response.status_code)

    def test_unpublished_devotional_hidden_from_anonymous_list(self):
        self.devotional.status = Devotional.Status.DRAFT
        self.devotional.save(update_fields=['status'])
        response = self.client.get(reverse('devotional-list'))
        self.assertEqual(0, response.data['count'])
