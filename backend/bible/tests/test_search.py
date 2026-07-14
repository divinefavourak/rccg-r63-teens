"""Tests for Scripture search (`bible/search.py`)."""
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from bible import search
from bible.importers import import_translation
from bible.models import BibleTranslation, BibleVerse


def import_fixture():
    """A small, real-text corpus — the assertions below depend on actual wording."""
    import_translation({
        'translation': {'code': 'WEB', 'name': 'World English Bible',
                        'language_code': 'en', 'is_public_domain': True,
                        'is_default': True},
        'books': [
            {'osis_code': 'John', 'chapters': [[
                'In the beginning was the Word.',
                'For God so loved the world, that he gave his one and only Son.',
                'God is love, and he who remains in love remains in God.',
            ]]},
            {'osis_code': 'Ps', 'chapters': [[
                'Yahweh is my shepherd; I shall lack nothing.',
                'He makes me lie down in green pastures.',
                'Though I walk through the valley of the shadow of death, '
                'I will fear no evil.',
            ]]},
            {'osis_code': '1Cor', 'chapters': [[
                'Love is patient and is kind.',
                'Love never fails.',
            ]]},
        ],
    })
    return BibleTranslation.objects.get(code='WEB')


class SearchConfigTests(TestCase):

    def test_english_translations_get_the_english_stemmer(self):
        translation = import_fixture()
        self.assertEqual(search.search_config(translation), 'english')

    def test_an_unsupported_language_falls_back_to_simple(self):
        """Guessing 'english' for Yoruba would stem it into nonsense."""
        translation = BibleTranslation.objects.create(
            code='YOR', name='Yoruba', language_code='yo', is_public_domain=True,
        )
        self.assertEqual(search.search_config(translation), 'simple')


class KeywordSearchTests(TestCase):

    def setUp(self):
        self.translation = import_fixture()

    def references_for(self, query, **kwargs):
        verses = search.keyword_search(self.translation, query, **kwargs)
        return [v.reference for v in verses]

    def test_finds_verses_containing_the_term(self):
        self.assertIn('John 1:2', self.references_for('loved'))

    def test_stemming_matches_word_forms(self):
        """The point of the 'english' config: 'love' must find 'loved'."""
        results = self.references_for('love')
        self.assertIn('John 1:2', results)      # "loved"
        self.assertIn('1 Corinthians 1:1', results)   # "Love"

    def test_multiple_terms_are_required_not_optional(self):
        """websearch semantics: 'green pastures' means both words."""
        self.assertEqual(self.references_for('green pastures'), ['Psalms 1:2'])
        self.assertEqual(self.references_for('green elephants'), [])

    def test_a_quoted_phrase_matches_as_a_phrase(self):
        self.assertEqual(self.references_for('"shadow of death"'), ['Psalms 1:3'])

    def test_punctuation_does_not_raise(self):
        """A search box that 500s on an apostrophe is not a search box."""
        for query in ["shepherd's", 'love!', '(love)', 'a & b', "don't"]:
            search.keyword_search(self.translation, query)   # must not raise

    def test_no_match_returns_empty(self):
        self.assertEqual(self.references_for('elephants'), [])

    def test_filters_by_testament(self):
        self.assertEqual(self.references_for('love', testament='old'), [])
        self.assertTrue(self.references_for('love', testament='new'))

    def test_filters_by_book(self):
        self.assertEqual(self.references_for('love', book_osis='1Cor'),
                         ['1 Corinthians 1:1', '1 Corinthians 1:2'])

    def test_search_is_scoped_to_one_translation(self):
        import_translation({
            'translation': {'code': 'KJV', 'name': 'King James', 'language_code': 'en',
                            'is_public_domain': True},
            'books': [{'osis_code': 'John', 'chapters': [['For God so loved the world']]}],
        })
        kjv = BibleTranslation.objects.get(code='KJV')

        self.assertEqual(len(search.keyword_search(kjv, 'loved')), 1)
        self.assertTrue(
            all(v.chapter.book.translation_id == kjv.id
                for v in search.keyword_search(kjv, 'loved'))
        )

    def test_limit_is_capped(self):
        verses = search.keyword_search(self.translation, 'love', limit=10_000)
        self.assertLessEqual(len(verses), search.MAX_LIMIT)


class GroupByBookTests(TestCase):

    def setUp(self):
        self.translation = import_fixture()

    def test_groups_hits_under_their_book(self):
        groups = search.group_by_book(search.keyword_search(self.translation, 'love'))

        by_osis = {g['osis_code']: g for g in groups}
        self.assertIn('1Cor', by_osis)
        self.assertIn('John', by_osis)
        self.assertEqual(len(by_osis['1Cor']['verses']), 2)

    def test_grouping_preserves_rank_order_of_books(self):
        """
        Grouping must not silently re-sort into canonical order and bury the best
        match under Genesis.
        """
        verses = list(search.keyword_search(self.translation, 'love'))
        groups = search.group_by_book(verses)

        first_hit_book = verses[0].chapter.book.osis_code
        self.assertEqual(groups[0]['osis_code'], first_hit_book)


class SearchEntryPointTests(TestCase):

    def setUp(self):
        self.translation = import_fixture()

    def test_a_reference_query_returns_the_passage(self):
        kind, payload = search.search(self.translation, 'jn 1:2')

        self.assertEqual(kind, 'reference')
        self.assertEqual([v.number for v in payload['verses']], [2])

    def test_a_keyword_query_returns_groups(self):
        kind, payload = search.search(self.translation, 'shepherd')

        self.assertEqual(kind, 'keyword')
        self.assertEqual(payload[0]['osis_code'], 'Ps')

    def test_a_reference_wins_even_when_the_passage_is_not_imported(self):
        """"jn 21:25" is an address. Keyword-matching the word "jn" would be nonsense."""
        kind, payload = search.search(self.translation, 'jn 21:25')

        self.assertEqual(kind, 'reference')
        self.assertEqual(list(payload['verses']), [])

    def test_an_empty_query_is_an_empty_keyword_result(self):
        self.assertEqual(search.search(self.translation, '   '), ('keyword', []))


class SearchEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.translation = import_fixture()
        self.url = reverse('bible-search')

    def test_keyword_search_returns_grouped_results(self):
        response = self.client.get(self.url, {'q': 'love'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kind'], 'keyword')
        self.assertTrue(response.data['results'])
        self.assertEqual(
            response.data['total'],
            sum(len(g['verses']) for g in response.data['results']),
        )

    def test_reference_search_returns_the_passage(self):
        response = self.client.get(self.url, {'q': 'jn 1:2'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kind'], 'reference')
        self.assertEqual(response.data['reference'], 'John 1:2')
        self.assertEqual(len(response.data['verses']), 1)

    def test_search_is_public(self):
        """Reading Scripture never requires an account."""
        self.assertEqual(self.client.get(self.url, {'q': 'love'}).status_code, 200)

    def test_missing_query_is_a_400(self):
        self.assertEqual(self.client.get(self.url).status_code, 400)


class RebuildSearchCommandTests(TestCase):

    def test_rebuild_repopulates_cleared_vectors(self):
        translation = import_fixture()
        BibleVerse.objects.update(search_vector=None)
        self.assertEqual(len(search.keyword_search(translation, 'love')), 0)

        call_command('rebuild_bible_search', '--translation', 'WEB')

        self.assertTrue(search.keyword_search(translation, 'love'))

    def test_importer_populates_the_index(self):
        """The normal path: ingestion builds the index, no rebuild needed."""
        translation = import_fixture()
        self.assertTrue(search.keyword_search(translation, 'shepherd'))
