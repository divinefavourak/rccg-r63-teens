# 14 — Analytics & Measurement

## Measurement philosophy

We measure **spiritual actions, not attention**. Time-in-app, session counts, and scroll depth are diagnostics, never goals — a teen who reads the devotional in four minutes and leaves is a success (`01-vision.md`). Every dashboard in this document should make someone act pastorally or editorially, not just watch numbers move.

Privacy law from `13-community.md` applies to analytics absolutely: leaders see aggregates and coarse signals; individual spiritual detail (what a teen read, noted, prayed, or felt) is never a reporting surface.

## North Star Metric

> **Weekly Engaged Disciples (WED):** teens completing ≥1 meaningful spiritual action on **3+ distinct days** in a week.

Qualifying actions (the `spiritual_action` event stream — `07-feature-specifications.md` #8): `devotional_completed`, `chapter_read`, `journey_step_completed`, `challenge_completed`, `verse_reviewed` ✧.

Definitions that keep WED honest:

- Days are per-user timezone (Africa/Lagos default); an action counts once per content item per day.
- `devotional_completed` requires the scroll+dwell heuristic (≥90% scroll, ≥60s) — no tap-to-complete gaming.
- `chapter_read` requires dwell proportional to chapter length (floor 45s) — page-flipping doesn't count.
- WED is reported weekly, with 4-week rolling average as the headline number.

## Metric tree

```
WED (North Star)
├── Reach: how many teens can act
│   ├── Registered accounts (by parish/area/…)
│   ├── Activation rate (signup → first spiritual action ≤7 days)  [target ≥70%]
│   └── MAU
├── Frequency: how often they act
│   ├── DAU, WAU, MAU and ratios (DAU/MAU stickiness) [target ≥25%]
│   ├── Actions per active day
│   └── Streak distribution; grace-day save rate
├── Depth: what the actions are
│   ├── Devotional completion rate (opened → completed) [target ≥75%]
│   ├── Devotional → Bible tap-through [target ≥50%]
│   ├── Chapters read / WED / week
│   ├── Plan & Journey start→completion ✧ [journeys ≥40%]
│   └── Memory verse reviews ✧
└── Retention: do they keep acting
    ├── D1 / D7 / D30 retention (cohort curves)
    ├── W4 WED retention (a WED still WED four weeks later) [key health metric]
    └── Resurrection rate (inactive 30d → active)
```

## Supporting metric definitions

- **DAU/WAU/MAU:** users with ≥1 *spiritual action or intentional content interaction* that day/week/month. App-opens alone don't count — we refuse to flatter ourselves.
- **Retention:** classic cohort retention on activity as defined above; reported per signup cohort and per region.
- **Devotional completion:** completes ÷ opens, per devotional — this is also an *editorial* metric: consistently low-completing devotional styles inform the content team (`11-content-strategy.md`).
- **Bible reading:** chapters read (total, per active), books completed, offline-read share (validates caching strategy — `08-bible-experience.md`), search success rate.
- **Reading plans / Journeys ✧:** starts, active, completion rate, median days-to-complete vs. design length, drop-off step analysis (which day loses people — feeds content revision).
- **Events:** view→registration conversion, registration→payment conversion, payment success rate (target ≥90% — Paystack channel mix monitored), waitlist promotion rate, check-in rate (attended ÷ confirmed), check-in throughput.
- **Push notifications:** opt-in rate, per-rung reminder→action conversion within 2h, % of days resolved at rung 1 (a healthy habit base rarely needs rung 3), auto step-down activation rate, and the critical **guardrail: opt-out/disable rate <5% per quarter** — if reminders start burning trust, the software quiets itself before teens have to (`12-gamification.md`, `07-feature-specifications.md` #10).
- **Grace Days:** save rate (streaks preserved), consecutive-usage patterns (loophole watch), streak-pause adoption, post-grace retention.
- **Friends & Accountability ✧:** % of actives with ≥1 friend / ≥1 partner; encouragement notes sent (and screen-flag rate — a safety metric); shared-Journey completion vs. solo; partner nudge→re-engagement conversion; **WED retention lift for partnered teens vs. matched non-partnered teens** — the headline hypothesis for the whole relational layer (`02-roadmap.md` V2 outcomes). Relationship analytics are aggregate-only; no leader dashboard ever shows who is friends with whom (`13-community.md`).
- **Sharing loop:** verse shares/week (the Verse of the Day card is the primary share object), share→install→signup conversion (deep-link attributed), friend-invite conversion ✧ — the organic growth engine's health.

## Guardrail metrics (things we refuse to break)

| Guardrail | Threshold | Response if breached |
|---|---|---|
| Notification opt-out rate | <5%/quarter | Reduce send frequency; audit copy |
| Reminder fatigue (7-day ignore → auto step-down) | Step-down rate not rising | Quieter defaults; timing model review (`12-gamification.md`) |
| Grace-day loophole pattern (systematic 2-miss cycles) | No upward trend | Nudge toward self-set goals / streak pause, not more grace |
| "Empty actions" (opens with no qualifying dwell) | No upward trend | Audit completion heuristics & mechanics for gaming pressure |
| Guilt signal (quarterly teen interviews: "does the app make you feel guilty?") | No yes-trend | Mechanics review per `12-gamification.md` |
| Session length | Not a growth target; alert if median balloons | Investigate for attention-trap behavior we accidentally shipped |
| Community incident SLA ✧ | 100% within policy times | Staffing/process escalation (`13-community.md`) |

## Coordinator analytics (Console, scope-limited)

Chinedu (Area Coordinator — `03-user-personas.md`) sees, for his area only:

- Teens registered per parish; activation and WED% per parish (aggregate).
- Event funnel and attendance for his events; historical attendance.
- Announcement reach (delivered/opened, aggregate).
- **Pastoral signals:** count and list of teens inactive ≥21 days *within his scope* (name + last-active only — the flag exists to prompt a phone call, and shows nothing about what the teen did or didn't read).
- Exports: CSV for the reports he must send upward — killing the midnight-spreadsheet ritual is a product goal (`07-feature-specifications.md` #18).

## Admin analytics (regional)

Funmi sees region-wide:

- WED and the full metric tree, drillable by province → zone → area → parish.
- Content performance: devotional completion by item/author/series; Library reach and completion; pipeline health (gap alerts).
- Event portfolio: regional calendar, revenue summaries, payment reconciliation state.
- User administration health: unassigned-parish count, role coverage (parishes without teachers).
- Weekly automated email digest: WED movement, top/bottom devotionals, upcoming pipeline gaps — analytics that come to her (`03-user-personas.md`).

## National analytics ✧ (V2/V3)

Cross-region WED league is **deliberately not built** — regions are not competitors (`12-gamification.md` anti-comparison applies to leaders too). National view shows totals, trends, and per-region health for *support allocation*, plus shared-content performance across regions.

## Event taxonomy & instrumentation

- Naming: `object_action` (`devotional_completed`, `event_registration_started`, `verse_shared`, `bible_search_performed`, `reminder_sent` / `reminder_acted` (with rung), `grace_day_applied`, `streak_paused`, `friend_request_sent` ✧, `encouragement_note_sent` ✧, `partner_nudge_sent` ✧, `verse_challenge_completed` ✧). Every event carries: user pseudo-ID, role, hierarchy scope IDs, region, platform, app version, connection class (2G/3G/4G/wifi — performance analysis), offline-queued flag.
- Client events queue offline and sync (analytics must not distort under Nigerian connectivity — an offline devotional read counts the day it happened, not the day it synced).
- Implementation: lightweight client SDK → ingestion endpoint → warehouse; dashboards in a BI layer; no third-party ad-tech SDKs (privacy stance, minors — `13-community.md`; also bundle-size budget, `15-technical-architecture.md`).
- Every feature spec must ship its events (`07-feature-specifications.md`, cross-feature AC #4); an events catalog is maintained in the repo.

## Reporting rhythm

- **Weekly:** WED + guardrails auto-digest to product team and regional admin.
- **Monthly:** cohort retention review; editorial performance review with content team.
- **Quarterly:** roadmap review against targets (`02-roadmap.md` governance); teen interview panel (qualitative guardrail).

## Launch-year targets (restating `01-vision.md`)

Activation ≥60% of Region 63 registry in 6 months · WED ≥25% of actives by month 6 · ≥90% of regional events on-platform · devotional distribution fully migrated off PDF/WhatsApp.
