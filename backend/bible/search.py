"""
Scripture search.

`docs/08-bible-experience.md` §4 specifies V1 search as "reference parsing +
keyword search within the current translation; results grouped by book". The two
halves are not alternatives the caller chooses between — they are one field that
does the right thing:

    "jn 3:16"          -> a reference. Go straight to the passage.
    "verses about fear" -> keyword. Rank and group.

So `search()` tries the parser first (`bible/references.py` — the one parser) and
only falls through to full-text when the input is not an address. A teen typing
into one box never has to know which kind of search they are doing.

Keyword search runs on a stored `tsvector` with a GIN index rather than `ILIKE`,
which would be a sequential scan over ~31,000 verses per keystroke.
"""
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db.models import F

from . import references
from .models import BibleVerse

DEFAULT_LIMIT = 50
MAX_LIMIT = 200

# Postgres text-search configurations by language. The configuration decides
# stemming and stop-words: under 'english', a search for "loved" finds "love",
# which is most of what makes Scripture search feel intelligent.
#
# 'simple' (no stemming, no stop-words) is the honest fallback for languages
# Postgres has no configuration for — including the Nigerian languages targeted
# for V3 (`docs/02-roadmap.md`). It still matches whole words correctly; it just
# does not stem. Guessing 'english' for Yoruba would stem it into nonsense.
SEARCH_CONFIGS = {
    'en': 'english',
    'fr': 'french',
}
FALLBACK_CONFIG = 'simple'


def search_config(translation):
    """The Postgres text-search configuration for a translation's language."""
    if translation is None:
        return FALLBACK_CONFIG
    return SEARCH_CONFIGS.get((translation.language_code or '').lower(), FALLBACK_CONFIG)


def build_search_vectors(chapter):
    """
    Populate `search_vector` for every verse of one chapter.

    Called by the importer after the chapter's text lands. Done as a single
    `UPDATE ... SET search_vector = to_tsvector(...)` so the vectors are built in
    the database — pulling 31,000 verses into Python to compute them would be
    both slow and pointless.
    """
    config = search_config(chapter.book.translation)
    return (
        BibleVerse.objects
        .filter(chapter=chapter)
        .update(search_vector=SearchVector('text', config=config))
    )


def keyword_search(translation, query, testament=None, book_osis=None, limit=DEFAULT_LIMIT):
    """
    Full-text verse search within one translation, best match first.

    `websearch` query type is deliberate: it gives teens quoted phrases
    ("good shepherd") and `-exclusion` for free, and — unlike `raw` — it cannot
    be made to raise a syntax error by ordinary punctuation. A search box that
    500s on an apostrophe is not a search box.
    """
    config = search_config(translation)
    search_query = SearchQuery(query, config=config, search_type='websearch')

    verses = (
        BibleVerse.objects
        .filter(chapter__book__translation=translation, search_vector=search_query)
        .select_related('chapter', 'chapter__book', 'chapter__book__translation')
        .annotate(rank=SearchRank(F('search_vector'), search_query))
        .order_by('-rank', 'chapter__book__book_number', 'chapter__number', 'number')
    )
    if testament:
        verses = verses.filter(chapter__book__testament=testament)
    if book_osis:
        verses = verses.filter(chapter__book__osis_code__iexact=book_osis)

    return verses[:max(1, min(limit, MAX_LIMIT))]


def group_by_book(verses):
    """
    Group ranked results by book, preserving rank order.

    The docs ask for results "grouped by book" (§4). Books appear in the order
    their best-ranked verse appeared, so the most relevant book leads — grouping
    must not silently re-sort the results into canonical order and bury the best
    match under Genesis.
    """
    groups, index = [], {}
    for verse in verses:
        book = verse.chapter.book
        if book.id not in index:
            index[book.id] = {
                'book': book,
                'osis_code': book.osis_code,
                'name': book.name,
                'testament': book.testament,
                'verses': [],
            }
            groups.append(index[book.id])
        index[book.id]['verses'].append(verse)
    return groups


def search(translation, query, testament=None, book_osis=None, limit=DEFAULT_LIMIT):
    """
    The one search entry point: reference first, keyword second.

    Returns `(kind, payload)` where `kind` is 'reference' or 'keyword':
      * 'reference' -> an ordered `BibleVerse` queryset for the passage
      * 'keyword'   -> a list of book groups from `group_by_book`

    A reference wins even when the passage is not imported. "jn 3:16" is an
    address, and answering it with keyword hits for the word "jn" would be
    nonsense.
    """
    query = (query or '').strip()
    if not query or translation is None:
        return 'keyword', []

    parsed = references.parse_reference(query, translation)
    if parsed is not None:
        from . import services
        verses = services.resolve_reference(
            translation=translation,
            book_osis=parsed['osis_code'],
            chapter_number=parsed['chapter'],
            start_verse_number=parsed['start_verse'],
            end_verse_number=parsed['end_verse'],
        )
        return 'reference', {'parsed': parsed, 'verses': verses}

    verses = keyword_search(
        translation, query, testament=testament, book_osis=book_osis, limit=limit,
    )
    return 'keyword', group_by_book(verses)
