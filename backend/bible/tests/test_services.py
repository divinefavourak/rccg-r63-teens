"""Service-layer tests: reference resolution and the reading layer."""
from django.test import TestCase

from bible import services
from bible.models import ContinueReading, ReadingHistory, ReadingProgress

from .base import make_book, make_chapter, make_passage, make_translation, make_user, make_verse


class TranslationResolutionTests(TestCase):
    def test_default_translation_prefers_the_flagged_default(self):
        make_translation(code='KJV', is_default=False, sort_order=0)
        web = make_translation(code='WEB', is_default=True, sort_order=5)
        self.assertEqual(web, services.default_translation())

    def test_default_translation_falls_back_to_first_active(self):
        kjv = make_translation(code='KJV', is_default=False)
        self.assertEqual(kjv, services.default_translation())

    def test_default_translation_is_none_when_none_exist(self):
        self.assertIsNone(services.default_translation())

    def test_resolve_translation_by_code_is_case_insensitive(self):
        web = make_translation(code='WEB')
        self.assertEqual(web, services.resolve_translation('web'))

    def test_resolve_translation_falls_back_when_code_unknown(self):
        web = make_translation(code='WEB', is_default=True)
        self.assertEqual(web, services.resolve_translation('NOPE'))

    def test_inactive_translations_are_never_resolved(self):
        make_translation(code='OLD', is_default=False, is_active=False)
        self.assertIsNone(services.resolve_translation('OLD'))


class ResolveReferenceTests(TestCase):
    def setUp(self):
        self.translation, self.book, self.chapter, self.verses = make_passage(
            verse_numbers=(14, 15, 16, 17)
        )

    def test_single_verse(self):
        found = services.resolve_reference(self.translation, 'John', 3, 16)
        self.assertEqual([16], [v.number for v in found])

    def test_verse_range(self):
        found = services.resolve_reference(self.translation, 'John', 3, 15, 17)
        self.assertEqual([15, 16, 17], [v.number for v in found])

    def test_whole_chapter_when_no_verse_numbers(self):
        found = services.resolve_reference(self.translation, 'John', 3)
        self.assertEqual([14, 15, 16, 17], [v.number for v in found])

    def test_osis_code_is_case_insensitive(self):
        found = services.resolve_reference(self.translation, 'john', 3, 16)
        self.assertEqual(1, found.count())

    def test_unimported_passage_returns_empty_not_error(self):
        """A valid address into text we have not imported is not an error."""
        found = services.resolve_reference(self.translation, 'Rev', 22, 1)
        self.assertEqual(0, found.count())

    def test_no_translation_returns_empty(self):
        self.assertEqual(0, services.resolve_reference(None, 'John', 3, 16).count())

    def test_reference_resolves_independently_per_translation(self):
        """The same address in a second translation yields that translation's text."""
        kjv = make_translation(code='KJV', is_default=False)
        kjv_book = make_book(kjv)
        kjv_chapter = make_chapter(kjv_book)
        make_verse(kjv_chapter, number=16, text='KJV wording')

        web_hit = services.resolve_reference(self.translation, 'John', 3, 16).get()
        kjv_hit = services.resolve_reference(kjv, 'John', 3, 16).get()
        self.assertNotEqual(web_hit.text, kjv_hit.text)
        self.assertEqual('KJV wording', kjv_hit.text)


class RecordChapterReadTests(TestCase):
    def setUp(self):
        self.user = make_user()
        _, _, self.chapter, _ = make_passage()

    def test_records_history_progress_and_position(self):
        services.record_chapter_read(self.user, self.chapter, furthest_verse_number=5)

        self.assertEqual(1, ReadingHistory.objects.filter(user=self.user).count())
        progress = ReadingProgress.objects.get(user=self.user, chapter=self.chapter)
        self.assertEqual(5, progress.furthest_verse_number)
        position = ContinueReading.objects.get(user=self.user)
        self.assertEqual(self.chapter, position.chapter)
        self.assertEqual(5, position.verse_number)

    def test_history_is_append_only(self):
        services.record_chapter_read(self.user, self.chapter)
        services.record_chapter_read(self.user, self.chapter)
        self.assertEqual(2, ReadingHistory.objects.filter(user=self.user).count())
        # ...but progress stays a single row per chapter.
        self.assertEqual(1, ReadingProgress.objects.filter(user=self.user).count())

    def test_progress_never_moves_backwards(self):
        services.record_chapter_read(self.user, self.chapter, furthest_verse_number=10)
        services.record_chapter_read(self.user, self.chapter, furthest_verse_number=3)
        progress = ReadingProgress.objects.get(user=self.user, chapter=self.chapter)
        self.assertEqual(10, progress.furthest_verse_number)

    def test_completion_is_sticky_and_stamped(self):
        services.record_chapter_read(self.user, self.chapter, completed=True)
        progress = ReadingProgress.objects.get(user=self.user, chapter=self.chapter)
        self.assertTrue(progress.is_completed)
        self.assertIsNotNone(progress.completed_at)
        first_stamp = progress.completed_at

        services.record_chapter_read(self.user, self.chapter, completed=True)
        progress.refresh_from_db()
        self.assertEqual(first_stamp, progress.completed_at)

    def test_continue_reading_moves_to_the_latest_chapter(self):
        other_chapter = make_chapter(self.chapter.book, number=4)
        services.record_chapter_read(self.user, self.chapter, furthest_verse_number=2)
        services.record_chapter_read(self.user, other_chapter, furthest_verse_number=1)

        self.assertEqual(1, ContinueReading.objects.filter(user=self.user).count())
        self.assertEqual(other_chapter, ContinueReading.objects.get(user=self.user).chapter)


class ContinueReadingTests(TestCase):
    def setUp(self):
        self.user = make_user()
        _, _, self.chapter, _ = make_passage()

    def test_none_when_nothing_read(self):
        self.assertIsNone(services.get_continue_reading(self.user))

    def test_returns_the_saved_position(self):
        services.set_continue_reading(self.user, self.chapter, verse_number=7)
        position = services.get_continue_reading(self.user)
        self.assertEqual(self.chapter, position.chapter)
        self.assertEqual(7, position.verse_number)

    def test_falls_back_to_last_history_entry(self):
        """A user who read before this feature shipped still gets a card."""
        ReadingHistory.objects.create(
            user=self.user, chapter=self.chapter, read_on='2026-07-09'
        )
        position = services.get_continue_reading(self.user)
        self.assertIsNotNone(position)
        self.assertEqual(self.chapter, position.chapter)
        self.assertEqual(1, position.verse_number)

    def test_anonymous_user_has_no_position(self):
        from django.contrib.auth.models import AnonymousUser
        self.assertIsNone(services.get_continue_reading(AnonymousUser()))

    def test_setting_position_twice_keeps_one_row(self):
        services.set_continue_reading(self.user, self.chapter, 2)
        services.set_continue_reading(self.user, self.chapter, 9)
        self.assertEqual(1, ContinueReading.objects.filter(user=self.user).count())
        self.assertEqual(9, ContinueReading.objects.get(user=self.user).verse_number)
