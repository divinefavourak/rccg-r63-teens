# Phase 2B — Progress Engine

Resolves audit **H2** ("Progress/streak naive"): replaces the race-prone
`TeenProfile.update_streak` counter with the documented `spiritual_action`
event stream + streak engine + Grace Days
(`docs/07-feature-specifications.md` §8, `docs/12-gamification.md`).

## 1. App layering

```text
progress/   -> spiritual-action stream, streaks, Grace Days   (depends on nothing)
bible/      -> Scripture + reading history                    (-> progress, to emit actions)
content/    -> devotionals                                    (-> progress, to emit actions)
```

`progress` is **foundational**, like `bible`: it imports nothing from other
domains. Feature apps record activity by calling `progress.services.record_action(...)`.
To keep the dependency one-way, `SpiritualAction` stores an opaque
`source_reference` string (`"bible.chapter:<uuid>"`) instead of a foreign key
into the source domain. A `bible.chapter` FK here would invert the layering — the
same reason `MemoryVerse` lives in `content`, not `bible` (Phase 2A).

## 2. Models

- **`SpiritualAction`** — append-only event stream; the single source of truth.
  `action_type` ∈ {devotional_completed, chapter_read, challenge_completed,
  journey_step_completed, verse_reviewed}. No `updated_at` (never edited, like
  `bible.ReadingHistory`). `occurred_on` is the *local* calendar day and is the
  unit a streak counts in — stored once at write time so the engine never
  re-derives day boundaries from UTC instants. Indexed `(user, -occurred_at)`
  and `(user, occurred_on)`.
- **`StreakState`** — a materialized high-water-mark cache over the stream, so
  "current streak" on Today is a one-row read. Rebuildable from the stream;
  only ever advanced forward. `longest_length` is never lowered by a reset —
  a break is reframed as a fresh start while its record is preserved
  (`12-gamification.md`: "history is honored, not erased").

## 3. The streak rule (this increment)

`record_action` appends the action and calls `_advance_streak(user, day)`
atomically, locking the `StreakState` row (`select_for_update`) so two same-day
requests can't both increment. Relative to `last_active_on`:

- **first ever** → length 1, `started_on = day`.
- **same day** (`day == last_active_on`) → no-op; the action is still logged.
  The streak counts *days*, not actions.
- **backfilled earlier day** (`day < last_active_on`) → logged, but never
  rewrites the streak.
- **next day** (`day == last_active_on + 1`) → length += 1.
- **gap** (`day > last_active_on + 1`) → offered to Grace Days first (§5); resets
  to 1 with a fresh `started_on` only when grace cannot fully bridge it.

`longest_length = max(longest_length, current_length)` on every advance.

## 4. Timezone

Day boundaries are local, not UTC (`§8`: "Africa/Lagos default, per-user tz
stored"). `common.dates.user_today(user)` resolves the user's day, falling back
to the app timezone until a stored per-user field lands — the seam is in place so
no caller assumes UTC.

## 5. Grace Days (done)

`GraceDayLedger` is an append-only ledger; balance is the sum of `delta`. Base
2/month (idempotent via a partial unique index on `(user, effective_month)`),
earnable to a held cap of 4 enforced at grant time. On a gap, `_advance_streak`
offers the miss to `_try_cover_gap`, which bridges **at most 2 consecutive**
missed days, **all-or-nothing** (a partly-covered gap is still broken, so nothing
is spent) and only when the balance covers every missed day. A covered day counts
toward length, so `Mon → Tue(grace) → Wed` reads as a 3-day streak.

## 6. Read API (done) — private, owner-only

`/api/v1/progress/` (alias `/api/progress/`): `streak/`, `summary/`, `calendar/`,
`actions/`. All scoped to `request.user`; no leaderboards (`§8`). `IsOwner` gives
no role/superuser bypass, so a foreign action 404s.

**Cross-context composition.** `summary/` reports Progress figures *and*
Bible-derived reading stats (distinct chapters/books). The Progress *domain*
stays free of any Bible import; composition happens only in
`ProgressSummaryView`, which reaches Bible through its public
`bible.services.reading_stats(user)` — never Bible tables. Because that import is
in the view layer (a leaf nothing imports), it creates no cycle even after Bible
starts calling `progress.services` to emit actions. "Chapters read" is therefore
the *distinct* chapters from Bible (translation-agnostic by OSIS), not the raw
`chapter_read` action count, which would inflate on re-reads.

## 7. Deferred to later increments (this phase)

- **Integration** — `bible`/`content` emit `record_action` on chapter read /
  devotional completion; retire `TeenProfile.update_streak`. Separate branch/PR.
- **Grace earning + pause** — +1 per completed 7-day week and per Journey;
  proactive streak pause (14 days, twice a year).

## 6. Out of scope

Milestones/Recognition, notifications ladder, journeys, leaderboards (banned).
