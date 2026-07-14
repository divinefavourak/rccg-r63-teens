"""
The biblical canon as data: the translation-agnostic address space.

`BibleBook.osis_code` is the address that lets the reader hold its place when a
teen switches translations (`docs/08-bible-experience.md` §10) — the same
`osis_code` is looked up in the target translation. That only works if every
importer agrees on the codes, so they live here, once, rather than being
re-derived per import.

`alternate_names` feeds the fuzzy reference parser the docs require, "including
the common Nigerian abbreviations" (§2). They are stored on the row rather than
hard-coded in the parser because a non-English translation needs its *own*
aliases — a Yoruba Bible's book of John is not matched by "jn".

Book *names* here are English defaults. An import file may override the name and
aliases per book; the canonical code, number and testament may not be overridden,
because they define the address, not the presentation.
"""
from .models import Testament

OLD, NEW = Testament.OLD, Testament.NEW

# (osis_code, book_number, name, abbreviation, testament, alternate_names)
#
# `alternate_names` are lowercase and punctuation-free; the parser normalises its
# input the same way before matching, so "1 Cor." and "1cor" both land on 1Cor.
CANON = [
    ('Gen', 1, 'Genesis', 'Gen', OLD, ['gen', 'ge', 'gn']),
    ('Exod', 2, 'Exodus', 'Exod', OLD, ['exod', 'ex', 'exo']),
    ('Lev', 3, 'Leviticus', 'Lev', OLD, ['lev', 'le', 'lv']),
    ('Num', 4, 'Numbers', 'Num', OLD, ['num', 'nu', 'nm', 'nb']),
    ('Deut', 5, 'Deuteronomy', 'Deut', OLD, ['deut', 'dt', 'deu']),
    ('Josh', 6, 'Joshua', 'Josh', OLD, ['josh', 'jos', 'jsh']),
    ('Judg', 7, 'Judges', 'Judg', OLD, ['judg', 'jdg', 'jg', 'jdgs']),
    ('Ruth', 8, 'Ruth', 'Ruth', OLD, ['ruth', 'rth', 'ru']),
    ('1Sam', 9, '1 Samuel', '1 Sam', OLD, ['1sam', '1sa', '1s', 'first samuel']),
    ('2Sam', 10, '2 Samuel', '2 Sam', OLD, ['2sam', '2sa', '2s', 'second samuel']),
    ('1Kgs', 11, '1 Kings', '1 Kgs', OLD, ['1kgs', '1ki', '1k', 'first kings']),
    ('2Kgs', 12, '2 Kings', '2 Kgs', OLD, ['2kgs', '2ki', '2k', 'second kings']),
    ('1Chr', 13, '1 Chronicles', '1 Chr', OLD, ['1chr', '1ch', 'first chronicles']),
    ('2Chr', 14, '2 Chronicles', '2 Chr', OLD, ['2chr', '2ch', 'second chronicles']),
    ('Ezra', 15, 'Ezra', 'Ezra', OLD, ['ezra', 'ezr', 'ez']),
    ('Neh', 16, 'Nehemiah', 'Neh', OLD, ['neh', 'ne']),
    ('Esth', 17, 'Esther', 'Esth', OLD, ['esth', 'est', 'es']),
    ('Job', 18, 'Job', 'Job', OLD, ['job', 'jb']),
    ('Ps', 19, 'Psalms', 'Ps', OLD, ['ps', 'psa', 'psalm', 'psalms', 'pslm', 'pss']),
    ('Prov', 20, 'Proverbs', 'Prov', OLD, ['prov', 'pro', 'prv', 'pr']),
    ('Eccl', 21, 'Ecclesiastes', 'Eccl', OLD, ['eccl', 'ecc', 'ec', 'qoh']),
    ('Song', 22, 'Song of Solomon', 'Song', OLD,
     ['song', 'sos', 'song of songs', 'song of solomon', 'canticles']),
    ('Isa', 23, 'Isaiah', 'Isa', OLD, ['isa', 'is']),
    ('Jer', 24, 'Jeremiah', 'Jer', OLD, ['jer', 'je', 'jr']),
    ('Lam', 25, 'Lamentations', 'Lam', OLD, ['lam', 'la']),
    ('Ezek', 26, 'Ezekiel', 'Ezek', OLD, ['ezek', 'eze', 'ezk']),
    ('Dan', 27, 'Daniel', 'Dan', OLD, ['dan', 'da', 'dn']),
    ('Hos', 28, 'Hosea', 'Hos', OLD, ['hos', 'ho']),
    ('Joel', 29, 'Joel', 'Joel', OLD, ['joel', 'jol', 'jl']),
    ('Amos', 30, 'Amos', 'Amos', OLD, ['amos', 'am']),
    ('Obad', 31, 'Obadiah', 'Obad', OLD, ['obad', 'oba', 'ob']),
    ('Jonah', 32, 'Jonah', 'Jonah', OLD, ['jonah', 'jon', 'jnh']),
    ('Mic', 33, 'Micah', 'Mic', OLD, ['mic', 'mc']),
    ('Nah', 34, 'Nahum', 'Nah', OLD, ['nah', 'na']),
    ('Hab', 35, 'Habakkuk', 'Hab', OLD, ['hab', 'hb']),
    ('Zeph', 36, 'Zephaniah', 'Zeph', OLD, ['zeph', 'zep', 'zp']),
    ('Hag', 37, 'Haggai', 'Hag', OLD, ['hag', 'hg']),
    ('Zech', 38, 'Zechariah', 'Zech', OLD, ['zech', 'zec', 'zc']),
    ('Mal', 39, 'Malachi', 'Mal', OLD, ['mal', 'ml']),
    ('Matt', 40, 'Matthew', 'Matt', NEW, ['matt', 'mat', 'mt']),
    ('Mark', 41, 'Mark', 'Mark', NEW, ['mark', 'mrk', 'mk', 'mr']),
    ('Luke', 42, 'Luke', 'Luke', NEW, ['luke', 'luk', 'lk']),
    ('John', 43, 'John', 'John', NEW, ['john', 'jhn', 'jn', 'joh']),
    ('Acts', 44, 'Acts', 'Acts', NEW, ['acts', 'act', 'ac']),
    ('Rom', 45, 'Romans', 'Rom', NEW, ['rom', 'ro', 'rm']),
    ('1Cor', 46, '1 Corinthians', '1 Cor', NEW, ['1cor', '1co', 'first corinthians']),
    ('2Cor', 47, '2 Corinthians', '2 Cor', NEW, ['2cor', '2co', 'second corinthians']),
    ('Gal', 48, 'Galatians', 'Gal', NEW, ['gal', 'ga']),
    ('Eph', 49, 'Ephesians', 'Eph', NEW, ['eph', 'ep', 'ephes']),
    ('Phil', 50, 'Philippians', 'Phil', NEW, ['phil', 'php', 'pp']),
    ('Col', 51, 'Colossians', 'Col', NEW, ['col', 'co']),
    ('1Thess', 52, '1 Thessalonians', '1 Thess', NEW,
     ['1thess', '1th', '1thes', 'first thessalonians']),
    ('2Thess', 53, '2 Thessalonians', '2 Thess', NEW,
     ['2thess', '2th', '2thes', 'second thessalonians']),
    ('1Tim', 54, '1 Timothy', '1 Tim', NEW, ['1tim', '1ti', 'first timothy']),
    ('2Tim', 55, '2 Timothy', '2 Tim', NEW, ['2tim', '2ti', 'second timothy']),
    ('Titus', 56, 'Titus', 'Titus', NEW, ['titus', 'tit', 'ti']),
    ('Phlm', 57, 'Philemon', 'Phlm', NEW, ['phlm', 'phm', 'philem']),
    ('Heb', 58, 'Hebrews', 'Heb', NEW, ['heb', 'hb']),
    ('Jas', 59, 'James', 'Jas', NEW, ['jas', 'jam', 'jm', 'james']),
    ('1Pet', 60, '1 Peter', '1 Pet', NEW, ['1pet', '1pe', '1pt', 'first peter']),
    ('2Pet', 61, '2 Peter', '2 Pet', NEW, ['2pet', '2pe', '2pt', 'second peter']),
    ('1John', 62, '1 John', '1 John', NEW, ['1john', '1jn', '1jo', 'first john']),
    ('2John', 63, '2 John', '2 John', NEW, ['2john', '2jn', '2jo', 'second john']),
    ('3John', 64, '3 John', '3 John', NEW, ['3john', '3jn', '3jo', 'third john']),
    ('Jude', 65, 'Jude', 'Jude', NEW, ['jude', 'jud', 'jd']),
    ('Rev', 66, 'Revelation', 'Rev', NEW,
     ['rev', 're', 'revelation', 'revelations', 'apocalypse']),
]

BOOKS_BY_OSIS = {entry[0]: entry for entry in CANON}

# Case-insensitive lookup, since import files spell OSIS codes inconsistently
# ("1cor", "1Cor", "1COR") and rejecting an import over letter case would be
# hostile for what is meant to be a content-ops task.
_BOOKS_BY_OSIS_LOWER = {osis.lower(): osis for osis in BOOKS_BY_OSIS}


def canonical_osis(code):
    """The canonical spelling of an OSIS code, or None if it is not in the canon."""
    if not code:
        return None
    return _BOOKS_BY_OSIS_LOWER.get(str(code).strip().lower())


def book_meta(osis_code):
    """
    Canonical metadata for a book as a dict, or None.

    Returns a fresh dict each call, and a *copy* of `alternate_names` — callers
    (the importer merges file-supplied aliases into it) must not be able to
    mutate the module-level canon.
    """
    canonical = canonical_osis(osis_code)
    if canonical is None:
        return None
    osis, number, name, abbreviation, testament, aliases = BOOKS_BY_OSIS[canonical]
    return {
        'osis_code': osis,
        'book_number': number,
        'name': name,
        'abbreviation': abbreviation,
        'testament': testament,
        'alternate_names': list(aliases),
    }
