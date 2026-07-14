"""Tests for the ScriptureRef parser (`bible/references.py`)."""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from bible.importers import import_translation
from bible.references import format_reference, normalise_token, parse_reference, resolve_book
from bible.models import BibleTranslation


def import_books(*osis_codes, code='WEB'):
    """Import the named books with one chapter of two verses each."""
    import_translation({
        'translation': {'code': code, 'name': code, 'is_public_domain': True,
                        'is_default': True},
        'books': [
            {'osis_code': osis, 'chapters': [['verse one', 'verse two'],
                                             ['verse one', 'verse two']]}
            for osis in osis_codes
        ],
    })
    return BibleTranslation.objects.get(code=code)


class NormaliseTokenTests(TestCase):

    def test_collapses_case_punctuation_and_spacing(self):
        for raw in ['1 Cor.', '1cor', '1 COR', ' 1  cor ']:
            self.assertEqual(normalise_token(raw), '1cor')

    def test_written_and_roman_ordinals_become_digits(self):
        self.assertEqual(normalise_token('First Corinthians'), '1corinthians')
        self.assertEqual(normalise_token('I John'), '1john')
        self.assertEqual(normalise_token('III John'), '3john')

    def test_a_leading_i_that_is_not_an_ordinal_survives(self):
        """'Isaiah' must not be read as 'I saiah' -> '1saiah'."""
        self.assertEqual(normalise_token('Isaiah'), 'isaiah')


class ResolveBookTests(TestCase):

    def test_resolves_full_names_abbreviations_and_aliases(self):
        translation = import_books('John', 'Ps', '1Cor')

        for token in ['John', 'john', 'jn', 'Jn.', 'JHN']:
            self.assertEqual(resolve_book(translation, token).osis_code, 'John', token)
        for token in ['Psalms', 'psalm', 'ps', 'pss']:
            self.assertEqual(resolve_book(translation, token).osis_code, 'Ps', token)
        for token in ['1 Cor', '1cor', 'I Corinthians', 'first corinthians']:
            self.assertEqual(resolve_book(translation, token).osis_code, '1Cor', token)

    def test_resolves_a_unique_prefix(self):
        translation = import_books('Gen')
        self.assertEqual(resolve_book(translation, 'gene').osis_code, 'Gen')

    def test_an_ambiguous_prefix_resolves_to_nothing(self):
        """
        'jo' could be John, Jonah, Joel or Job. Opening the wrong one silently is
        worse than asking the teen to be specific.
        """
        translation = import_books('John', 'Jonah', 'Joel', 'Job')
        self.assertIsNone(resolve_book(translation, 'jo'))

    def test_an_exact_alias_beats_an_ambiguous_prefix(self):
        """'job' is a prefix of nothing else, but is also an exact alias — it must win."""
        translation = import_books('John', 'Jonah', 'Joel', 'Job')
        self.assertEqual(resolve_book(translation, 'job').osis_code, 'Job')

    def test_an_unknown_token_resolves_to_nothing(self):
        translation = import_books('John')
        self.assertIsNone(resolve_book(translation, 'hezekiah'))

    def test_aliases_are_scoped_to_the_translation(self):
        """A book imported into WEB must not resolve against a translation lacking it."""
        web = import_books('John', code='WEB')
        kjv = import_books('Ps', code='KJV')
        self.assertIsNotNone(resolve_book(web, 'jn'))
        self.assertIsNone(resolve_book(kjv, 'jn'))


class ParseReferenceTests(TestCase):

    def setUp(self):
        self.translation = import_books('John', 'Ps', '1Cor', 'Song')

    def assertParses(self, text, osis, chapter, start=None, end=None):
        parsed = parse_reference(text, self.translation)
        self.assertIsNotNone(parsed, f'{text!r} failed to parse')
        self.assertEqual(
            (parsed['osis_code'], parsed['chapter'],
             parsed['start_verse'], parsed['end_verse']),
            (osis, chapter, start, end),
            text,
        )

    def test_parses_the_documented_examples(self):
        """The three forms docs/08 §2 names by example."""
        self.assertParses('jn 3:16', 'John', 3, 16)
        self.assertParses('1 cor 13', '1Cor', 13)
        self.assertParses('ps 23', 'Ps', 23)

    def test_parses_a_verse_range(self):
        self.assertParses('John 3:16-18', 'John', 3, 16, 18)

    def test_parses_a_multi_word_book(self):
        self.assertParses('Song of Solomon 2:1', 'Song', 2, 1)

    def test_accepts_a_dot_verse_separator(self):
        """':' is a long-press away on a phone keyboard; teens type '.'."""
        self.assertParses('jn 3.16', 'John', 3, 16)

    def test_accepts_an_en_dash_range(self):
        """Copy-paste from Word and some phone keyboards produce en dashes."""
        self.assertParses('John 3:16–18', 'John', 3, 16, 18)

    def test_a_backwards_range_collapses_to_the_opening_verse(self):
        self.assertParses('John 3:16-12', 'John', 3, 16, None)

    def test_keyword_input_is_not_a_reference(self):
        """The normal path for search input — None means 'fall through to keyword'."""
        for text in ['verses about fear', 'love', '', '   ', 'hezekiah 3:16']:
            self.assertIsNone(parse_reference(text, self.translation), text)

    def test_parsing_never_raises_on_junk(self):
        for text in ['!!!', '3:16', '99999999999999', 'John', None]:
            parse_reference(text, self.translation)   # must not raise

    def test_an_unimported_passage_is_still_a_valid_address(self):
        """Resolution answers 'is this a book?', not 'do we have the text?'."""
        parsed = parse_reference('John 21:25', self.translation)   # only ch. 1-2 imported
        self.assertEqual(parsed['chapter'], 21)


class FormatReferenceTests(TestCase):

    def test_renders_the_canonical_forms(self):
        self.assertEqual(format_reference('John', 3, 16), 'John 3:16')
        self.assertEqual(format_reference('John', 3, 16, 18), 'John 3:16-18')
        self.assertEqual(format_reference('Psalms', 23), 'Psalms 23')

    def test_a_single_verse_range_renders_as_one_verse(self):
        self.assertEqual(format_reference('John', 3, 16, 16), 'John 3:16')


class LookupEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.translation = import_books('John', 'Ps')
        self.url = reverse('bible-lookup')

    def test_free_text_query_resolves_to_verses(self):
        response = self.client.get(self.url, {'q': 'jn 1:1'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['book'], 'John')
        self.assertEqual(response.data['reference'], 'John 1:1')
        self.assertEqual(len(response.data['verses']), 1)
        self.assertEqual(response.data['verses'][0]['text'], 'verse one')

    def test_whole_chapter_query_returns_the_chapter(self):
        response = self.client.get(self.url, {'q': 'ps 1'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['verses']), 2)

    def test_unparseable_query_is_a_400_flagged_as_unparsed(self):
        """Search relies on this to tell 'not a reference' from 'no such passage'."""
        response = self.client.get(self.url, {'q': 'verses about fear'})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data['parsed'])

    def test_structured_lookup_still_works(self):
        response = self.client.get(self.url, {'book': 'John', 'chapter': 1, 'start_verse': 2})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['reference'], 'John 1:2')
        self.assertEqual(len(response.data['verses']), 1)

    def test_a_valid_address_with_no_imported_text_returns_an_empty_verse_list(self):
        response = self.client.get(self.url, {'q': 'John 21:25'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['verses'], [])
