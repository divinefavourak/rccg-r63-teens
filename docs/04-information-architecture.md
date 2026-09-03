# 04 — Information Architecture

## Organizing principle: intent, not content type

The legacy feature list is organized by content type (podcasts, videos, articles, devotionals, manuals…). Teens do not think in content types. They arrive with intents:

- *"I want my daily time with God"* → **Today**
- *"I want to read the Bible"* → **Bible**
- *"I want something to watch/listen to/read"* → **Library**
- *"What's happening / what am I part of?"* → **Tribe** (events + community)
- *"Me — my progress, my saves, my profile"* → **Me**

These five intents are the five top-level destinations. Everything in the product lives under exactly one of them (leader tooling excepted — see Role Layer below).

## Consolidation decisions

This section is normative. The legacy list contained ~24 features with heavy overlap; the consolidated model has 5 surfaces and 12 systems. Do not resurrect merged features as separate destinations.

| Legacy features | Consolidated into | Reasoning |
|---|---|---|
| Devotionals, Daily Challenges, (daily slice of) Reading Streaks, Mood Tracking | **Today** | These are all components of one daily ritual, not four destinations. A teen should never wonder "do I open Devotionals or Challenges first?" Mood tracking is cut from V1 entirely (`02-roadmap.md`). |
| Verse of the Day, Memory Verse | **One daily verse** (the devotional's memory verse) | There is no independent Verse of the Day system. The devotional's memory verse *is* the Verse of the Day, and the same verse powers the home card, widgets, notifications, share cards, and challenge theme — "One Day. One Verse. One Message." (`01-vision.md`). |
| Podcasts, Videos, Articles, Media Library | **Library** | One content model with a `type` field; one browse/search surface. Four nav destinations for one intent was pure structural debt. |
| Badges, Certificates, Achievements | **Recognition** (lives under Me) | Three reward vocabularies dilute meaning. One system: automatic *milestones* + issued *certificates* (`12-gamification.md`). |
| Saved Content, Bible Bookmarks | **Saved** (lives under Me; Bible bookmarks also accessible in-Bible) | One place to find everything you kept. |
| Reading Streaks, Reading Progress, Reading History | **Progress system** (surfaces in Today + Me) | One underlying model powers streaks, continue-reading, history, and plan completion. |
| Event Registration, QR Tickets, Payments | **Events** (under Tribe) | Tickets and payments are steps in one flow, not features. |
| Weekly Manuals | **Manuals** (role-gated, under Library for teachers; teen-visible summaries optional) | A teacher tool, surfaced by role. |
| Faith Journeys, Reading Plans | **Journeys** (entry from Today and Library; distinct engines, one mental model) | Reading plans are Scripture-only journeys; guided Journeys add devotional/challenge steps. Same progress UI. |
| Admin Dashboard, Coordinator Dashboard, Analytics | **Console** (role layer) | One leader console, capability-scoped by role, not two divergent products. |

## Product hierarchy

The complete screen inventory. Screens marked ✧ ship after V1 (see `02-roadmap.md`).

```
FAITH TRIBE
│
├── 1. TODAY (default landing, authenticated)
│   ├── 1.1  Daily header (date, greeting, streak flame + grace state)
│   ├── 1.2  Today's Devotional  → Devotional Reader
│   │         └── Devotional Reader (in-context Scripture → Bible)
│   ├── 1.3  Memory Verse / Verse of the Day card (the devotional's memory
│   │         verse — one source of truth; share card, tap → Bible Reader)
│   ├── 1.4  Today's Scripture (chapter card) → Bible Reader
│   ├── 1.5  Daily Challenge card (complete in place; themed with the day's message)
│   ├── 1.6  Continue Reading card (Bible position / active Journey step)
│   ├── 1.7  Memory-verse review prompt ✧ (V1.5, spaced repetition)
│   ├── 1.8  Active Journey step card ✧ (V1.5)
│   └── 1.9  Heart Check (one-tap, optional) ✧ (V2, if approved)
│
├── 2. BIBLE (see 08-bible-experience.md for full IA of this branch)
│   ├── 2.1  Reader (book/chapter view; the core screen)
│   ├── 2.2  Navigator (book grid → chapter grid → verse)
│   ├── 2.3  Translation switcher
│   ├── 2.4  Search (Scripture)
│   ├── 2.5  Verse actions (share, save, highlight ✧, note ✧, copy)
│   ├── 2.6  My Bible (highlights ✧, notes ✧, bookmarks, history)
│   ├── 2.7  Reading Plans ✧ (V1.5)
│   └── 2.8  Cross-references ✧ (V1.5)
│
├── 3. LIBRARY
│   ├── 3.1  Browse (curated shelves: Featured, Series, Topics)
│   ├── 3.2  Category / Series listing
│   ├── 3.3  Content detail
│   │         ├── Article Reader
│   │         ├── Video Player
│   │         └── Podcast Player (background audio, mini-player)
│   ├── 3.4  Search (Library)
│   ├── 3.5  Manuals (role-gated: Teacher+)
│   │         ├── Current week
│   │         └── Archive
│   └── 3.6  Journeys catalog ✧ (V1.5)
│
├── 4. TRIBE
│   ├── 4.1  Events
│   │         ├── Upcoming events list
│   │         ├── Event detail (info, schedule, price, organizer)
│   │         ├── Registration flow → Payment → Confirmation
│   │         ├── My Tickets (QR)
│   │         └── Past events
│   ├── 4.2  Announcements (regional/area/parish scoped)
│   ├── 4.3  Friends ✧ (V2, behind the safeguarding gate — 13-community.md)
│   │         ├── My Friends (list; visible to the teen only — no public counts)
│   │         ├── Requests (sent / received)
│   │         ├── Friend profile (first name, avatar, parish, opt-in milestones)
│   │         ├── Encouragement notes (constrained, screened — not open chat)
│   │         ├── Accountability Partners (consent setup, partner space)
│   │         └── Invite friends (share link)
│   ├── 4.4  Prayer Wall ✧ (V2, moderated)
│   ├── 4.5  My Group ✧ (V2: class/small group space)
│   ├── 4.6  Serve ✧ (V2: volunteer opportunities board)
│   ├── 4.7  My Church (parish identity, service times, leaders)
│   └── 4.8  Community Notes ✧ (V2, moderated: short testimonies; public likes + reposts)
│
├── 5. ME
│   ├── 5.1  Profile (identity, parish, role tag)
│   ├── 5.2  Progress (streak detail, reading stats, history)
│   ├── 5.3  Recognition ✧ (milestones, certificates) (V1.5)
│   ├── 5.4  Saved (all saved content + Bible bookmarks)
│   ├── 5.5  My Tickets (shortcut; canonical home is Tribe → Events)
│   ├── 5.6  Notifications inbox
│   └── 5.7  Settings
│             ├── Account & security
│             ├── Notification preferences (reminder intensity, times, quiet hours)
│             ├── Friends & privacy ✧ (requests, visibility, partner nudges, blocks)
│             ├── Appearance (theme, text size)
│             ├── Data & offline (download management, data-saver)
│             ├── Privacy ✧
│             └── Help & feedback
│
├── ROLE LAYER — CONSOLE (Teacher / Coordinator / Admin; separate surface,
│   │            entered via Me → "Console" or direct URL; desktop-optimized)
│   ├── C.1  Overview (scope-aware dashboard)
│   ├── C.2  People (members, roles, hierarchy management)
│   ├── C.3  Content (devotional calendar, library publishing, review queue)
│   ├── C.4  Events (create/manage, registrations, payments, check-in)
│   ├── C.5  Manuals (upload/manage) 
│   ├── C.6  Analytics (scope-aware: parish/area/zone/province/region)
│   ├── C.7  Moderation ✧ (V2)
│   └── C.8  Settings (region config, audit log)
│
└── GUEST LAYER (unauthenticated)
    ├── Landing (value proposition, install prompt)
    ├── Today's devotional (readable; actions gated)
    ├── Bible (readable; personalization gated)
    ├── Library (browse; playback of featured items)
    ├── Events (view + register — registration forces account creation)
    └── Auth (sign up / log in / recovery)
```

## Relationships between systems

The architecture is **hub-and-spoke with the Bible at the hub** (`08-bible-experience.md`):

- Every Scripture reference anywhere (devotionals, articles, manuals, event descriptions, challenges, memory verses, journey steps) is a **live link into the Bible Reader**, opening in context with a return path.
- **One Day. One Verse. One Message:** the devotional's memory verse is the single source of truth for the Verse of the Day. The same verse object powers the Today card, home-screen widgets ✧, notifications, share cards, the daily challenge theme, and (future) lock-screen widgets. No feature may define its own "verse of the day."
- The **Progress system** is a shared service: Today reads it for streaks, Bible writes reading events to it, Journeys write step completions, Me renders its history.
- The **Relationship system ✧** (friendships, accountability partnerships) is a shared service consumed by Tribe (friends surfaces), notifications (partner nudges), Journeys (shared journeys), and gamification (memory-verse challenges) — one mutual-consent graph, never a follower graph (`13-community.md`).
- The **Content system** underlies devotionals, library items, manuals, and announcements — one publishing pipeline, one review workflow, different types and visibility scopes.
- The **Hierarchy system** (Parish → Area → Zone → Province → Region → National) scopes everything: content visibility, event audiences, roles, analytics. It is the multi-region backbone (`15-technical-architecture.md`).
- **Saved** aggregates references from Bible and Library; it stores pointers, not copies.

## Feature grouping by core value

Sanity check against `01-vision.md` — every surface maps to a value:

| Surface | Grow 🌱 | Connect 🤝 | Serve 🙌 | Belong ❤️ |
|---|---|---|---|---|
| Today | ●● | | | ● |
| Bible | ●● | | | |
| Library | ●● | ● | | |
| Tribe | ● | ●● | ●● | ●● |
| Me | ● | | | ●● |

## Future scalability rules

1. **New content types join Library; they do not create nav items.** An "Audio Bible" or "Music" type is a Library shelf, not a sixth tab.
2. **New community features join Tribe.** Friends, prayer, groups, serve — all live there. The bottom nav never grows past five (`05-navigation.md`).
3. **Region-scoped everything.** Any new entity must declare its hierarchy scope on day one. "Global" content is scope = National.
4. **The Console absorbs all leader tooling.** No parallel admin products per role; capability flags within one console.
5. **Journeys is the engine for any future program** (camps prep tracks, leadership pipelines, seasonal campaigns). Don't build parallel program engines.

## Open questions for design

- Whether teen-visible manual summaries (a "what we're learning this week" card) add value or noise — validate with Region 63 teachers before building.
- Whether My Church merits a Tribe slot in V1 or folds into Me → Profile until V2 community lands.
- Guest event registration depth: full guest checkout vs. forced signup — current decision is forced lightweight signup (it creates the discipleship relationship), but monitor drop-off (`14-analytics.md`).
