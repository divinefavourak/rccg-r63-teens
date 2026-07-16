"""
Scripture text ingestion.

`02-roadmap.md` lists "Bible text ingestion: WEB and KJV must be sourced,
verified, and structured" as a V1 launch dependency. The schema has existed
since Phase 2A; this is the code that fills it.

Two properties matter more than speed here:

* **Idempotence.** An import that dies halfway through Leviticus must be safe to
  re-run — re-importing updates rows in place rather than duplicating them or
  erroring on the unique constraints. This is what makes ingestion *resumable*,
  which matters because these files are large and the operator running them is a
  content-ops person, not an engineer (`docs/08-bible-experience.md` §10).
* **Bounded memory.** A full Bible is ~31,000 verses. Work happens one chapter at
  a time and rows are written in bulk, so we never build 31,000 ORM objects.

Adding a translation is content ops, not engineering: everything that varies
between translations — licensing, offline-capability, book names — is a field in
the import file, not a branch in this code.
"""
from django.db import transaction
from django.utils import timezone

from .canon import book_meta, canonical_osis
from .models import BibleBook, BibleChapter, BibleTranslation, BibleVerse
from .search import build_search_vectors

VERSE_BATCH_SIZE = 1000

# Fields an import file may set on the translation row. Anything else in the
# file's `translation` object is a typo or a stale key, and we refuse it loudly
# rather than silently importing a Bible with the wrong licence flags — an
# `is_public_domain` typo'd to `public_domain` would default to False and quietly
# suppress the text from offline caching.
TRANSLATION_FIELDS = {
    'name', 'full_name', 'language_code', 'language_name', 'source_type',
    'is_public_domain', 'copyright_notice', 'license_source',
    'attribution_required', 'is_offline_capable', 'is_default', 'sort_order',
    'is_active', 'max_consecutive_verses',
}


class ImportError_(ValueError):
    """A malformed import file. Named with a trailing underscore to avoid
    shadowing the builtin `ImportError`, which means something else entirely."""


def _normalise_chapter(raw, index):
    """
    Accept either compact or explicit chapter form, return `(number, {verse_no: text})`.

    Compact (what most public-domain dumps look like) — position carries the
    numbering:

        ["In the beginning...", "And the earth was..."]   # chapter index+1, verses 1..n

    Explicit — for texts with irregular numbering, or the omitted verses some
    translations carry (e.g. Matthew 17:21), which position alone cannot express:

        {"number": 1, "verses": {"1": "In the beginning...", "3": "..."}}
        {"number": 1, "verses": [{"number": 1, "text": "..."}]}
    """
    if isinstance(raw, list):
        return index + 1, {i + 1: text for i, text in enumerate(raw)}

    if not isinstance(raw, dict):
        raise ImportError_(f'Chapter at position {index} must be a list or an object.')

    try:
        number = int(raw.get('number', index + 1))
    except (TypeError, ValueError):
        raise ImportError_(f'Chapter at position {index} has a non-integer number.')

    verses = raw.get('verses')
    if isinstance(verses, dict):
        pairs = verses.items()
    elif isinstance(verses, list):
        pairs = [(v.get('number'), v.get('text')) for v in verses if isinstance(v, dict)]
    else:
        raise ImportError_(f'Chapter {number} must carry a `verses` list or object.')

    try:
        normalised = {int(n): (text or '') for n, text in pairs}
    except (TypeError, ValueError):
        raise ImportError_(f'Chapter {number} has a non-integer verse number.')
    return number, normalised


@transaction.atomic
def _import_book(translation, raw, position):
    """Import one book. Atomic per book, so a failure mid-Bible leaves whole books behind."""
    osis = canonical_osis(raw.get('osis_code'))
    if osis is None:
        raise ImportError_(
            f'Book at position {position} has an unknown OSIS code '
            f'{raw.get("osis_code")!r}. See bible/canon.py for the 66 valid codes.'
        )

    meta = book_meta(osis)
    # A translation may rename its books ("Johanu") and add its own aliases, but
    # it may not renumber the canon — number and testament define the address.
    meta['name'] = raw.get('name') or meta['name']
    meta['abbreviation'] = raw.get('abbreviation') or meta['abbreviation']

    # Validated as a list before iterating, for the same reason the translation
    # fields are validated: a string here would be walked character by character,
    # quietly seeding single-letter aliases ('j', 'n') into the fuzzy parser. Those
    # would then compete with the real ones and make reference lookup ambiguous —
    # a data-quality failure that only surfaces much later, in the reader.
    aliases = raw.get('alternate_names') or []
    if not isinstance(aliases, list):
        raise ImportError_(
            f'Book {osis}: `alternate_names` must be a list, got '
            f'{type(aliases).__name__}.'
        )
    for raw_alias in aliases:
        alias = str(raw_alias).strip().lower()
        if alias and alias not in meta['alternate_names']:
            meta['alternate_names'].append(alias)

    chapters_raw = raw.get('chapters')
    if not isinstance(chapters_raw, list):
        raise ImportError_(f'Book {osis} must carry a `chapters` list.')

    book, _ = BibleBook.objects.update_or_create(
        translation=translation,
        osis_code=osis,
        defaults={
            'book_number': meta['book_number'],
            'name': meta['name'],
            'abbreviation': meta['abbreviation'],
            'testament': meta['testament'],
            'alternate_names': meta['alternate_names'],
            'chapter_count': len(chapters_raw),
        },
    )

    verses_written = 0
    for index, raw_chapter in enumerate(chapters_raw):
        number, verse_texts = _normalise_chapter(raw_chapter, index)
        chapter, _ = BibleChapter.objects.update_or_create(
            book=book, number=number, defaults={'verse_count': len(verse_texts)},
        )
        written = _import_verses(chapter, verse_texts)
        verses_written += written
        if written:
            # Only when the text actually moved. A no-op re-import of a whole
            # Bible would otherwise issue ~1,200 pointless UPDATE statements.
            build_search_vectors(chapter)

    return book, verses_written


def _import_verses(chapter, verse_texts):
    """
    Upsert one chapter's verses.

    Split into inserts and updates against what is already there rather than
    delete-and-recreate: `Bookmark`, `Highlight` and `Note` hold foreign keys to
    `BibleVerse`, so deleting a verse row on re-import would cascade away a teen's
    private notes. Re-importing a translation must never cost a user their
    annotations.
    """
    existing = {v.number: v for v in BibleVerse.objects.filter(chapter=chapter)}
    # `bulk_update` bypasses `save()`, so the `auto_now` on `updated_at` never
    # fires — a corrected verse would keep its original timestamp. Stamp it here.
    now = timezone.now()

    to_create, to_update = [], []
    for number, text in sorted(verse_texts.items()):
        text = text or ''
        current = existing.get(number)
        if current is None:
            to_create.append(BibleVerse(chapter=chapter, number=number, text=text))
        elif current.text != text:
            current.text = text
            current.updated_at = now
            to_update.append(current)

    if to_create:
        BibleVerse.objects.bulk_create(to_create, batch_size=VERSE_BATCH_SIZE)
    if to_update:
        BibleVerse.objects.bulk_update(
            to_update, ['text', 'updated_at'], batch_size=VERSE_BATCH_SIZE,
        )
    return len(to_create) + len(to_update)


def import_translation(payload, progress=None):
    """
    Import one translation from a parsed import file. Idempotent.

    `progress` is an optional callable taking a message — the management command
    passes one so an operator watching a 66-book import sees it moving.

    Returns a stats dict: books, chapters, verses_written.
    """
    if not isinstance(payload, dict):
        raise ImportError_('The import file must be a JSON object.')

    meta = payload.get('translation')
    if not isinstance(meta, dict) or not meta.get('code'):
        raise ImportError_('The import file must carry a `translation` object with a `code`.')

    unknown = set(meta) - TRANSLATION_FIELDS - {'code'}
    if unknown:
        raise ImportError_(
            f'Unknown translation field(s): {", ".join(sorted(unknown))}. '
            f'Allowed: {", ".join(sorted(TRANSLATION_FIELDS))}.'
        )

    books_raw = payload.get('books')
    if not isinstance(books_raw, list) or not books_raw:
        raise ImportError_('The import file must carry a non-empty `books` list.')

    code = str(meta['code']).strip().upper()
    defaults = {k: v for k, v in meta.items() if k in TRANSLATION_FIELDS}

    # `is_default` is guarded by a partial unique constraint (one default across
    # the table), so importing a new default must stand the old one down first —
    # otherwise the constraint fires and a routine import fails.
    with transaction.atomic():
        if defaults.get('is_default'):
            BibleTranslation.objects.filter(is_default=True).exclude(
                code=code).update(is_default=False)
        translation, created = BibleTranslation.objects.update_or_create(
            code=code, defaults=defaults,
        )

    stats = {'translation': translation, 'created': created, 'books': 0,
             'chapters': 0, 'verses_written': 0}

    for position, raw_book in enumerate(books_raw):
        if not isinstance(raw_book, dict):
            raise ImportError_(f'Book at position {position} must be an object.')
        book, verses_written = _import_book(translation, raw_book, position)
        stats['books'] += 1
        stats['chapters'] += book.chapter_count
        stats['verses_written'] += verses_written
        if progress:
            progress(f'{book.name}: {book.chapter_count} chapters, {verses_written} verses written')

    return stats
