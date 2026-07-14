"""
The `ScriptureRef` parser — one implementation, everywhere.

`docs/08-bible-experience.md` §12 is explicit: "a single `ScriptureRef`
parser/renderer service handles detection, validation, and linking of references
across all content types — one implementation, everywhere." This is it. The Bible
search field, devotional anchor Scriptures, manual references, podcast show notes
and event theme verses all parse through this module. Nothing else may grow its
own regex.

Parsing is deliberately two-stage:

1. **Shape** (`_REFERENCE_RE`) — pull apart "1 cor 13:4-7" into a book token, a
   chapter and an optional verse range. Pure text work, no database.
2. **Book resolution** (`resolve_book`) — match the book token against the books
   *of a given translation*, using the `name` / `abbreviation` / `alternate_names`
   the importer seeded. Fuzzy matching lives against real rows rather than a
   hard-coded English table, because a Yoruba Bible's books are not matched by
   "jn" and its aliases belong on its own rows (`bible/canon.py`).

A reference is a valid *address* even if the passage is not imported — resolution
answers "is this a book?", not "do we have the text?". Callers that need the text
go on to `services.resolve_reference`.
"""
import re
import unicodedata

from .models import BibleBook

# "1 cor 13:4-7" / "jn 3:16" / "ps 23" / "Song of Solomon 2:1"
#
# The book group is non-greedy and allows a leading ordinal ("1", "2", "3", or a
# written "first"/"second"/"third") plus internal spaces and dots, so "1 Cor.",
# "Song of Solomon" and "1st John" all survive stage one. Chapter/verse
# separators may be ":" or "." ("jn 3.16" is common on phones where ":" is a
# long-press away). Ranges use "-" or an en/em dash, which phone keyboards and
# copy-paste from Word both produce.
_REFERENCE_RE = re.compile(
    r"""
    ^\s*
    (?P<book>
        (?:[1-3]|i{1,3}|first|second|third)?   # optional ordinal prefix
        \s*
        [a-z][a-z.\s]*?                        # the name itself
    )
    \s*
    (?P<chapter>\d{1,3})
    (?:
        \s*[:.]\s*
        (?P<start>\d{1,3})
        (?:\s*[-–—]\s*(?P<end>\d{1,3}))?
    )?
    \s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Written and roman ordinals normalise to digits so "first john", "i john" and
# "1 john" all reduce to the same key as the canon's "1john" alias.
_ORDINALS = {
    'first': '1', 'second': '2', 'third': '3',
    'i': '1', 'ii': '2', 'iii': '3',
}
_ORDINAL_PREFIX_RE = re.compile(
    r'^(first|second|third|i{1,3})\s+(?=[a-z])', re.IGNORECASE
)


def normalise_token(text):
    """
    Reduce a book token to its match key: lowercase, unaccented, no punctuation,
    no spaces, written ordinals as digits.

    "1 Cor." / "1cor" / "I Corinthians" / "first corinthians" all collapse toward
    a comparable key. The canon stores its aliases in exactly this shape, so the
    two sides always meet in the middle.
    """
    if not text:
        return ''
    text = str(text).strip().lower()
    # Strip accents so a copy-pasted "Éxodo" still matches an "exodo" alias.
    text = ''.join(
        ch for ch in unicodedata.normalize('NFKD', text)
        if not unicodedata.combining(ch)
    )
    text = _ORDINAL_PREFIX_RE.sub(lambda m: _ORDINALS[m.group(1).lower()], text)
    return re.sub(r'[^a-z0-9]', '', text)


def _alias_map(translation):
    """
    {normalised alias -> BibleBook} for one translation.

    Built from the rows, not from a constant: `alternate_names` is where the
    importer put each translation's own abbreviations, including the Nigerian
    ones the docs call for (§2).

    A first writer wins on collision — books are walked in canonical order, so
    where two books would claim the same short alias, the earlier book keeps it
    rather than the later one silently stealing it.
    """
    aliases = {}
    books = translation.books.all().order_by('book_number')
    for book in books:
        keys = [book.name, book.abbreviation, book.osis_code]
        keys.extend(book.alternate_names or [])
        for key in keys:
            key = normalise_token(key)
            if key and key not in aliases:
                aliases[key] = book
    return aliases


def resolve_book(translation, token):
    """
    The `BibleBook` a token names, or None.

    Three passes, most confident first:
      1. exact alias match ("jn", "john", "1cor")
      2. unique prefix match ("gene" -> Genesis; "jo" is ambiguous -> None)
      3. give up

    Ambiguity resolves to None rather than to a guess. Silently opening Jonah when
    a teen typed "jo" and meant John is worse than asking them to be specific.
    """
    if translation is None:
        return None
    key = normalise_token(token)
    if not key:
        return None

    aliases = _alias_map(translation)
    if key in aliases:
        return aliases[key]

    matches = {
        book.id: book for alias, book in aliases.items() if alias.startswith(key)
    }
    if len(matches) == 1:
        return next(iter(matches.values()))
    return None


def parse_reference(text, translation):
    """
    Parse free text into a Scripture address, or None if it is not a reference.

    Returns a dict: `{book, osis_code, chapter, start_verse, end_verse}` where
    `book` is a `BibleBook` row and the verse numbers may be None (a whole-chapter
    reference like "ps 23").

    Returning None is the normal path for ordinary search input — "verses about
    fear" is not a malformed reference, it is a keyword query. Callers use None as
    the signal to fall through to keyword search, so this must never raise.
    """
    if not text or translation is None:
        return None

    match = _REFERENCE_RE.match(str(text))
    if not match:
        return None

    book = resolve_book(translation, match.group('book'))
    if book is None:
        return None

    chapter = int(match.group('chapter'))
    start = match.group('start')
    end = match.group('end')
    start_verse = int(start) if start else None
    end_verse = int(end) if end else None

    # "John 3:16-12" is a typo, not a backwards range. Collapse it to the single
    # opening verse rather than resolving to an empty passage.
    if start_verse and end_verse and end_verse < start_verse:
        end_verse = None

    return {
        'book': book,
        'osis_code': book.osis_code,
        'chapter': chapter,
        'start_verse': start_verse,
        'end_verse': end_verse,
    }


def format_reference(book_name, chapter, start_verse=None, end_verse=None):
    """
    Render an address as the canonical human string — "John 3:16", "John 3:16-18",
    "Psalms 23".

    The renderer half of "one implementation, everywhere": the share card, the
    Verse of the Day and the devotional anchor all display references, and they
    must all display them identically.
    """
    reference = f'{book_name} {chapter}'
    if start_verse:
        reference = f'{reference}:{start_verse}'
        if end_verse and end_verse != start_verse:
            reference = f'{reference}-{end_verse}'
    return reference
