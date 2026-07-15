"""Tests for the flat-verse-list -> import-format converter (`convert_bible`)."""
import json
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from bible.importers import import_translation
from bible.models import BibleTranslation, BibleVerse


def flat_source(**meta_overrides):
    """A minimal flat-format Bible: Genesis 1:1-2 and John 1:1, with a pilcrow."""
    metadata = {
        'shortname': 'KJV',
        'name': 'Authorized King James Version',
        'lang_short': 'en',
        'citation_limit': 0,
        'copyright': 0,
        'restrict': 0,
    }
    metadata.update(meta_overrides)
    return {
        'metadata': metadata,
        'verses': [
            {'book': 1, 'chapter': 1, 'verse': 1,
             'text': '¶ In the beginning God created the heaven and the earth.'},
            {'book': 1, 'chapter': 1, 'verse': 2, 'text': 'And the earth was...'},
            {'book': 43, 'chapter': 1, 'verse': 1, 'text': 'In the beginning was the Word.'},
        ],
    }


class ConvertBibleTests(TestCase):

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def _write(self, data):
        path = self.tmp / 'source.json'
        path.write_text(json.dumps(data), encoding='utf-8')
        return str(path)

    def _convert(self, data, *args):
        out = self.tmp / 'out.json'
        call_command('convert_bible', self._write(data), '--out', str(out), *args)
        return json.loads(out.read_text(encoding='utf-8'))

    def test_flat_list_becomes_nested_books(self):
        payload = self._convert(flat_source())

        self.assertEqual(payload['translation']['code'], 'KJV')
        osis = [b['osis_code'] for b in payload['books']]
        self.assertEqual(osis, ['Gen', 'John'])          # canonical order
        gen = payload['books'][0]
        self.assertEqual(len(gen['chapters'][0]), 2)     # Gen 1 has two verses

    def test_book_numbers_map_to_osis_via_the_canon(self):
        payload = self._convert(flat_source())

        self.assertEqual(payload['books'][0]['osis_code'], 'Gen')   # book 1
        self.assertEqual(payload['books'][1]['osis_code'], 'John')  # book 43

    def test_pilcrows_are_stripped_but_text_is_kept(self):
        payload = self._convert(flat_source())

        self.assertEqual(
            payload['books'][0]['chapters'][0][0],
            'In the beginning God created the heaven and the earth.',
        )

    def test_public_domain_is_inferred_from_zeroish_copyright(self):
        payload = self._convert(flat_source())

        self.assertTrue(payload['translation']['is_public_domain'])

    def test_a_licensed_source_is_not_marked_public_domain(self):
        payload = self._convert(flat_source(copyright='© 2020 Someone', restrict=1))

        self.assertFalse(payload['translation']['is_public_domain'])
        self.assertTrue(payload['translation']['attribution_required'])

    def test_the_operator_can_force_public_domain_off(self):
        payload = self._convert(flat_source(), '--not-public-domain')

        self.assertFalse(payload['translation']['is_public_domain'])

    def test_a_positive_citation_limit_becomes_a_verse_cap(self):
        payload = self._convert(flat_source(citation_limit=5))

        self.assertEqual(payload['translation']['max_consecutive_verses'], 5)

    def test_a_zero_citation_limit_sets_no_cap(self):
        payload = self._convert(flat_source(citation_limit=0))

        self.assertNotIn('max_consecutive_verses', payload['translation'])

    def test_non_canonical_book_numbers_are_skipped(self):
        """Some dumps append apocrypha as book 67+; those cannot map to the 66-book canon."""
        data = flat_source()
        data['verses'].append({'book': 70, 'chapter': 1, 'verse': 1, 'text': 'Tobit...'})

        payload = self._convert(data)

        self.assertEqual([b['osis_code'] for b in payload['books']], ['Gen', 'John'])

    def test_missing_shortname_requires_an_explicit_code(self):
        data = flat_source()
        del data['metadata']['shortname']

        with self.assertRaisesMessage(CommandError, '--code'):
            self._convert(data)

    def test_a_source_with_no_verses_is_rejected(self):
        with self.assertRaisesMessage(CommandError, 'verses'):
            self._convert({'metadata': {'shortname': 'X'}, 'verses': []})

    def test_the_converted_file_actually_imports(self):
        """The whole point: convert then import must round-trip into real rows."""
        payload = self._convert(flat_source(), '--default')

        import_translation(payload)

        translation = BibleTranslation.objects.get(code='KJV')
        self.assertTrue(translation.is_default)
        self.assertTrue(translation.is_public_domain)
        self.assertEqual(
            BibleVerse.objects.filter(chapter__book__translation=translation).count(),
            3,
        )
        john = BibleVerse.objects.get(
            chapter__book__osis_code='John', chapter__number=1, number=1)
        self.assertEqual(john.text, 'In the beginning was the Word.')
