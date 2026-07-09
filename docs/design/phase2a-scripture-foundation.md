# Phase 2A Design — Scripture Foundation

_Status: **Implemented** (`feature/scripture-foundation`) · 2026-07-09_
_Refs: `docs/08-bible-experience.md`, `docs/07-feature-specifications.md` §4/§5/§7/§8, `docs/BACKEND-AUDIT.md` C3._

Closes audit finding **C3 — Bible absent**, and upgrades **"Memory verse = single-source Verse of the Day"** from ⚠️ ("fields exist, not enforced") to enforced.

Scope is architecture only: **no Bible text is imported**, no streaks, no notifications, no AI, no social features.

---

## 1. App layering

```
hierarchy/  -> org tree                (depends on nothing)
identity/   -> who you are, what you may do   (-> hierarchy)
bible/      -> Scripture + private engagement (depends on nothing)
content/    -> devotionals, manuals, articles (-> bible)
```

`bible` is **foundational**: it imports nothing from `content`, `identity` or `events`. The devotional's memory verse lives in `content` and points *into* `bible`, so the dependency runs one way only. Inverting this (putting `MemoryVerse` in `bible`) would have made `bible` import `content` and created the app-layer equivalent of a circular reference.

## 2. The Bible domain (`bible`)

### 2.1 Scripture text

| Model | Why it exists |
|---|---|
| `BibleTranslation` | A pluggable text source. Every licensing fact (`is_public_domain`, `copyright_notice`, `is_offline_capable`, `source_type`) is a **field, not a code branch** — adding a translation is content ops, not engineering (`docs/08` §10). At most one `is_default` (partial unique index). |
| `BibleBook` | One book *within one translation* — book names are language-specific ("John" / "Johanu"). Carries `osis_code`, the translation-agnostic address that lets the reader preserve position across a translation switch (`docs/08` §10). `alternate_names` feeds the fuzzy reference parser, including Nigerian abbreviations (`docs/08` §2). |
| `BibleChapter` | The unit of *reading*: history, progress and continue-reading all key on a chapter. |
| `BibleVerse` | The unit of *engagement*: bookmarks, highlights and notes all key on a verse. |

**Why books are per-translation, not global:** a single global book table would force one canonical name per book and break Yoruba/Igbo/Hausa translations (`docs/08` §11.4). Instead each translation owns its books, and `osis_code` is the shared address. Cross-translation position mapping is "look up the same `osis_code`" — no mapping table.

### 2.2 The personal layer

All rows belong to exactly one user. All are **owner-only** — see §5.

| Model | Why it exists |
|---|---|
| `Bookmark` | Saves a verse *or* a chapter. A `CheckConstraint` enforces exactly one target; two **partial** unique indexes prevent duplicates (a plain `unique_together` would treat each NULL target as distinct and allow repeats). |
| `Highlight` | One row per (user, verse). Recolouring updates rather than stacks. Four muted colours, **no imposed meaning** (`docs/08` §3). |
| `Note` | Private note on a verse. Several per verse allowed. `updated_at` is the edit timestamp. |
| `ReadingHistory` | **Append-only** event stream — never updated, hence no `updated_at`. Stores `read_on` (a tz-safe local day) so the Phase 2 Progress engine can bucket days without re-deriving them. Streak logic is deliberately absent. |
| `ReadingProgress` | High-water mark within one chapter (one row per user+chapter). Distinct from history: history is *every* read, progress is *how far*. Never moves backwards. |
| `ContinueReading` | One row per user — the single resumable position. Materialised rather than derived from history because the Today screen must read it in one cheap query and it must sync across devices (`docs/08` §5). |

## 3. The devotional layer (`content`)

`content.Devotional` **stays the canonical daily devotional** (one row per date). It is not forked, not replaced, and its existing fields and API contract are untouched. Three new models attach to it:

| Model | Why it exists |
|---|---|
| `MemoryVerse` | **The Verse of the Day.** At most one primary per devotional, enforced by a partial unique index. Usable in three stages: `reference_display` + `text_override` (works today, before any Bible text exists) → `translation` set (correct attribution line) → `start_verse`/`end_verse` linked (live link into the reader, text derived from Scripture). |
| `ScriptureReference` | The `ScriptureRef` the docs require as "one implementation, everywhere" (`docs/08` §12). Stores a **translation-agnostic address** (`book_osis` + chapter + verse range), not a `BibleVerse` FK, so one reference resolves in whichever translation the reader has open. |
| `DiscussionQuestion` | Ordered discussion prompts. |

### 3.1 Deviation from the phase brief, and why

The brief listed `Devotional`, `DevotionalDay`, `Reflection`, `Prayer`, `ActionPoint` as separate models. They are **not** created, because:

- `content.Devotional` is already one-row-per-day (it *is* the "DevotionalDay"), is populated by a live scraper, and is consumed by the frontend.
- It already carries `content` (the reflection/message), `prayer`, `action_point`, `confession` and `key_point` as fields.
- Creating parallel tables would give the product **two** models that could answer "what is today's memory verse" — precisely the competing-daily-verse the docs forbid (`docs/08` §7: *"No feature defines a competing daily verse."*).

Only the genuinely new, Bible-linked concerns were normalised. Confirmed with the product owner before implementation.

## 4. Service boundaries

Business logic lives in services; views orchestrate and serialise.

**`content/services/daily.py` — the daily experience.** One resolution path, so nothing can disagree:

```
verse_of_the_day()  ->  todays_memory_verse()  ->  todays_devotional()  ->  primary_memory_verse()
```

`verse_of_the_day()` is a deliberate one-line delegation. The Verse of the Day has no independent existence, no randomness, and no separate storage. It **is** today's devotional's primary memory verse.

`validate_publishable(devotional)` is the publish gate: the DB guarantees *at most* one primary verse; this enforces *at least* one (`docs/07` §5 — "the publish workflow blocks a devotional without one"). It is wired into the admin's bulk publish action, which previously did a blind `queryset.update(status='published')`.

**`bible/services.py` — Scripture and reading.**
`resolve_reference()` (the ScriptureRef resolver), `default_translation()` / `resolve_translation()`, and `record_chapter_read()` which writes history + progress + position atomically.

## 5. Permissions

Uses the Phase 1 centralized authorization system. No new authorization *pattern* is introduced.

| Surface | Rule | Mechanism |
|---|---|---|
| Read Scripture | Everyone, signed in or not | `AllowAny` / `HasPermissionOrReadOnly` SAFE methods |
| Write Scripture | `bible.manage` | `HasPermissionOrReadOnly(Perm.BIBLE_MANAGE)` |
| Devotional content (incl. memory verses) | `content.manage` | `HasPermissionOrReadOnly(Perm.CONTENT_MANAGE)` |
| Bookmarks, highlights, notes, reading data | **Owner only** | `bible.permissions.IsOwner` + owner-scoped `get_queryset` |

`bible.manage` is a new permission *code* added to the existing registry (`identity/permissions_registry.py`) and granted to `super_admin` (implicitly, via `ALL_PERMISSION_CODES`) and `national_coordinator`. It is **not** granted to regional or province coordinators: Scripture text is global content ops, not a regional concern. Reconciled by migration `identity/0004_seed_bible_permission`.

### 5.1 Why the personal layer is not `IsSelfOrHasPermission`

`identity.authorization.IsSelfOrHasPermission` admits *either* the owner **or** a permission holder. That is wrong here. Notes are "private absolutely — never visible to teachers, coordinators, parents, or admins" (`docs/08` §3), and `docs/13-community.md` extends this to highlights and reading detail.

`IsOwner` therefore grants access to `obj.user` and to **nobody else** — no role unlocks it, and there is no `is_superuser` bypass on this API surface. Additionally `get_queryset` filters to `request.user` *before* object permissions run, so a foreign object returns **404, not 403** — the API does not even confirm the row exists.

Django admin registers the personal layer as strictly **read-only** (no add/change/delete) for support and safeguarding inspection.

## 6. Timezone

`settings.TIME_ZONE` remains `UTC` (correct for storage). But the product's day boundary is Nigerian: `docs/07` §8 requires Africa/Lagos day boundaries. `common/dates.py::app_today()` resolves "today" against `settings.SCRIPTURE_TIMEZONE` (default `Africa/Lagos`).

Without this, "today's devotional" rolls over at 01:00 Lagos time. The new services and the `devotionals/today/` endpoint use `app_today()`; per-user timezones arrive with the Phase 2 Progress engine.

## 7. Known debt

- Legacy `Devotional.memory_verse_passage` / `memory_verse_content` string fields coexist with `MemoryVerse`. They remain the frontend contract; a backfill + contract step belongs to a later phase (expand–contract, as with `hierarchy` → `identity`).
- The devotional scraper does not yet create `MemoryVerse` rows; it still writes the legacy string fields.
- `BibleVerse` has no full-text search index yet — keyword search (`docs/07` §13) is a later phase.
- `ScriptureReference` attaches only to `Devotional`. Extending it to manuals/articles/events (`docs/08` §12) needs a generic relation or per-model FKs.
- No Bible text is imported. `MemoryVerse.start_verse` and `ScriptureReference.resolve()` return empty until an import lands; both are designed to degrade gracefully rather than error.
