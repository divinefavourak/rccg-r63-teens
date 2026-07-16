"""
Model-level tests: the invariants the database itself must guarantee.

These assert on `IntegrityError`, not on serializer validation — a constraint
that only lives in a serializer is not an invariant, because the admin, the
shell and management commands all bypass it.
"""
import datetime
from unittest import mock

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from bible.models import (
    BibleBook, BibleTranslation, Bookmark, Highlight, Note, ReadingHistory,
)
from common.dates import app_today

from .base import make_passage, make_translation, make_user, make_verse


class TranslationConstraintTests(TestCase):
    def test_only_one_default_translation_allowed(self):
        make_translation(code='WEB', is_default=True)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                make_translation(code='KJV', is_default=True)

    def test_many_non_default_translations_allowed(self):
        make_translation(code='WEB', is_default=True)
        make_translation(code='KJV', is_default=False)
        make_translation(code='ASV', is_default=False)
        self.assertEqual(3, BibleTranslation.objects.count())

    def test_attribution_falls_back_to_code_for_public_domain(self):
        translation = make_translation(code='WEB', copyright_notice='')
        self.assertEqual('(WEB)', translation.attribution)

    def test_attribution_uses_copyright_notice_when_present(self):
        translation = make_translation(code='ESV', is_default=False,
                                       copyright_notice='© Crossway')
        self.assertEqual('© Crossway', translation.attribution)


class ScriptureAddressTests(TestCase):
    def test_verse_is_unique_within_a_chapter(self):
        _, _, chapter, _ = make_passage(verse_numbers=(1,))
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                make_verse(chapter, number=1, text='duplicate')

    def test_same_osis_code_may_exist_in_two_translations(self):
        """The whole point of osis_code: one address, many translations."""
        web = make_translation(code='WEB', is_default=True)
        kjv = make_translation(code='KJV', is_default=False)
        make_passage(translation=web)
        make_passage(translation=kjv)
        self.assertEqual(2, BibleBook.objects.filter(osis_code='John').count())

    def test_verse_reference_and_translation_derive_from_the_chain(self):
        translation, _, _, verses = make_passage(verse_numbers=(16,))
        verse = verses[0]
        self.assertEqual('John 3:16', verse.reference)
        self.assertEqual(translation, verse.translation)


class BookmarkConstraintTests(TestCase):
    def setUp(self):
        self.user = make_user()
        _, _, self.chapter, self.verses = make_passage()

    def test_duplicate_verse_bookmark_is_rejected(self):
        Bookmark.objects.create(user=self.user, verse=self.verses[0])
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Bookmark.objects.create(user=self.user, verse=self.verses[0])

    def test_duplicate_chapter_bookmark_is_rejected(self):
        Bookmark.objects.create(user=self.user, chapter=self.chapter)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Bookmark.objects.create(user=self.user, chapter=self.chapter)

    def test_two_users_may_bookmark_the_same_verse(self):
        other = make_user('other')
        Bookmark.objects.create(user=self.user, verse=self.verses[0])
        Bookmark.objects.create(user=other, verse=self.verses[0])
        self.assertEqual(2, Bookmark.objects.count())

    def test_bookmark_must_target_exactly_one_of_verse_or_chapter(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Bookmark.objects.create(user=self.user)  # neither
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Bookmark.objects.create(
                    user=self.user, verse=self.verses[0], chapter=self.chapter
                )  # both

    def test_clean_rejects_both_targets(self):
        bookmark = Bookmark(user=self.user, verse=self.verses[0], chapter=self.chapter)
        with self.assertRaises(ValidationError):
            bookmark.clean()


class HighlightConstraintTests(TestCase):
    def setUp(self):
        self.user = make_user()
        _, _, _, self.verses = make_passage()

    def test_one_highlight_per_user_and_verse(self):
        Highlight.objects.create(user=self.user, verse=self.verses[0])
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Highlight.objects.create(
                    user=self.user, verse=self.verses[0], color=Highlight.Color.BLUE
                )

    def test_recolouring_updates_the_existing_row(self):
        highlight = Highlight.objects.create(user=self.user, verse=self.verses[0])
        highlight.color = Highlight.Color.PINK
        highlight.save()
        self.assertEqual(1, Highlight.objects.count())
        self.assertEqual(Highlight.Color.PINK, Highlight.objects.get().color)

    def test_default_colour_is_yellow(self):
        highlight = Highlight.objects.create(user=self.user, verse=self.verses[0])
        self.assertEqual(Highlight.Color.YELLOW, highlight.color)


class NoteTests(TestCase):
    def setUp(self):
        self.user = make_user()
        _, _, _, self.verses = make_passage()

    def test_a_user_may_keep_several_notes_on_one_verse(self):
        Note.objects.create(user=self.user, verse=self.verses[0], content='first')
        Note.objects.create(user=self.user, verse=self.verses[0], content='second')
        self.assertEqual(2, Note.objects.count())

    def test_editing_a_note_advances_updated_at(self):
        note = Note.objects.create(user=self.user, verse=self.verses[0], content='draft')
        original = note.updated_at
        note.content = 'revised'
        # Pin a strictly-later save instant: `auto_now` can tie on Windows'
        # coarse (~15ms) clock, and the assertion is about the edit advancing
        # the timestamp, not about how fast the two saves ran.
        later = original + datetime.timedelta(seconds=1)
        with mock.patch('django.utils.timezone.now', return_value=later):
            note.save()
        note.refresh_from_db()
        self.assertGreater(note.updated_at, original)
        self.assertEqual('revised', note.content)


class ReadingHistoryTests(TestCase):
    def test_history_is_appendable_and_stamps_a_local_day(self):
        user = make_user()
        _, _, chapter, _ = make_passage()
        ReadingHistory.objects.create(user=user, chapter=chapter, read_on=app_today())
        ReadingHistory.objects.create(user=user, chapter=chapter, read_on=app_today())
        self.assertEqual(2, ReadingHistory.objects.count())
        self.assertEqual(app_today(), ReadingHistory.objects.first().read_on)
