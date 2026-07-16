# 12 — Gamification & Healthy Engagement

## The stance

Gamification in a discipleship product is spiritually dangerous if done carelessly. Done wrong, it teaches teens that Bible reading is a score, that God's approval is a streak, and that faith is a competition. Done right, it does what habit scaffolding has always done in Christian practice — daily offices, reading calendars, memory-verse cards — it lowers the friction of showing up until showing up becomes who you are.

**Design law:** every mechanic must answer *"does this help a teen love God more, or just the app more?"* If the honest answer is the app, cut it.

**Theological grounding for the team:** motivation should move, over time, from extrinsic (streaks, milestones) toward intrinsic (love of the Word). Mechanics are training wheels — they must be built to become unnecessary, and must never manufacture guilt (Romans 8:1 is a product requirement here, not just a verse).

## Hard rules (banned mechanics)

1. **No public leaderboards of spiritual activity.** Ever. Comparison corrodes both the "winners" (pride) and everyone else (shame). This includes friend surfaces ✧ — no ranked anything (`13-community.md`).
2. **No guilt or shame in notifications.** Streak-preservation reminders are a core, intentional feature (see "Streak reminder strategy" below) — but their wording must always invite, never indict. "Keep your streak alive — today's devotional is still waiting" is in-bounds; "Your streak is about to die!", "You're falling behind!", and anything engineered to sting are banned copy (`11-content-strategy.md`).
3. **No red/urgent visual treatment for missed days.** Missing a devotional is not an error state (`09-design-principles.md`).
4. **No variable-reward slot machines** (mystery boxes, random rewards) — that is addiction mechanics wearing a costume.
5. **No paid advantages.** Nothing in growth mechanics is ever purchasable.
6. **No comparative encouragement.** "You read more than 80% of teens" is banned (`11-content-strategy.md`).
7. **No punishment for rest.** Sundays spent fully at church, exam weeks, family time — the system must never frame real life as failure.

## Reading streaks (with Grace Days)

- A streak = consecutive days with ≥1 *spiritual action* (devotional completed, chapter read, journey step, challenge, verse review ✧ — the Progress system, `07-feature-specifications.md` #8).
- **Streak reset UX:** a reset shows the *new beginning*, not the loss: "Day 1 — fresh start" with warm copy; the previous streak is preserved in Progress as "longest streak" (history is honored, not erased).
- Streak milestones (7, 14, 30, 60, 100, 365) trigger one gentle celebration each (`09-design-principles.md` motion rules) and a private milestone in Recognition.
- The streak flame/leaf on Today is small and warm — a companion, not a taskmaster.

## Streak reminder strategy

Streaks are habit infrastructure, and habits need cues. Faith Tribe deliberately reminds teens before a streak expires — the pattern proven by Duolingo, Snapchat, and YouVersion — while rejecting those products' shame mechanics. The reminder is the friend who texts "coming tonight?"; it is never the debt collector.

**The daily ladder (completion-aware — every rung fires *only if* today's devotional is incomplete, and completing it cancels all remaining rungs instantly):**

| Rung | Default time | Register | Canonical copy |
|---|---|---|---|
| Morning | ~06:30 | Invitation | "Good morning! Today's devotional and memory verse are ready." |
| Afternoon | ~13:30 | Gentle question | "Have you had a chance to spend time in God's Word today?" |
| Evening | ~18:30 | Warm streak preservation | "Keep your streak alive. Today's devotional is still waiting." |
| Final | ~20:45 (always before quiet hours) | Open door | "There's still time to continue today's journey." |

**Intensity presets** (Settings → Notification preferences): **Gentle** (morning only) · **Standard** (morning + evening — the default) · **Committed** (full ladder). Every rung is individually toggleable and time-adjustable. The teen chooses how much help they want; the app never chooses for them upward.

**Intelligent timing (V2):** the ladder learns each teen's habitual window. A teen who consistently completes at 21:00 gets a later, compressed ladder; a 06:20 reader may only ever see rung 1. Signals: historical completion times, day-of-week patterns (school vs. Saturday vs. Sunday), and recent misses. The model shifts *when* rungs fire, never *how many* beyond the chosen preset.

**Software-enforced respect:** 7 consecutive days of ignored reminders auto-steps intensity down one level, with a transparent note ("We've quieted things down — turn reminders back up any time."). Fatigue is a product failure, not a user failure (`14-analytics.md` guardrails).

**Copy law:** every rung passes the invite-vs-indict test in `11-content-strategy.md`. Reminders reference *today's* devotional and verse — they carry the day's one message, not generic app-bait ("One Day. One Verse. One Message.", `01-vision.md`).

## Grace Days

Grace Days let a streak survive when life happens — exams, illness, travel, church camps, emergencies. The name is deliberate theology-in-product: grace is not earned and covers our gaps.

**Design:**

- **Allocation:** 2 Grace Days granted automatically on the 1st of each calendar month.
- **Earning more:** +1 Grace Day for each completed 7-day week (all 7 days active) and +1 per completed Journey ✧ — consistency generously funds future grace.
- **Cap:** a teen holds at most 4 Grace Days at a time; excess earnings simply don't accrue (no hoarding economy, no anxiety about "wasting" them).
- **Application:** automatic and visible — the teen wakes to "Grace covered Tuesday 🌱", never a decision screen at a moment of failure. No manual spending, no bargaining UI.
- **Anti-loophole limits:** Grace Days cover at most **2 consecutive** missed days; a third consecutive miss resets the streak (with fresh-start framing). Grace preserves a *habit* through interruptions; it must never quietly become a 4-days-a-month app. If a teen's usage pattern is systematically "grace-day-shaped," that is a signal for gentler goals, not more grace.
- **Extended absences** (camp weeks, exams): a teen can proactively **pause the streak** (Settings → Progress, up to 14 days, twice a year) — an honest mechanism so grace isn't stretched into fiction. A paused streak resumes where it left off.
- **Analytics:** grace-day save rate, consecutive-usage patterns, pause adoption, and post-grace retention (do grace-saved streaks keep going?) — `14-analytics.md`.
- **UX voice:** grace is celebrated, not itemized like a currency. The balance is visible in Progress, quietly; Today never shows a "2 grace days left!" scarcity counter.

## Faith Journeys ✧ (V1.5)

The centerpiece of *meaningful* progression (spec: `07-feature-specifications.md` #15).

- Journeys are finite, purposeful programs ("Foundations — 21 days", "Prayer — 14 days", camp-prep tracks, leadership pipelines).
- **Pause, never punish:** miss days and the journey simply waits; "continue Day 9" not "9 days behind".
- Completion is the product's most celebrated moment: certificate issued, one warm animation, optional share.
- Journeys are the healthy replacement for shallow point systems: progression through *content and practice*, not through abstract XP. **There is no XP/points/level system in Faith Tribe** — this is a deliberate rejection of the Duolingo pattern, which optimizes for app-love, not Word-love.

## Recognition: milestones + certificates ✧ (V1.5)

One unified system replacing the legacy badges/achievements/certificates trio (`04-information-architecture.md`).

**Milestones** — automatic, personal, private-by-default:

- Taxonomy by value: Grow (first devotional, 7-day streak, first full book read, 100 chapters, plan completed), Connect (first event attended, first prayer posted ✧V2, first encouragement note sent ✧V2, first shared Journey completed ✧V2), Serve (first volunteer service ✧V2), Belong (profile completed, 1-year anniversary).
- Rendered as warm illustrated marks (`09-design-principles.md`), collected in Me → Recognition. Sharing is opt-in per milestone; nothing auto-posts.
- Deliberately finite and meaningful — dozens, not hundreds. A milestone inflation audit runs before any new one is added.

**Certificates** — issued, verifiable artifacts for completing substantial programs (Journeys, training tracks):

- Beautiful shareable image/PDF; carries name, program, date, issuing scope (e.g., "RCCG Region 63 Teens"), and a verification ID (verifiable link — matters for Serve pathways and real-world ministry recognition).
- Certificates are the bridge between in-app growth and real church recognition: a coordinator can honor Journey completers at a physical service — the app feeds the church, per the philosophy (`01-vision.md`).

## Daily challenges

- One per day on Today; small, real, often *off-screen*: "Text someone an encouraging verse", "Pray for one friend by name", "Read Psalm 1" (deep-links and auto-completes — `08-bible-experience.md`).
- Skippable without any penalty or nag; completing counts as a spiritual action.
- Challenge authorship is editorial (content team), themed with the devotional where possible.

## Memory verse tracking

- **V1:** every devotional carries a memory verse — the day's Verse of the Day, one source of truth ("One Day. One Verse. One Message.", `08-bible-experience.md` §7).
- **V1.5:** spaced-repetition reviews of daily and self-added verses surface on Today; reviews count toward streaks.
- **V2:** **memory-verse challenges with friends** — two teens commit to the same verse; each sees the other's completion, nothing more. No scores, no times, no public recitation scoreboards; the shared commitment *is* the mechanic (`13-community.md`).
- Mastery is private; a "verses hidden in my heart" count lives in Progress.

## Friends & Accountability Partners ✧ (V2)

Relational mechanics are the most powerful motivator we have — and the easiest to corrupt into social comparison. The rules (full design: `13-community.md`, spec: `07-feature-specifications.md` #21–22):

- **What friendship funds:** encouragement notes, prayer for one another, shared Journeys and plans (mutual progress visible for that Journey only), memory-verse challenges, celebrating milestones. Relatedness — the third Self-Determination nutrient — supplied through *chosen, mutual* relationships.
- **What friendship never funds:** comparison. No friend leaderboards, no streak comparisons, no "Emeka read more than you," no visible friend counts. A friend sees what you *chose* to share and the shared things you *do together* — never your dashboard.
- **Accountability Partners** add consent-based consistency support: milestone celebrations, and (only if pre-enabled by the teen) an inactivity nudge to the partner after ~3 quiet days — turning a lapse into a human check-in instead of another push notification. The nudge reveals activity *status*, never content.
- The healthiest engagement loop in the product is intended to become: reminder → devotional → verse → encourage a friend with it.

## Reading goals

- Optional, self-set, private: "I want to read 3 days a week" — the app then *measures against the teen's own goal*, not against other teens or an imposed ideal.
- Goal check-ins are monthly and gentle; goals can be lowered without ceremony (lowering a goal is framed as wisdom, not failure).

## Seasonal campaigns ✧ (V2)

- Region- or national-run seasons (Advent reading, Lent, camp countdown, "40 days of Acts") built on the Journeys engine — no parallel mechanics (`04-information-architecture.md` scalability rules).
- Campaigns may show *collective* progress ("Region 63 has read 40,000 chapters together this Advent") — **collective, never ranked-individual**. Shared accomplishment builds Belong ❤️ without comparison.

## Progress tracking

- Me → Progress: current/longest streak, chapters read, devotionals completed, journeys/plans, a personal calendar heat-map (`10-design-system.md` charts) — private by default, always.
- Leaders see only aggregates and coarse pastoral signals (e.g., inactivity flags — `03-user-personas.md`, Mrs. Adebayo), never individual reading detail, notes, or highlights (`13-community.md` privacy rules).

## Motivation psychology (why this design)

- **Habit formation:** cue (the reminder ladder, timed to the teen's real window) → routine (Today, <5 min) → reward (completion moment + streak tick). The loop is honest: the real reward is time with God; mechanics only mark it. The ladder exists because a habit's weakest point is the forgotten cue — most misses are forgetting, not refusing, and a well-timed reminder serves the teen's *own* stated intention.
- **The reminder tension, named:** persistent reminders and "never manipulate" live in tension, and we manage it with three controls — completion-awareness (a consistent teen gets one reminder or none), user-chosen intensity (the teen sets the ladder), and software-enforced step-down (ignoring us makes us quieter). A reminder system with those three properties helps; without them, it harasses.
- **Self-Determination Theory:** we fund *autonomy* (self-set goals, chosen reminder intensity, skippable challenges, opt-in sharing), *competence* (visible growth, finite journeys), and *relatedness* (friends, accountability partners, collective campaigns, real-church recognition) — the three intrinsic-motivation nutrients. Points/leaderboards fund none of them; they fund contingent self-esteem, which is why they're banned.
- **Fresh-start effect:** resets and Mondays are framed as beginnings; Grace Days blunt the "what-the-hell effect" where one miss collapses the habit.
- **Goal-gradient care:** journeys show progress-to-finish (motivating) but never time-behind-schedule (shaming).
- **Social support beats social pressure:** an accountability partner's human check-in outperforms — and out-dignifies — an app's tenth push. Where a relationship can carry the nudge, we route it through the relationship.

## Success and guardrail metrics (`14-analytics.md`)

- Success: WED growth, streak retention curves, journey completion ≥40%, grace-day save rate, per-rung reminder→devotional conversion, % of days resolved at rung 1.
- **Guardrails:** reminder opt-out rate <5%/quarter; auto step-down activation monitored (a rising rate means our defaults are too loud); no measurable spike of "empty actions" (opens without reading — dwell-time validation); no upward drift in grace-day-shaped usage patterns; qualitative teen interviews each quarter asking, in effect, *"does the app make you feel guilty?"* and *"do the reminders feel like a friend or a debt collector?"* — a bad trend on either triggers a mechanics review.
