"""
Convert a flat-verse-list Bible JSON into the import format `import_bible` expects.

    python manage.py convert_bible kjv.json --out kjv-import.json --default
    python manage.py import_bible kjv-import.json

Public-domain Bible dumps are almost always distributed as a flat list of verses —
one object per verse with `book`/`chapter`/`verse`/`text` — while `import_bible`
takes the nested `{translation, books:[{osis_code, chapters:[...]}]}` shape
(`bible/importers.py`). This bridges the two, so getting a translation in is a
conversion step, not a hand edit of a 6 MB file.

Kept as a *separate* command rather than folded into `import_bible` on purpose: the
converted file is worth looking at before you import it — this is a licence-sensitive
step, and an operator should be able to eyeball the copyright line and the
public-domain flag the conversion produced.

Input shape (the common "scrollmapper / bible-databases" format):

    {
      "metadata": {"shortname": "KJV", "name": "...", "citation_limit": 0, ...},
      "verses": [{"book": 1, "chapter": 1, "verse": 1, "text": "In the beginning..."}, ...]
    }

`book` is the 1..66 canonical number, which maps to an OSIS code via `bible/canon.py`.
"""
import json
import re

from django.core.management.base import BaseCommand, CommandError

from bible.canon import CANON

# Canonical book number (1..66) -> OSIS code, from the single source of truth.
_OSIS_BY_NUMBER = {number: osis for osis, number, *_ in CANON}

# Leading paragraph pilcrows ("¶ ") are typesetting marks, not Scripture text.
# Bracketed words ("[was]") are the KJV's own convention for supplied words and are
# kept — they are part of the text, not markup we introduced.
_PILCROW = re.compile(r'^\s*¶\s*')


class Command(BaseCommand):
    help = 'Convert a flat-verse-list Bible JSON into the import_bible format.'

    def add_arguments(self, parser):
        parser.add_argument('path', help='The flat-format source JSON.')
        parser.add_argument('--out', required=True,
                            help='Where to write the converted import file.')
        parser.add_argument('--code',
                            help='Override the translation code (else metadata.shortname).')
        parser.add_argument('--default', action='store_true',
                            help='Mark this translation the reader default.')
        parser.add_argument(
            '--public-domain', dest='public_domain', action='store_true',
            default=None,
            help='Force is_public_domain true. Inferred from the source metadata '
                 'when not given.',
        )
        parser.add_argument(
            '--not-public-domain', dest='public_domain', action='store_false',
            help='Force is_public_domain false (a licensed text).',
        )

    def handle(self, *args, **options):
        path = options['path']
        try:
            with open(path, encoding='utf-8') as handle:
                data = json.load(handle)
        except OSError as exc:
            raise CommandError(f'Could not read {path}: {exc}') from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f'{path} is not valid JSON: {exc}') from exc

        verses = data.get('verses')
        if not isinstance(verses, list) or not verses:
            raise CommandError(
                f'{path} has no `verses` list. This converter expects the flat '
                f'"verses": [{{book, chapter, verse, text}}] format.'
            )

        meta = data.get('metadata') or {}
        payload = self._build(verses, meta, options)

        try:
            with open(options['out'], 'w', encoding='utf-8') as handle:
                json.dump(payload, handle, ensure_ascii=False)
        except OSError as exc:
            raise CommandError(f'Could not write {options["out"]}: {exc}') from exc

        translation = payload['translation']
        book_count = len(payload['books'])
        # A chapter is either a compact list of verse texts or an explicit
        # {'number', 'verses': {...}} object (see `_chapter_payload`); count both.
        verse_count = sum(
            len(ch['verses']) if isinstance(ch, dict) else len(ch)
            for b in payload['books'] for ch in b['chapters']
        )
        self.stdout.write(self.style.SUCCESS(
            f'Wrote {options["out"]}: {translation["code"]} '
            f'({translation["name"]}), {book_count} books, {verse_count} verses.'
        ))
        pd = translation['is_public_domain']
        self.stdout.write(
            f'  is_public_domain={pd}  is_default={translation.get("is_default", False)}'
        )
        if not pd:
            self.stdout.write(self.style.WARNING(
                '  Not public domain — confirm the copyright_notice below is what the '
                'licence requires before importing:'
            ))
            self.stdout.write(f'    {translation.get("copyright_notice") or "(none)"}')
        self.stdout.write(f'Next: python manage.py import_bible {options["out"]}')

    def _build(self, verses, meta, options):
        code = (options['code'] or meta.get('shortname') or '').strip().upper()
        if not code:
            raise CommandError(
                'No translation code. The source metadata has no `shortname`; pass '
                '--code.'
            )

        # Group verses -> book number -> chapter number -> {verse: text}, so the
        # order is reconstructed from the numbers rather than trusted from file order.
        books = {}
        skipped = set()
        for row in verses:
            try:
                number = int(row['book'])
                chapter = int(row['chapter'])
                verse = int(row['verse'])
            except (KeyError, TypeError, ValueError):
                continue
            osis = _OSIS_BY_NUMBER.get(number)
            if osis is None:
                # A book number outside 1..66 (some dumps append apocrypha). Skip it
                # and report — importing it would fail the canon check anyway.
                skipped.add(number)
                continue
            text = _PILCROW.sub('', str(row.get('text', ''))).strip()
            books.setdefault(osis, {}).setdefault(chapter, {})[verse] = text

        if skipped:
            self.stdout.write(self.style.WARNING(
                f'  Skipped {len(skipped)} non-canonical book number(s): '
                f'{sorted(skipped)} (outside 1–66).'
            ))

        # Emit books in canonical order, chapters and verses in numeric order.
        book_list = []
        for osis, number, *_ in CANON:
            if osis not in books:
                continue
            chapters = [
                _chapter_payload(chapter_number, books[osis][chapter_number])
                for chapter_number in sorted(books[osis])
            ]
            book_list.append({'osis_code': osis, 'chapters': chapters})

        return {
            'translation': self._translation_meta(code, meta, options),
            'books': book_list,
        }

    def _translation_meta(self, code, meta, options):
        # Infer public domain from the source unless the operator forced it. The
        # common dumps use copyright==0 / restrict==0 to mean "unrestricted".
        inferred_pd = (
            _is_zeroish(meta.get('copyright')) and _is_zeroish(meta.get('restrict'))
        )
        public_domain = (
            inferred_pd if options['public_domain'] is None
            else options['public_domain']
        )

        translation = {
            'code': code,
            'name': meta.get('name') or code,
            'language_code': (meta.get('lang_short') or 'en').lower(),
            'is_public_domain': public_domain,
            'is_offline_capable': public_domain,
            'is_default': options['default'],
        }

        # A licence cap of 0/None means unlimited; only carry a real positive cap.
        cap = meta.get('citation_limit')
        if isinstance(cap, int) and cap > 0:
            translation['max_consecutive_verses'] = cap

        if not public_domain:
            notice = meta.get('copyright_statement') or meta.get('copyright') or ''
            translation['copyright_notice'] = str(notice)
            translation['attribution_required'] = True

        return translation


def _chapter_payload(chapter_number, verse_map):
    """
    Compact array when the verses are a clean 1..n run; explicit object otherwise.

    The compact form (`["v1 text", "v2 text", ...]`) encodes the verse number as the
    array *position* — position i is verse i+1 — so it cannot represent a gap. Many
    translations legitimately omit verses: WEB, following the critical text, has no
    Matthew 17:21, John 5:4, Acts 8:37, and about a dozen others. Packing a gapped
    chapter into an array would silently renumber every verse after the gap (verse 22
    becomes 21, 23 becomes 22, …) — quiet Scripture corruption.

    So when the verse numbers are not exactly 1..n, emit the explicit
    `{'number', 'verses': {num: text}}` form, which `import_bible` supports natively
    and which preserves the real numbering, gap and all.
    """
    numbers = sorted(verse_map)
    if numbers == list(range(1, len(numbers) + 1)):
        return [verse_map[v] for v in numbers]
    return {
        'number': chapter_number,
        'verses': {str(v): verse_map[v] for v in numbers},
    }


def _is_zeroish(value):
    """True for 0, '0', '', None, False — the ways a dump says 'no restriction'."""
    return value in (0, '0', '', None, False)
