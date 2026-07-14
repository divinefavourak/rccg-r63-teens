"""Tests for Scripture text ingestion (`bible/importers.py`)."""
import json
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from bible.importers import ImportError_, import_translation
from bible.models import BibleBook, BibleChapter, BibleTranslation, BibleVerse, Note, Testament

from .base import make_user


def payload(**overrides):
    """A minimal but valid two-book import file."""
    data = {
        'translation': {
            'code': 'WEB',
            'name': 'World English Bible',
            'is_public_domain': True,
            'is_offline_capable': True,
            'is_default': True,
        },
        'books': [
            {
                'osis_code': 'John',
                # Compact form: position carries chapter and verse numbering.
                'chapters': [
                    ['John 1:1 text', 'John 1:2 text'],
                    ['John 2:1 text'],
                ],
            },
            {
                'osis_code': 'Ps',
                'chapters': [['Psalm 1:1 text']],
            },
        ],
    }
    data.update(overrides)
    return data


class ImportTranslationTests(TestCase):

    def test_imports_translation_books_chapters_and_verses(self):
        stats = import_translation(payload())

        translation = BibleTranslation.objects.get(code='WEB')
        self.assertTrue(stats['created'])
        self.assertTrue(translation.is_default)
        self.assertEqual(stats['books'], 2)
        self.assertEqual(stats['chapters'], 3)
        self.assertEqual(stats['verses_written'], 4)

        john = BibleBook.objects.get(translation=translation, osis_code='John')
        self.assertEqual(john.book_number, 43)          # from the canon, not the file
        self.assertEqual(john.testament, Testament.NEW)
        self.assertEqual(john.chapter_count, 2)
        self.assertIn('jn', john.alternate_names)       # fuzzy-parser aliases seeded

        chapter_one = BibleChapter.objects.get(book=john, number=1)
        self.assertEqual(chapter_one.verse_count, 2)
        self.assertEqual(
            list(chapter_one.verses.order_by('number').values_list('number', 'text')),
            [(1, 'John 1:1 text'), (2, 'John 1:2 text')],
        )

    def test_book_number_and_testament_come_from_the_canon_not_the_file(self):
        """A file may rename a book, but it may not renumber the canon."""
        data = payload()
        data['books'][0]['name'] = 'Johanu'
        data['books'][0]['book_number'] = 1      # ignored
        data['books'][0]['testament'] = 'old'    # ignored
        data['books'][0]['alternate_names'] = ['Johanu']

        import_translation(data)

        john = BibleBook.objects.get(osis_code='John')
        self.assertEqual(john.name, 'Johanu')            # presentation: overridable
        self.assertEqual(john.book_number, 43)           # address: not overridable
        self.assertEqual(john.testament, Testament.NEW)
        self.assertIn('johanu', john.alternate_names)    # merged, lowercased
        self.assertIn('jn', john.alternate_names)        # canon aliases retained

    def test_explicit_chapter_form_supports_irregular_verse_numbers(self):
        """Some translations omit verses (e.g. Matthew 17:21); position alone can't say so."""
        data = payload(books=[{
            'osis_code': 'Matt',
            'chapters': [{'number': 17, 'verses': {'20': 'v20 text', '22': 'v22 text'}}],
        }])

        import_translation(data)

        chapter = BibleChapter.objects.get(book__osis_code='Matt', number=17)
        self.assertEqual(
            list(chapter.verses.order_by('number').values_list('number', flat=True)),
            [20, 22],
        )

    def test_reimport_is_idempotent(self):
        import_translation(payload())
        import_translation(payload())

        self.assertEqual(BibleTranslation.objects.count(), 1)
        self.assertEqual(BibleBook.objects.count(), 2)
        self.assertEqual(BibleChapter.objects.count(), 3)
        self.assertEqual(BibleVerse.objects.count(), 4)

    def test_reimport_writes_only_changed_verses(self):
        import_translation(payload())

        data = payload()
        data['books'][0]['chapters'][0][1] = 'John 1:2 corrected'
        stats = import_translation(data)

        self.assertEqual(stats['verses_written'], 1)
        verse = BibleVerse.objects.get(chapter__book__osis_code='John',
                                       chapter__number=1, number=2)
        self.assertEqual(verse.text, 'John 1:2 corrected')

    def test_reimport_preserves_a_users_private_notes(self):
        """
        The reason verses are upserted rather than deleted and recreated.

        Note/Highlight/Bookmark cascade from BibleVerse, so a delete-and-recreate
        importer would wipe a teen's private annotations on every text correction.
        """
        import_translation(payload())
        verse = BibleVerse.objects.get(chapter__book__osis_code='John',
                                       chapter__number=1, number=1)
        user = make_user()
        note = Note.objects.create(user=user, verse=verse, content='This is the one.')

        data = payload()
        data['books'][0]['chapters'][0][0] = 'John 1:1 corrected'
        import_translation(data)

        note.refresh_from_db()
        self.assertEqual(note.content, 'This is the one.')
        self.assertEqual(note.verse_id, verse.id)          # same row, corrected text
        verse.refresh_from_db()
        self.assertEqual(verse.text, 'John 1:1 corrected')

    def test_importing_a_new_default_stands_down_the_previous_one(self):
        import_translation(payload())

        kjv = payload()
        kjv['translation'] = {
            'code': 'KJV', 'name': 'King James Version',
            'is_public_domain': True, 'is_default': True,
        }
        import_translation(kjv)

        self.assertFalse(BibleTranslation.objects.get(code='WEB').is_default)
        self.assertTrue(BibleTranslation.objects.get(code='KJV').is_default)
        self.assertEqual(BibleTranslation.objects.filter(is_default=True).count(), 1)

    def test_a_string_of_alternate_names_is_rejected(self):
        """
        A bare string would be iterated character by character, seeding 'j' and 'n'
        as aliases. Those compete with the real ones and make reference lookup
        ambiguous — corruption that only surfaces later, in the reader.
        """
        data = payload()
        data['books'][0]['alternate_names'] = 'jn'      # should have been ['jn']

        with self.assertRaisesMessage(ImportError_, 'must be a list'):
            import_translation(data)

    def test_unknown_osis_code_is_rejected(self):
        data = payload(books=[{'osis_code': 'Hezekiah', 'chapters': [['text']]}])
        with self.assertRaisesMessage(ImportError_, 'Hezekiah'):
            import_translation(data)

    def test_osis_codes_are_matched_case_insensitively(self):
        data = payload(books=[{'osis_code': '1cor', 'chapters': [['text']]}])
        import_translation(data)
        self.assertTrue(BibleBook.objects.filter(osis_code='1Cor').exists())

    def test_unknown_translation_field_is_rejected(self):
        """A typo'd licence flag must fail loudly, not import a mislicensed Bible."""
        data = payload()
        data['translation']['public_domain'] = True     # typo for is_public_domain
        with self.assertRaisesMessage(ImportError_, 'public_domain'):
            import_translation(data)

    def test_missing_translation_or_books_is_rejected(self):
        with self.assertRaises(ImportError_):
            import_translation({'books': []})
        with self.assertRaises(ImportError_):
            import_translation({'translation': {'code': 'WEB'}, 'books': []})


class ImportBibleCommandTests(TestCase):

    def _write(self, data):
        path = Path(tempfile.mkdtemp()) / 'translation.json'
        path.write_text(json.dumps(data), encoding='utf-8')
        return str(path)

    def test_command_imports_a_file(self):
        call_command('import_bible', self._write(payload()), '--quiet')

        self.assertEqual(BibleVerse.objects.count(), 4)
        self.assertTrue(BibleTranslation.objects.filter(code='WEB', is_default=True).exists())

    def test_command_reports_a_malformed_file_as_a_command_error(self):
        data = payload(books=[{'osis_code': 'Hezekiah', 'chapters': [['t']]}])
        with self.assertRaises(CommandError):
            call_command('import_bible', self._write(data), '--quiet')

    def test_command_errors_on_a_missing_file(self):
        with self.assertRaises(CommandError):
            call_command('import_bible', 'no/such/file.json', '--quiet')

    def test_command_errors_cleanly_on_an_unreadable_path(self):
        """A directory passed by mistake is operator error, not a traceback."""
        with self.assertRaises(CommandError):
            call_command('import_bible', tempfile.mkdtemp(), '--quiet')
