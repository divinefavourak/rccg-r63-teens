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
- **gap** (`day > last_active_on + 1`) → reset to 1, fresh `started_on`.

`longest_length = max(longest_length, current_length)` on every advance.

## 4. Timezone

Day boundaries are local, not UTC (`§8`: "Africa/Lagos default, per-user tz
stored"). `common.dates.user_today(user)` resolves the user's day, falling back
to the app timezone until a stored per-user field lands — the seam is in place so
no caller assumes UTC.

## 5. Deferred to later increments (this phase)

- **Grace Days** — `GraceDayLedger`; 2/month base, earnable to a held cap of 4,
  covering at most 2 consecutive missed days (3rd resets). Intercepts the *gap*
  branch of `_advance_streak`. (`12-gamification.md` "Grace Days".)
- **Grace earning + pause** — +1 per completed 7-day week and per Journey;
  proactive streak pause (14 days, twice a year).
- **API + admin surfacing** — current/longest streak, chapters read, devotionals
  completed, monthly heat-map; private by default.
- **Integration** — `bible`/`content` emit `record_action` on chapter read /
  devotional completion; retire `TeenProfile.update_streak`.

## 6. Out of scope

Milestones/Recognition, notifications ladder, journeys, leaderboards (banned).
