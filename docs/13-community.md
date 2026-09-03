# 13 — Community & Safeguarding

## The stance

Faith Tribe serves minors. That single fact governs this entire document. Community features (Connect 🤝, Belong ❤️) are among the most valuable things we can build — and the most dangerous to build carelessly. Therefore:

**The safeguarding gate:** no community feature ships until the moderation infrastructure, reporting flows, staffing commitments, and a leadership-ratified safeguarding policy in this document are all live. This is why community is V2, not V1 (`02-roadmap.md`).

**Design doctrine:** Faith Tribe community mirrors *real church structure and real friendships*, not open social networking. Teens interact within groups anchored to their actual parish/area and with friends they mutually chose, overseen by safeguarding infrastructure and accountable adults. We are digitizing the teens' class and their church friendships, not building Discord.

## What we will never build

- Open public feeds, discover-strangers features, or friend-suggestion algorithms.
- **Private messaging between any adult and a teen.** Absolute and non-negotiable, regardless of role, feature pressure, or "trusted leader" arguments. Adults interact with teens only in group spaces visible to other assigned leaders (two-adult visibility principle).
- **Open-ended, unmonitored teen-to-teen chat.** Teen friends may exchange *encouragement notes* — a deliberately constrained channel (see Friends below): template-anchored, length-limited, automatically safety-screened, fully retained, auditable by designated safeguarding leads, reportable and blockable on every message. What we will not build is free-form real-time private chat that no accountable adult could ever review. This is a deliberate revision of an earlier group-spaces-only rule, made to serve real discipleship friendships — and it stands only inside these constraints, which the ratified safeguarding policy must explicitly cover before Friends ships.
- Follower graphs, friend-suggestion algorithms, or stranger-discovery. (Public likes and reposts exist **only** on Community Notes — a deliberate leadership decision, see below — and nowhere else; friend lists and profiles still carry no counts.)
- Location sharing between users.
- Disappearing messages (everything is retained and auditable).

## Friends ✧ V2

Faith Tribe includes a Friends system because discipleship is relational — teens sharpen teens (Proverbs 27:17). It is explicitly **not social media**: the goal is encouragement, prayer, accountability, and shared growth, never social validation.

**Structure and safety:**

- **Mutual only, teen-peer only.** Friendship requires a request and an acceptance; adults can never friend teens (leaders relate through group spaces and role surfaces). Requests originate from invite links a teen shares (WhatsApp-native growth) or from fellow members of the teen's own groups — there is no stranger discovery and no suggestion engine.
- **No metrics.** No follower counts, no friend counts displayed to others, no likes, no activity feeds, no popularity signals of any kind. A teen's friend list is visible only to them.
- Declines are silent; block and remove are silent, instant, and available from every friend surface; requests and notes are rate-limited.

**What friends can do together:**

- **Prayer requests to friends:** share a request with chosen friends (in addition to group prayer walls); friends respond with "🙏 I prayed" and encouragement notes.
- **Encouragement notes:** the constrained messaging channel — pastoral templates (`11-content-strategy.md`) plus short personal text; automated safety screening before delivery (flagged notes hold for human review); every note retained, auditable by designated safeguarding leads, and reportable in one tap. Notes are asynchronous by design (a note and a reply, not a chat thread) — the pace of a card, not a group chat.
- **Shared Journeys and reading plans:** invite a friend to walk a Journey together; each sees the other's step completion *for that Journey only*.
- **Memory-verse challenges:** commit to the same verse together; each sees the other's completion — no scores (`12-gamification.md`).
- **Event attendance visibility:** per-event, opt-in, off by default ("let friends see I'm going") — helps a nervous teen know a friend will be at camp.
- **Birthday celebrations:** friends are prompted to send an encouragement note on a teen's birthday, if the teen enabled birthday visibility.
- **Invite friends:** shareable invite links; an invited friend landing in the app is the healthiest growth loop community can have.

**Privacy within friendship:** friends see a teen's profile basics, whatever milestones the teen opted to share, and the shared activities above. They never see reading detail, notes, highlights, streak dashboards, prayer requests not shared with them, or Heart Check — friendship grants what is *given*, not access to what is *private*.

## Accountability Partners ✧ V2

A deeper, consent-based tier of friendship for teens who want someone walking with them (1–3 partners; partners must already be friends).

- **Dual consent, plainly worded:** both teens see and accept the exact list of what a partner receives — milestone celebrations, daily activity *status* (active today / not yet), and, **only if the teen switches it on in advance**, an inactivity nudge after ~3 quiet days ("Tolu hasn't been around for a few days — send some encouragement?").
- **Status, never content:** a partner never learns what was read, prayed, noted, or felt — only whether their friend has shown up. Consistency is shared; the inner life stays private.
- **Together-features:** a shared prayer list, pray-together prompts, shared Journeys, and a celebrate action on milestones.
- **Exit without ceremony:** either teen ends the partnership at any time, silently, from Settings → Friends & privacy; every permission revokes instantly. Leaving must cost nothing socially, or consent was never real.
- The design goal: when a teen goes quiet, the response is a *friend reaching out*, not a tenth push notification (`12-gamification.md`).

## Prayer Requests (Prayer Wall) ✧ V2

The flagship community feature: teens sharing burdens and praying for one another.

- **Scoped:** prayer walls exist per group (class/small group) and optionally per parish — never global/regional open walls in V2.
- **Pre-moderated by default:** a request is visible only after approval by the group's teacher/moderator. Latency target <2h during waking hours; the submitting teen sees "shared with your leaders, going up soon" — honest about the process.
- **Anonymous option:** a teen may post anonymously *to peers*; the moderating leader always sees the author (accountability + pastoral care). This is disclosed plainly in the composer: "Your name is hidden from others, but your teacher can see it."
- **Interaction:** a single "🙏 I prayed" response and optional short encouragements (also pre-moderated in V2; post-moderation may be earned later). No open-ended comment threads at launch.
- **Crisis pathway:** the composer and moderation tooling include a clearly defined escalation path — content indicating harm to self or others, abuse, or crisis routes immediately to the designated safeguarding leads for the scope (trained coordinators), with response-time commitments and a documented offline protocol (contact teen, parents/guardian, appropriate authorities per policy). Software surfaces; humans respond. Writing this protocol with regional leadership is a launch precondition.
- Answered prayers can be marked ("God answered 🙌") — testimonies feed faith.

## Community Notes ✧ V2

Short testimonies and encouragements a teen posts to their tribe — "God showed up for me today." **This is a deliberate exception to the no-popularity stance:** Community Notes carry public **likes and reposts**, with visible counts, and may be sorted by most-liked. It was a leadership product decision (July 2026), made because a reaction-free space felt lifeless — here, visible affirmation is the point. The exception is scoped to Community Notes only; friend lists, profiles, and streaks still show no counts.

Because these are minors posting to each other, the full safeguarding gate still applies (this is why Notes are V2, not V1):

- **Scoped to real church structure, not a global feed:** a note posts to the teen's parish/area tribe, and reposts stay within the teen's own hierarchy scope. No stranger discovery and no algorithmic "for you" ranking beyond likes/recency sorting.
- **Pre-moderated and screened:** notes pass the same automated safety screen and human review as prayer requests before going live; flagged notes hold for review (`## Moderation system`).
- **Reportable and blockable:** every note carries a one-tap Report; blocking a user hides their notes.
- **Public counts, private reactor list:** the like/repost *number* is public (the sanctioned exception), but the list of *who* reacted is visible only to leaders/safeguarding — a teen sees the count, not a name-and-shame roster. [Design to confirm this split.]
- **Crisis pathway applies:** a note indicating harm to self or others routes to the designated safeguarding leads exactly as a prayer request does.

## Small Groups (My Group) ✧ V2

- Groups map to real units: a teens class, a Super-Teen-led cell, an event cohort. Created by teachers/coordinators; teens are placed or join via invite — no open group discovery.
- Group space contains: announcements, prayer wall, shared content (teacher-suggested devotionals/plans), member list (first names + avatars only), and — later, earned — a moderated group chat. Chat ships *after* the prayer wall proves the moderation model, not with it.
- Every group has ≥1 assigned adult leader; a group whose leader is removed locks to read-only until reassigned.

## Serve (volunteer opportunities) ✧ V2

- Coordinators post opportunities scoped to hierarchy; teens express interest; coordinator approves (spec: `06-user-flows.md` flow 18). Approval-based — teens never self-assign to serving roles involving responsibility.
- Serving history lives in the teen's Recognition surface and feeds the V3 leadership pathway (`02-roadmap.md`).

## Moderation system ✧ V2 (infrastructure)

- **Roles:** group leaders moderate their groups; coordinators moderate their scope; regional admins hold final authority; a national policy layer arrives with multi-region (V2).
- **Tooling (Console → Moderation):** approval queues, reported-content queue with SLA timers, user-level actions (warn, mute-in-group, suspend — each logged, each reversible except where policy requires permanence), full audit trail of every moderation action.
- **Layered approach:** automated keyword/pattern screening as a *triage aid* (flags, never auto-publishes borderline content; encouragement notes pass through the same screen pre-delivery, with flagged notes held for human review) + human review as the decision layer. In a ministry context, false-negative harm outweighs moderation labor — default to human eyes.
- **Staffing gate:** each region enabling community must name trained moderators with coverage commitments before the feature flag turns on. Training materials are a deliverable of V2, co-authored with regional leadership.

## Reporting

- Every piece of user-generated content and every profile carries a low-friction **Report** action (reason picker + optional note).
- Reports are confidential; the reported user never learns the reporter's identity.
- SLA: acknowledged in-app immediately; human-reviewed within 24h (crisis categories: immediate escalation path, above).
- Repeated bad-faith reporting is itself handled pastorally, not just punitively — these are teenagers.

## Privacy

The privacy rules below are product law, referenced throughout the handbook:

1. **Private means private.** Bible notes, highlights, saved items, reading detail, memory-verse performance, Heart Check responses, AI-study questions, friend lists, and encouragement notes are visible to the teen (and, for notes, their recipient) alone — not teachers, not coordinators, not admins, not parents. The single exception: designated safeguarding leads may audit encouragement notes under the safeguarding policy (safety review, report response) — a scoped, logged safeguarding function, never routine leader visibility. (`08-bible-experience.md`, `12-gamification.md`.)
2. **Leaders see aggregates and pastoral signals only:** counts, completion rates, and coarse inactivity flags ("no activity in 21 days") — never content of a teen's private spiritual life.
3. **Data minimization:** we collect what ministry requires and nothing more; every field in signup must justify itself (`07-feature-specifications.md` #1).
4. **NDPR compliance** (Nigeria Data Protection Act/NDPR): lawful basis documented, privacy notice in plain teen-readable language, guardian consent handling for minors per counsel's guidance, data-subject rights (access/correction/deletion) honored with real workflows, breach-response plan in place (`16-release-checklist.md`).
5. **Retention:** community content and moderation logs retained per policy schedule; deleted accounts are erased or irreversibly anonymized within a defined window, with safeguarding-hold exceptions where legally required.

## Parent access & controls ✧ V2

Design philosophy: **parents are partners, not surveillance operators.** Building parent-spyware would teach teens to hide their spiritual life — the opposite of the mission.

Parents (linked via teen-initiated invitation or event-registration contact) can:

- See event details, give consent, and pay (`06-user-flows.md` flow 12; `03-user-personas.md`, Mr. Okafor).
- Receive safety notifications ("checked in at camp").
- See *high-level* growth moments the teen's settings allow ("completed the Foundations journey") — headline milestones, opt-out-able by the teen for non-safety items.

Parents can **not**: read notes, prayers, highlights, encouragement notes, or Heart Check data; see the teen's friend list or browsing detail. This boundary is stated openly to both parties — trust in the platform depends on teens knowing exactly what is and isn't visible. (Safeguarding escalations that require parent involvement follow the crisis protocol, which is a human process, not a dashboard.)

Consent architecture: guardian consent for under-16s (or as counsel determines under NDPR) is captured at registration for data processing, and per-event for participation/payment.

## Heart Check ✧ V2 — conditional

The reconsidered "mood tracking" (`02-roadmap.md`): a one-tap optional check-in on Today ("How's your heart today?" — 4 gentle options). Ships only under all of these conditions: individually invisible to all leaders and parents; used solely for (a) the teen's own private reflection view and (b) fully aggregated, k-anonymous pastoral insight at area level or higher ("teens region-wide reported heavier hearts during exam season"); no streak/reward attached (honesty must cost nothing); crisis-language free-text is *not* collected (no free text at all in V2). If any condition can't hold, the feature stays cut.

## Church structure as the community backbone

The hierarchy system (`07-feature-specifications.md` #3) is what makes safe community possible: every teen, leader, group, and content item has a place in a real accountability structure. Community features inherit that structure rather than inventing a parallel social graph — this is the architectural expression of "community over algorithms" (`01-vision.md`).

## Safety by design summary (checklist for every future community feature)

1. Is every group space overseen by an identified, accountable adult leader?
2. Is adult–teen private messaging still impossible, and is every teen–teen channel constrained, screened, retained, and auditable by safeguarding leads?
3. Is there a report path, a block action, a moderation queue, and an SLA?
4. Is the crisis escalation path wired and staffed?
5. Is every relationship mutual and consent-based, with silent, cost-free exit?
6. Does it collect the minimum data, with teen-comprehensible disclosure?
7. Does it create any comparison, popularity, or validation surface? If yes, redesign — **except Community Notes**, where public likes/reposts are a sanctioned, moderated exception (see Community Notes). Nowhere else.
8. Would a parent, shown exactly how it works, feel their teen is safer here than on WhatsApp? If not, redesign.
