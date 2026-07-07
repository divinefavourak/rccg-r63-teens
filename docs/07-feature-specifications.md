# 07 — Feature Specifications

Specs use the consolidated feature model from `04-information-architecture.md`. Priority: P0 (V1 launch-blocking), P1 (V1 wanted / V1.5 committed), P2 (V2), P3 (V3). Complexity: S / M / L / XL. Success metrics reference `14-analytics.md`.

Format per feature: **Purpose · Problem solved · Acceptance criteria (AC) · Dependencies · Future · Priority · Complexity · Metrics.**

---

## 1. Authentication & Accounts — P0 · M

**Purpose:** Secure, low-friction identity for teens on shared devices.
**Problem:** Teens abandon multi-step signups; email-centric auth fails an audience that lives on phone numbers.
**AC**

- Sign up with phone+OTP or email, or Google OAuth, in ≤2 screens.
- Passwords hashed (argon2/bcrypt); sessions via short-lived access + rotating refresh tokens in HTTP-only cookies.
- Under-13 birthdates blocked at signup with a kind message.
- Password reset via OTP/link in ≤3 screens; rate-limited.
- Guest → account migration preserves local reading position and saves.
**Dependencies:** SMS gateway (Nigerian delivery reliability — test Termii/AfricasTalking), Google OAuth setup.
**Future:** Passkeys; WhatsApp OTP channel.
**Metrics:** Signup completion rate ≥80% from start; OTP delivery success ≥95%.

## 2. Profiles & Roles — P0 · M

**Purpose:** Identity within the church structure; capability assignment.
**Problem:** No unified registry of teens/leaders exists; permissions today are informal.
**AC**

- Profile: name, avatar (optional, moderated defaults available), parish, role tag.
- Roles: Teen, Super Teen, Teacher, Coordinator, Administrator — assigned by a user with authority over the target's scope, never self-claimed.
- Every role assignment carries a hierarchy scope (e.g., Coordinator of *Area X*).
- Role changes take effect without re-login; all assignments audit-logged.
**Dependencies:** Hierarchy system (#3).
**Future:** Serve-pathway progression (V3); verified worker status.
**Metrics:** % teens with correct parish assignment ≥90% by month 3.

## 3. Church Hierarchy — P0 · L

**Purpose:** The structural backbone: Parish → Area → Zone → Province → Region → National. Scopes content, events, roles, analytics; enables multi-region tenancy.
**Problem:** Everything in RCCG is organized by this hierarchy, but no system encodes it.
**AC**

- Admins CRUD hierarchy nodes within their scope; CSV bulk import of parishes.
- Every user belongs to exactly one parish (or a region-level "unassigned" bucket).
- Every content item, event, and announcement declares a visibility scope; users see items scoped at or above their position.
- Moving a parish between areas re-scopes its members automatically.
- **No entity anywhere hard-codes Region 63** (enforced in code review — `15-technical-architecture.md`).
**Future:** Self-serve region onboarding (V2); international structures (V3).
**Metrics:** Time to onboard a new region (target <1 day by V2).

## 4. Today (daily experience) — P0 · M

**Purpose:** The daily heartbeat: devotional, Scripture, streak, challenge in one ritual.
**Problem:** Devotional PDFs on WhatsApp; no habit scaffolding; fragmented daily features (see consolidation, `04-information-architecture.md`).
**AC**

- Renders: date/greeting, streak state, **memory verse / Verse of the Day card** (the devotional's memory verse — see below), today's devotional card, today's Scripture card, daily challenge card, continue-reading card. (Memory-verse review ✧, Journey step ✧ in V1.5.)
- **One Day. One Verse. One Message:** every devotional carries a required memory verse (`#5`). That verse *is* the Verse of the Day — the single source of truth rendered by the Today card, home-screen widgets ✧, notification copy, the share card, the daily challenge theme, and (future) lock-screen widgets. There is no independent Verse of the Day system anywhere in the product.
- Memory verse card: verse text + reference (live link into the Bible Reader) + one-tap share card (`08-bible-experience.md` §3).
- Loads from cache in <1s on repeat visits; today's content pre-cached on prior session.
- Devotional completion detected automatically (scroll-depth ≥90% + dwell ≥60s), synced offline-first; completion cancels the day's remaining habit reminders (#10).
- Daily challenge completable inline (check-off or 1-tap actions), one per day, skippable without penalty; where themed, the challenge echoes the day's verse and message.
- Empty/pipeline-gap state per `06-user-flows.md` flow 5.
**Dependencies:** Content system (#5), Progress system (#8), Bible (#7).
**Metrics:** Devotional completion rate; % of DAU touching Today; WED (North Star).

## 5. Content System & Devotionals — P0 · L

**Purpose:** One publishing pipeline for devotionals, library items, manuals, announcements.
**Problem:** Four legacy "features" were one content model wearing different hats.
**AC**

- Content types: `devotional`, `article`, `video`, `podcast`, `manual`, `announcement` — one schema, type-specific fields.
- Workflow states: draft → in-review → approved → scheduled → published → archived; two-person rule for region-wide+ publishing.
- Every item: hierarchy scope, tags/topics, optional series, anchor Scripture references (validated, rendered as live Bible links). **Devotionals additionally require a memory verse** (validated reference + translation) — the publish workflow blocks a devotional without one, because that verse powers the entire day (#4).
- Devotional calendar view with gap detection and alerts (no-devotional-scheduled-within-48h pages the admin).
- Rich text with safe subset (no arbitrary embeds); images auto-compressed to data-light variants.
**Dependencies:** Storage/CDN, hierarchy (#3).
**Future:** National shared-content layer (V2); localization variants (V3).
**Metrics:** Devotional pipeline continuity (zero gap-days); publish-to-read latency.

## 6. Library — P0 · M

**Purpose:** All discipleship media (articles, video, podcasts) in one browsable, searchable surface.
**Problem:** Podcasts/videos/articles/media-library as four features fragmented one intent.
**AC**

- Curated shelves (Featured, Series, Topics) managed by admins — no algorithmic feed, no infinite scroll (`01-vision.md` principles).
- Article reader (offline once opened ✧ V1.5 explicit downloads), video player (tap-to-play only, quality selector, resume), podcast player (background audio, mini-player, speed, resume).
- Save from any card; series group episodes with progression.
- Data-saver mode respected everywhere.
**Dependencies:** Content system (#5), storage/CDN with HLS for video.
**Future:** Offline media packs (V3), audio Bible shelf (V3).
**Metrics:** Library weekly reach; completion rate per item; saved-item resurrection rate.

## 7. Integrated Bible — P0 · XL

The foundation. Full spec: `08-bible-experience.md`. Summary AC for V1: reader with WEB+KJV, ≤2-tap navigation, reading position sync, continue reading, verse share (text+image), Scripture search, universal deep-linking from all content, offline default translation.
**Priority/Complexity:** P0 · XL. **Metrics:** % of WED actions that are Bible reads; devotional→Bible tap-through rate.

## 8. Progress System (streaks, history, stats) — P0 · M

**Purpose:** One model for streaks, reading history, continue-reading, and (later) plan/journey progress.
**Problem:** Streaks/progress/history as three features would triple-track the same truth.
**AC**

- A `spiritual_action` event stream (devotional_completed, chapter_read, challenge_completed, step_completed, verse_reviewed ✧) powers everything.
- Streak = consecutive days with ≥1 qualifying action; **Grace Days** (base allocation 2 per calendar month, earnable to a held cap of 4, max 2 consecutive — full design in `12-gamification.md`) auto-applied and visible ("Grace covered Tuesday 🌱"); streak reset copy is warm, never red (`12-gamification.md`).
- Streak-preservation reminders follow the ladder in #10 and `12-gamification.md` — completion-aware, encouraging, never shaming.
- Continue Reading resolves to the most recent resumable context (Bible position or Journey step ✧).
- Me → Progress: current streak, longest streak, chapters read, devotionals completed, simple monthly view. Private by default — no leaderboards.
- Timezone-safe day boundaries (Africa/Lagos default, per-user tz stored).
**Metrics:** Streak retention curves; grace-day save rate; D30 retention of streak-holders vs. non.

## 9. Events, Tickets & Payments — P0 · L

**Purpose:** End-to-end event lifecycle: create → publish → register → pay → QR ticket → check-in → report.
**Problem:** Chinedu's spreadsheets, transfer-screenshot reconciliation, paper check-in (`03-user-personas.md`).
**AC**

- Event: title, banner, description, venue, datetime, scope audience, capacity, price (free/paid), custom form fields, deadline, organizer identity displayed.
- Registration pre-fills profile data; guest hitting Register gets signup-then-resume.
- Payments via Paystack (card/bank/USSD/transfer); webhook-driven confirmation; **shareable payment link for parent payment**; automatic receipt.
- Pending unpaid registrations expire after 24h, releasing capacity; waitlist with auto-promotion.
- QR ticket: signed payload, offline-renderable, one-time check-in with duplicate detection; check-in works offline with queued sync.
- Coordinator dashboard: live counts, reconciliation view, CSV export, attendance report.
- Refund handling: admin-initiated via Paystack, state tracked.
**Dependencies:** Paystack merchant account (start early — legal lead time), hierarchy (#3), notifications (#10).
**Future:** Multi-session events/workshop selection (V2); recurring programs (V2); group/family registration (V2).
**Metrics:** Registration conversion from event view; payment success rate ≥90%; check-in throughput (target ≥6/scanner/min); % regional events on-platform.

## 10. Notifications — P0 · L

**Purpose:** Habit-forming reminders toward Scripture and church life — encouraging by design, never manipulative.
**Problem:** Habits need cues; teens genuinely want help staying consistent (`12-gamification.md`). But push abuse or guilt-copy would betray the product's character. The design resolves both: remind persistently, word everything with grace, and stop instantly once the day is done.
**AC**

- Channels: PWA push, in-app inbox (every push mirrored), email/SMS for transactional fallback (tickets, payment).
- **Habit reminder ladder (daily, completion-aware):** up to four rungs, each sent *only if today's devotional is still incomplete* — morning ("Good morning! Today's devotional and memory verse are ready."), afternoon ("Have you had a chance to spend time in God's Word today?"), evening ("Keep your streak alive. Today's devotional is still waiting."), final ("There's still time to continue today's journey."). Completing the devotional cancels all remaining rungs within seconds, including already-queued ones. Full strategy and copy standards: `12-gamification.md`, `11-content-strategy.md`.
- **Intensity presets:** Gentle (morning only) · Standard (morning + evening — the default) · Committed (full ladder). Each rung individually toggleable; times user-adjustable; quiet hours (default 21:30–06:00) always respected — the final rung sits before quiet hours, never inside them.
- **Intelligent timing (V2):** rung times learn each teen's habitual completion window; a teen who reads at 21:00 gets a later ladder, not a 06:30 push into the void.
- **Auto step-down:** 7 consecutive days of ignored reminders steps intensity down one level with a transparent in-app note; software-enforced respect (`14-analytics.md` guardrails).
- Reminder copy always references *today's* devotional and verse — the notification is part of "One Day. One Verse. One Message.", not generic app-bait.
- Other types: event lifecycle (confirmation, reminder, changes), announcements (scoped, batched — never more than one announcement push per day), friend requests / partner nudges ✧ (consent-gated, `13-community.md`), system.
- Per-type preference toggles; one-tap mute of announcements per scope; permission requested only in context (`06-user-flows.md` flow 17).
- A central notification service enforces ladder logic, presets, quiet hours, and step-down — no feature may send around it (`15-technical-architecture.md`).
**Metrics:** Reminder→devotional conversion per rung; % of days resolved at rung 1 (health signal: most days should never need rung 3); opt-out rate (guardrail: <5%/quarter); step-down activation rate.

## 11. Weekly Manuals — P1 (V1) · S

**Purpose:** Teachers get the right manual, on time, offline.
**AC:** Manual type in content system; current week pinned; archive searchable; PDF download + in-app reader; role-gated to Teacher+; offline-available once opened.
**Future:** Teen-visible weekly summary card (validate first — `04-information-architecture.md` open questions); teaching notes/annotations (V2).
**Metrics:** % teachers accessing the current manual by Saturday night.

## 12. Saved — P1 (V1) · S

**Purpose:** One place for everything kept: verses, articles, media, (bookmarks).
**AC:** Save/unsave from any surface with undo; filter chips by type; pointers not copies; graceful handling of unpublished items.
**Metrics:** % of WAU using Saved; resurrection rate (saved → later opened).

## 13. Search — P1 (V1 scoped, V1.5 unified) · M

**AC (V1):** Bible search (reference + keyword, local index for offline); Library search (title/tag/series); Events search. **(V1.5):** unified surface with scope chips, Scripture results first.
**Metrics:** Search success rate (result tapped); zero-result rate.

## 14. Reading Plans ✧ — P1 (V1.5) · M

**Purpose:** Structured Scripture paths (e.g., Gospels in 40 days).
**AC:** Plan catalog; day model with passages; progress via Progress system; today's portion surfaces on Today; pause/resume; catch-up view that never guilt-trips (no "you are 9 days behind" in red).
**Dependencies:** Bible (#7), Progress (#8).
**Metrics:** Plan start→completion rate; contribution to WED.

## 15. Journeys ✧ — P1 (V1.5) · L

**Purpose:** Guided multi-day discipleship programs mixing devotional segments, Scripture, reflection, challenges. The engine for future programs (camp prep, leadership tracks, seasonal campaigns).
**AC:** Journey = ordered steps with mixed step types; daily step surfaces on Today; pause-not-punish on missed days; completion issues a certificate (#16); authoring in Console with review workflow; scoped visibility.
**Metrics:** Journey completion rate ≥40%; certificates issued.

## 16. Recognition ✧ — P1 (V1.5) · M

**Purpose:** Unified milestones + certificates (merging badges/achievements/certificates).
**AC:** Per `12-gamification.md` — milestone taxonomy, private-by-default, certificate artifacts (shareable image/PDF, verifiable ID), no leaderboards, no streak-loss shaming.
**Metrics:** % of monthly actives earning ≥1 milestone; certificate share rate.

## 17. Announcements — P0 · S

**AC:** Scoped posts (parish→national) in Tribe; batched — never more than one announcement push per day, separate from the habit reminder ladder (#10); read tracking for coordinators (aggregate only).
**Metrics:** Announcement reach vs. WhatsApp baseline.

## 18. Console (Admin + Coordinator) — P0 · L

**Purpose:** One leader surface, capability- and scope-gated (`04-information-architecture.md`).
**AC (V1):** Overview dashboard; People (search, role assignment, parish correction, CSV import); Content (calendar, review queue, publishing); Events (full lifecycle, check-in mode); Manuals; Analytics (scope-aware — `14-analytics.md`); audit log of all privileged actions; desktop-optimized, tablet-capable.
**Metrics:** Coordinator weekly active rate; time-to-publish; % events created without support tickets.

## 19. Community Suite ✧ — P2 (V2) · XL

Prayer Wall, My Group, Serve board, moderation, reporting, parent portal — plus Friends (#21) and Accountability Partners (#22). Full spec: `13-community.md`. Ships only after safeguarding gate.

## 20. Heart Check ✧ — P2 (V2, conditional) · S

One-tap optional emotional check-in on Today; aggregated pastoral insight only; individual data never exposed to leaders or parents. Ships only if the privacy design in `13-community.md` passes review; otherwise remains cut (`02-roadmap.md`).

## 21. Friends ✧ — P2 (V2) · L

**Purpose:** Mutual, teen-to-teen connections for discipleship, encouragement, and accountability — deliberately not social media.
**Problem:** Faith is communal; teens already encourage each other on WhatsApp with zero safety design. Faith Tribe gives that relational energy a safe, discipleship-shaped home.
**AC**

- Friend requests: mutual accept only; teen-peer only (adults can never friend teens); requestable via invite link or group-member profiles — no stranger discovery, no suggestions engine.
- Friend profile: first name, avatar, parish, and only the milestones the teen opted to share. **No follower counts, no activity feeds, no likes, no popularity metrics anywhere** — friend lists are visible only to their owner.
- Prayer requests to friends; **encouragement notes** (constrained composer: templates + short text, automated safety screening, retained and auditable, report/block on every note — *not* open-ended chat; `13-community.md`).
- Shared Journeys and reading plans (invite a friend; each sees the other's step completion for that Journey only).
- **Memory-verse challenges:** friendly 1:1 — both memorize the same verse (typically the day's/week's verse); completion visible to each other, no scores, no leaderboards (`12-gamification.md`).
- Optional per-event attendance visibility ("let friends see I'm going" — off by default); birthday celebrations (if birthday visibility enabled).
- Block and remove are silent and instant; declines are never disclosed; rate limits on requests and notes.
**Dependencies:** the full safeguarding gate (`13-community.md`) — moderation, reporting, crisis escalation. Ships with, never before, the community suite.
**Metrics:** % of actives with ≥1 friend; encouragement notes sent/received; shared-Journey completion vs. solo; zero-tolerance safeguarding incident tracking.

## 22. Accountability Partners ✧ — P2 (V2) · M

**Purpose:** A consent-based deeper tier of friendship for walking together in consistency.
**AC**

- Partners must already be friends; 1–3 partners per teen; dual-consent screen states in plain language exactly what a partner sees and receives.
- Partner receives: milestone celebrations, activity *status* (active today / not yet — never content detail), and — **only if the teen pre-enabled it** — an inactivity nudge after ~3 quiet days ("send some encouragement?").
- Partner space: shared prayer list, pray-together prompts, shared Journey option, celebrate action.
- Either side ends the partnership silently at any time; all permissions revoke instantly. Privacy law applies fully: partners never see reading detail, notes, highlights, or Heart Check (`13-community.md`).
**Metrics:** partnership formation and 90-day survival rate; **WED retention lift for partnered teens vs. matched non-partnered teens** (the feature's core hypothesis); nudge→re-engagement conversion.

---

## Cross-feature acceptance criteria (apply to every feature)

1. Works at 360px width, one-handed.
2. Survives offline/network-drop with queued sync or honest messaging (`06-user-flows.md` flow 21).
3. Respects hierarchy scoping and RBAC; role-gated UI is invisible, not disabled.
4. Emits analytics events per the taxonomy in `14-analytics.md`.
5. Meets WCAG 2.1 AA (`09-design-principles.md`).
6. All copy passes the voice/tone review (`11-content-strategy.md`).
7. No dark patterns: no fake urgency, no guilt mechanics, no attention traps (`01-vision.md`).
