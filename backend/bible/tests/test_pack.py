"""Tests for `GET /bible/pack/`: a whole translation in one download."""
import json
import shutil
import tempfile
from pathlib import Path
from unittest import mock

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from bible import packs
from bible.tests.base import make_book, make_chapter, make_translation, make_verse


class PackTests(TestCase):

    def setUp(self):
        # Packs are files. Keep each test's in a folder of its own.
        self.folder = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.folder, ignore_errors=True)
        patcher = mock.patch('bible.packs._directory', return_value=self.folder)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.client = APIClient()
        self.web = make_translation()
        # Out of canonical order on purpose, twice over.
        self.john = make_book(self.web, osis_code='John', name='John', book_number=43)
        self.gen = make_book(self.web, osis_code='Gen', name='Genesis', book_number=1)
        for book, numbers in ((self.john, (3, 1)), (self.gen, (1,))):
            for number in numbers:
                chapter = make_chapter(book, number=number, verse_count=2)
                make_verse(chapter, number=2, text=f'{book.name} {number}:2 text.')
                make_verse(chapter, number=1, text=f'{book.name} {number}:1 text.')
        self.url = reverse('bible-pack')

    def pack(self, **params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, 200)
        return json.loads(b''.join(response.streaming_content))

    def test_holds_every_book_chapter_and_verse_in_order(self):
        pack = self.pack(translation='WEB')

        self.assertEqual(pack['translation']['code'], 'WEB')
        self.assertEqual([b['osis'] for b in pack['books']], ['Gen', 'John'])
        john = pack['books'][1]
        self.assertEqual(john['name'], 'John')
        self.assertEqual([c['number'] for c in john['chapters']], [1, 3])
        self.assertEqual([v[0] for v in john['chapters'][0]['verses']], [1, 2])
        self.assertEqual(john['chapters'][0]['verses'][0][2], 'John 1:1 text.')

    def test_the_ids_are_the_ones_lookup_gives(self):
        """A bookmark made online has to find its verse in a chapter read offline."""
        pack = self.pack(translation='WEB')
        lookup = self.client.get(
            reverse('bible-lookup'), {'book': 'John', 'chapter': 3, 'translation': 'WEB'}).data

        chapter = next(c for c in pack['books'][1]['chapters'] if c['number'] == 3)
        self.assertEqual(chapter['id'], str(lookup['verses'][0]['chapter']))
        self.assertEqual(
            [(v[0], v[1], v[2]) for v in chapter['verses']],
            [(v['number'], str(v['id']), v['text']) for v in lookup['verses']],
        )

    def test_is_built_once_and_then_handed_back(self):
        self.pack(translation='WEB')

        with mock.patch('bible.packs.build', side_effect=AssertionError('built twice')):
            self.pack(translation='WEB')

        self.assertEqual(len(list(self.folder.glob('WEB-*.json'))), 1)

    def test_a_reimport_makes_a_new_pack(self):
        first = packs.path_for(self.web)
        self.pack(translation='WEB')

        chapter = make_chapter(self.gen, number=2, verse_count=1)
        make_verse(chapter, number=1, text='A verse added by a re-import.')

        self.assertNotEqual(packs.path_for(self.web), first)
        self.assertIn('A verse added by a re-import.', json.dumps(self.pack(translation='WEB')))

    def test_a_failed_build_leaves_nothing_half_written(self):
        with mock.patch('bible.packs.build', side_effect=RuntimeError('database went away')):
            with self.assertRaises(RuntimeError):
                packs.ensure(self.web)

        self.assertEqual(list(self.folder.iterdir()), [])

    def test_omitting_translation_uses_the_default(self):
        self.assertEqual(self.pack()['translation']['code'], 'WEB')

    def test_needs_no_account(self):
        self.assertEqual(self.client.get(self.url).status_code, 200)

    def test_a_licence_that_forbids_offline_storage_is_refused(self):
        make_translation(code='NIV', is_default=False, is_offline_capable=False,
                         is_public_domain=False)

        response = self.client.get(self.url, {'translation': 'NIV'})

        self.assertEqual(response.status_code, 403)
        self.assertIn('licence', response.data['detail'])
        self.assertEqual(list(self.folder.iterdir()), [])
