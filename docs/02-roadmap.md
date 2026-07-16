# 02 — Roadmap

## How this roadmap was sequenced

Four rules drove the ordering:

1. **The daily habit ships first.** The Today experience and the integrated Bible are the product's heartbeat (`01-vision.md`). Everything else amplifies them; nothing substitutes for them. They are V1, non-negotiable.
2. **Replace the painful manual work early.** Event registration, QR tickets, and devotional publishing are where Region 63 bleeds coordinator time today. Solving them in V1 buys organizational trust and drives account creation (a teen who registers for camp becomes a teen with a devotional streak).
3. **Community waits for safeguarding.** Prayer requests, groups, Friends, and Accountability Partners are high-value but involve minors interacting with each other. They ship only when moderation, reporting, and safeguarding infrastructure exist (`13-community.md`). That is V2 by design, not by neglect.
4. **Multi-region is architecture in V1, product in V2.** No region-specific hard-coding is ever allowed (`15-technical-architecture.md`), but the self-serve tooling to *onboard* a new region is a V2 deliverable. Building tenancy correctly costs ~15% extra in V1; retrofitting it later would cost a rewrite.

A deliberate exclusion: **mood tracking** does not appear in V1. See "Cut and deferred features" at the end of this document.

---

## Version 1 — "The Daily Companion" (Region 63 launch)

**Goal:** A Region 63 teen can build a daily Scripture habit, and the region can run its ministry operations on the platform.

**Theme:** Grow 🌱 + operational trust.

### Scope

| Area | Included |
|------|----------|
| Foundation | Authentication (email/phone + Google OAuth), profiles, RBAC roles, church hierarchy (Parish → Area → Zone → Province → Region), region tenancy |
| Today | Daily devotional (Teenage Open Heavens + regional devotionals) with its **memory verse as the Verse of the Day** (one verse powers the home screen card, notifications, share card, and challenge theme — "One Day. One Verse. One Message."), reading streak with grace days, one daily challenge, continue-reading card |
| Bible | Integrated Bible with 2 public-domain translations (WEB, KJV), book/chapter/verse navigation, reading position sync, continue reading, verse sharing (image + text), basic search, Scripture deep-links from all content |
| Library | Unified media library (articles, videos, podcasts) with categories, saved content, audio background playback via PWA |
| Events | Event creation, registration, capacity, payments (Paystack), QR tickets, check-in scanning, waitlists |
| Weekly Manuals | Teacher-facing weekly lesson manuals, viewable and downloadable |
| Notifications | Push (PWA) + in-app inbox; the **habit reminder ladder** (morning → afternoon → evening → final streak reminder, each canceled the moment the day's devotional is done), configurable intensity presets, event updates (`12-gamification.md`, `07-feature-specifications.md` #10) |
| Admin & Coordinator | Content publishing workflow (draft → review → publish), event management, member overview, basic analytics dashboard |
| Platform | PWA installable, offline devotional + Bible caching, analytics event pipeline, monitoring |

### Explicitly out of V1

Highlights/notes (Bible), reading plans, Journeys, memory-verse *practice* (spaced-repetition review — the memory verse itself ships in V1 as the Verse of the Day on every devotional), recognition/badges, prayer requests, small groups, Friends, Accountability Partners, parent access, licensed translations, native apps, AI features.

### Expected outcomes

- Devotional distribution fully replaces PDF-on-WhatsApp in Region 63.
- First cohort of Weekly Engaged Disciples; baseline WED established.
- One full regional event (registration → payment → QR check-in) runs end-to-end on the platform.

### Dependencies and risks

- **Paystack merchant setup** under the appropriate church entity must be resolved before event payments ship (legal/finance dependency, long lead time — start immediately).
- **Devotional content pipeline:** an editorial commitment from the regional team to publish daily. Software without content is an empty shell; secure a 60-day content buffer before launch.
- **Bible text ingestion:** WEB and KJV must be sourced, verified, and structured (see `08-bible-experience.md`, licensing section).

---

## Version 1.5 — "Deep Roots" (3–5 months post-launch)

**Goal:** Deepen the Scripture experience for teens who have formed the daily habit, and give leaders visibility.

**Theme:** Grow 🌱, deepened.

### Scope

- **Bible depth:** highlights, notes, bookmarks, reading history, cross-references, full-text search improvements.
- **Reading plans:** structured multi-day Bible plans (e.g., "Gospels in 40 days"), progress tracking.
- **Journeys:** the first guided discipleship programs (e.g., "Foundations: 21 days"), combining devotionals, Scripture, challenges, and reflection. Built on the reading-plan engine.
- **Memory-verse practice:** spaced-repetition review of the daily memory verse (already surfacing in V1 as the Verse of the Day) plus self-added verses; reviews count as spiritual actions (`08-bible-experience.md` §7).
- **Recognition:** unified milestones and certificates system (`12-gamification.md`). Certificates issued for Journey completion.
- **Search:** unified search across Bible, Library, and events.
- **Coordinator analytics:** engagement by parish/area, devotional completion, event attendance history.

### Sequencing rationale

Highlights and notes before Journeys because Journeys *use* the annotation engine. Recognition ships only after Journeys exist — certificates need something to certify. This version deliberately contains no new user-facing "surfaces"; it deepens the ones from V1, keeping the IA stable (`04-information-architecture.md`).

### Expected outcomes

- WED grows via retention, not just acquisition (D30 retention becomes the watched number).
- First 500 Journey completions and issued certificates in Region 63.

---

## Version 2 — "The Tribe" (6–12 months post-launch)

**Goal:** Community, safeguarding, family involvement, and the first new regions.

**Theme:** Connect 🤝 + Belong ❤️ + scale.

### Scope

- **Community:** moderated prayer requests, small groups tied to real church units, volunteer opportunities board. Full moderation, reporting, and safeguarding stack ships *first* within this version (`13-community.md`).
- **Friends:** mutual teen-to-teen connections for discipleship — friend requests, friend profiles, prayer requests to friends, encouragement notes, shared Journeys and reading plans, memory-verse challenges, optional event-attendance visibility, birthday celebrations, invite-a-friend. No follower counts, feeds, or likes. Ships behind the same safeguarding gate as all community features (`13-community.md`).
- **Accountability Partners:** a consent-based deeper tier of friendship — milestone celebration, optional inactivity nudges, praying together, walking Journeys together (`13-community.md`).
- **Parent access:** limited parent portal — event consent, payment, high-level (non-surveillance) progress visibility. See `13-community.md` for the privacy stance.
- **Licensed translations:** integrate API.Bible for additional translations; begin direct licensing conversations (NLT/NIV) if budget allows (`08-bible-experience.md`).
- **Multi-region onboarding:** self-serve region setup, national content layer (publish once, distribute to all regions), region-scoped admin roles. Onboard 2–4 pilot regions.
- **Seasonal campaigns:** Lent/Advent/camp-season reading campaigns run by national or regional teams.
- **Heart Check (reconsidered mood tracking):** an optional one-tap emotional check-in on Today, feeding *only* aggregated, anonymized pastoral insight. Ships only if the privacy design in `13-community.md` is satisfied; otherwise it stays cut.
- **Notification intelligence:** behaviour-learned reminder timing (the V1 ladder's rungs shift to each teen's actual completion window), digest batching, automatic step-down for unresponsive users (`12-gamification.md`).

### Dependencies

- Safeguarding policy ratified by regional/national leadership **before** any community feature is enabled (hard gate).
- Moderation staffing: trained coordinators per region with SLA commitments.
- National directorate agreement on shared content governance.

### Expected outcomes

- ≥2 new regions live with zero code changes (proof of tenancy architecture).
- Prayer requests, groups, Friends, and Accountability Partners active with zero unresolved safeguarding incidents.
- Teens with an accountability partner show measurably higher WED retention than matched teens without one (the feature's core hypothesis — `14-analytics.md`).
- Parent-approved event registrations reduce coordinator back-and-forth measurably.

---

## Version 3 — "Everywhere" (12–24 months post-launch)

**Goal:** National standard status, richer media, and intelligent study.

**Theme:** Scale + Serve 🙌.

### Scope

- **Native apps** (Android first, then iOS) once PWA limits become the binding constraint — better offline storage, reliable push, media downloads. The API-first architecture makes this additive (`15-technical-architecture.md`).
- **Audio Bible** (licensing permitting) and offline media packs for low-connectivity areas.
- **AI-assisted study tools:** "explain this passage," guided study questions, devotional-to-Scripture linking — with theological review guardrails defined by the content team (`08-bible-experience.md`, future AI section).
- **Localization:** Yoruba, Igbo, Hausa UI; French for francophone regions (`11-content-strategy.md`).
- **Serve pathways:** structured volunteer/leadership development tracks (Super Teen → worker pipeline), building on the volunteer board from V2.
- **National analytics:** cross-region dashboards for the national directorate.

### Expected outcomes

- Faith Tribe formally adopted as the RCCG national teens platform.
- Double-digit region count; WED measured nationally.

---

## Cut and deferred features (from the legacy list)

Part of this roadmap's job is to say no. From the current feature inventory:

| Legacy feature | Decision | Rationale |
|---|---|---|
| Mood Tracking | **Cut from V1; reconsidered as "Heart Check" in V2** | Standalone mood tracking is a wellness-app pattern with no clear ministry action attached, and it collects sensitive emotional data from minors. If it returns, it must be optional, minimal, and privacy-first. |
| Badges + Certificates + Achievements (3 systems) | **Merged into one Recognition system (V1.5)** | Three overlapping reward systems create noise and dilute meaning. One system, two artifact types (milestones, certificates). See `12-gamification.md`. |
| Podcasts + Videos + Articles + Media Library (4 features) | **Merged into one Library** | These are content types, not features. One content model, one browsing surface. See `04-information-architecture.md`. |
| Reading Streaks + Reading Progress (+ history) | **Merged into one Progress system** | A single progress model powers streaks, continue-reading, history, and plan tracking. |
| Saved Content + (Bible) Bookmarks | **One "Saved" surface** | Bible bookmarks remain contextual inside the Bible but surface in the unified Saved area. |
| Daily Challenges | **Folded into Today** | A challenge is a component of the daily experience, not a destination. |

## Roadmap governance

- The roadmap is reviewed quarterly against WED and the guardrail metrics in `14-analytics.md`.
- New feature proposals must state which core value they serve, which persona they serve, and what they replace — "other apps have it" is grounds for rejection (`01-vision.md`).
- Anything that would hard-code Region 63 is rejected regardless of speed gains.
