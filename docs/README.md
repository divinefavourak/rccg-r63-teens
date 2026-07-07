# Faith Tribe — Product Handbook

Faith Tribe is a digital discipleship platform for teenagers in RCCG. This folder is the single source of truth for what we are building, why we are building it, and how it should feel. Every designer, engineer, and coordinator joining the project should read these documents before touching Figma or a code editor.

**First deployment:** RCCG Region 63.
**Design target:** Every RCCG Region, without re-architecture.

## Reading order

New team members should read in this order:

1. `01-vision.md` — why Faith Tribe exists, and how we define success
2. `03-user-personas.md` — who we are building for
3. `04-information-architecture.md` — how the product is organized (including the feature consolidation decisions)
4. `08-bible-experience.md` — the foundation of the product
5. `02-roadmap.md` — what we build, in what order
6. Everything else, as your role requires

## Document map

| # | Document | Owner role | Purpose |
|---|----------|-----------|---------|
| 01 | vision.md | Product | Vision, mission, philosophy, North Star Metric |
| 02 | roadmap.md | Product | V1 → V3 staged roadmap, sequencing, dependencies |
| 03 | user-personas.md | Product / Design | Six personas with journeys |
| 04 | information-architecture.md | Design | Full product hierarchy, feature consolidation |
| 05 | navigation.md | Design | Navigation across devices, roles, and states |
| 06 | user-flows.md | Design | End-to-end journeys, error and empty states |
| 07 | feature-specifications.md | Product / Engineering | Per-feature specs with acceptance criteria |
| 08 | bible-experience.md | Product / Design | The integrated Bible, licensing, integrations |
| 09 | design-principles.md | Design | Visual philosophy, motion, accessibility |
| 10 | design-system.md | Design / Engineering | Tokens, components, scales |
| 11 | content-strategy.md | Content | Voice, tone, terminology, localization |
| 12 | gamification.md | Product | Healthy engagement mechanics |
| 13 | community.md | Product / Safety | Prayer, groups, moderation, safeguarding |
| 14 | analytics.md | Product / Data | Metrics framework and dashboards |
| 15 | technical-architecture.md | Engineering | Architecture, multi-region, offline, PWA |
| 16 | release-checklist.md | All | Launch gate for Region 63 |
| — | CHANGELOG.md | Product | Revision history of major product decisions |

## Non-negotiables

These decisions are settled and should not be relitigated in individual documents:

1. **The Bible is the foundation, not a feature.** Every Scripture reference in the app opens the integrated Bible (`08-bible-experience.md`).
2. **Region 63 is a tenant, not the product.** No table, screen, or workflow may hard-code Region 63 (`15-technical-architecture.md`).
3. **Mobile-first, offline-tolerant, data-light.** Our users are Nigerian teenagers on low-end Android devices with expensive data.
4. **Encouragement over shame.** Reminders help teens stay consistent, but no mechanic or message may guilt or punish a teen for missing a day (`12-gamification.md`).
5. **Safeguarding is a launch blocker.** We serve minors. Community features — including Friends and Accountability Partners — ship only with moderation and safety infrastructure (`13-community.md`).
6. **Fewer, deeper features.** The legacy feature list has been consolidated (`04-information-architecture.md`, section "Consolidation decisions"). Do not resurrect merged features under new names.
7. **One Day. One Verse. One Message.** Each day reinforces one central biblical truth. The daily devotional is the center; its memory verse is the day's single verse, powering the Verse of the Day, notifications, share cards, and the daily challenge theme (`01-vision.md`, `07-feature-specifications.md` #4).

## Terminology

Use these terms consistently across product, design, and code:

- **Today** — the unified daily experience (devotional, memory verse, streak, daily challenge)
- **Memory Verse / Verse of the Day** — one and the same. Every devotional carries a memory verse; that verse *is* the Verse of the Day. There is no separate Verse of the Day system.
- **Friends** — mutual, teen-to-teen discipleship connections (requests, prayer, encouragement, shared Journeys). Not social media: no follower counts, feeds, or likes.
- **Accountability Partners** — a deeper, consent-based tier of friendship for walking together (milestone celebration, optional inactivity nudges, praying together)
- **Library** — all media content (podcasts, videos, articles) in one system
- **Journeys** — multi-day guided spiritual programs (formerly "Faith Journeys")
- **Recognition** — the unified milestones + certificates system (formerly badges, achievements, certificates as separate features)
- **Saved** — all bookmarked content across the app
- **Parish → Area → Zone → Province → Region → National** — the RCCG hierarchy, in ascending order
