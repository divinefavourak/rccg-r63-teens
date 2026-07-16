# 03 — Bible import

The Bible schema (`BibleTranslation` → `Book` → `Chapter` → `Verse`) has existed
since Phase 2A. It ships **empty** — importing the text is an operations task, run
once per translation, because Scripture text is content, not code.

`docs/02-roadmap.md` lists WEB and KJV ingestion as a V1 **launch dependency**:
without it, the Bible reader opens to nothing and the Verse of the Day cannot
resolve verse text.

---

## The file format

A translation is one JSON file. Full schema and reasoning: `backend/bible/importers.py`.

```json
{
  "translation": {
    "code": "WEB",
    "name": "World English Bible",
    "language_code": "en",
    "is_public_domain": true,
    "is_offline_capable": true,
    "is_default": true
  },
  "books": [
    {
      "osis_code": "John",
      "chapters": [
        ["In the beginning was the Word...", "The same was in the beginning..."],
        ["And the third day there was a marriage..."]
      ]
    }
  ]
}
```

- **`osis_code`** must be one of the 66 canonical codes in `backend/bible/canon.py`.
  Book numbers, testament, and English names come from the canon — the file may
  override the display name and add aliases, but not renumber the canon.
- **Compact chapters** (arrays) let position carry the numbering. Use the explicit
  object form (`{"number": .., "verses": {..}}`) only for texts with gaps, e.g.
  translations that omit Matthew 17:21.
- Unknown fields in `translation` are **rejected**, so a typo'd licence flag
  (`public_domain` instead of `is_public_domain`) fails loudly rather than
  importing a mislicensed Bible.

## Where to get the text

Public-domain source texts (WEB, KJV, ASV) are freely available. The WEB is the
recommended V1 default: contemporary language, zero licensing risk, safe to cache
offline (`docs/08-bible-experience.md` §11).

### Converting a flat-verse-list dump

Most public-domain Bible JSON is distributed as a **flat list of verses** —
`{"metadata": {...}, "verses": [{"book": 1, "chapter": 1, "verse": 1, "text": "..."}]}`
— not the nested shape above. `convert_bible` bridges the two:

```bash
python manage.py convert_bible kjv.json --out kjv-import.json --default
python manage.py import_bible kjv-import.json
```

It maps the 1–66 `book` number to an OSIS code via `bible/canon.py`, strips
paragraph pilcrows (`¶`), keeps the KJV's `[supplied-word]` brackets, and **infers
the licence flags** from the source metadata (`copyright`/`restrict` zero ⇒ public
domain; a positive `citation_limit` ⇒ a consecutive-verse cap). Because licence is
inferred, the converter prints what it decided and **you should read the converted
file's `translation` block before importing** — override with `--public-domain` /
`--not-public-domain` / `--code` if the inference is wrong. Books numbered outside
1–66 (apocrypha some dumps append) are skipped and reported.

**Licensed translations** (NIV, ESV, …) carry constraints — attribution lines,
consecutive-verse caps. Set `is_public_domain: false`, provide `copyright_notice`,
`attribution_required: true`, and `max_consecutive_verses` where the licence caps
sharing. The verse-share endpoint enforces those from the data.

---

## Procedure

```bash
# 1. Import (idempotent — safe to re-run, resumable if interrupted)
python manage.py import_bible web.json

# 2. Confirm
python manage.py verify_deployment    # "Bible translation installed" -> OK
```

The importer builds the full-text search index as it writes each chapter, so a
normal import needs no separate indexing step.

### Updating existing text

Re-running with a corrected file updates only the verses whose text changed.
**Verses are never deleted and recreated** — `Note`, `Highlight`, and `Bookmark`
cascade from `BibleVerse`, so a delete-and-recreate would erase teens' private
annotations. Re-import is safe for their data.

### Rebuilding the search index

Only needed for text imported before the search index existed, or after a
stemmer-config change:

```bash
python manage.py rebuild_bible_search --translation WEB
```

---

## Adding a second translation

```bash
python manage.py import_bible kjv.json     # is_default: false
```

Importing a new translation with `is_default: true` automatically stands down the
previous default in the same transaction (only one default is allowed).

## Verification checklist

- [ ] `verify_deployment` shows `Bible translation installed: OK`.
- [ ] The reader opens (`GET /api/v1/bible/translations/default/` returns a translation).
- [ ] Search works (`GET /api/v1/bible/search/?q=love`).
- [ ] A reference resolves (`GET /api/v1/bible/lookup/?q=John+3:16`).
