# CHANGELOG — Product Decisions Revision (July 2026)

This revision implements ten product decisions: Bible as core platform capability (reaffirmed), Verse of the Day = the devotional's memory verse, a Friends system, Accountability Partners, a habit-forming notification philosophy, an intentional streak-reminder strategy, expanded Grace Days, the connected daily experience, the "One Day. One Verse. One Message." principle, and a full consistency pass.

## Renamed / redefined concepts

- **Verse of the Day** — no longer a potential standalone system. It is now *defined as* the memory verse of today's devotional, one verse object powering the Today card, widgets, notifications, share cards, and the daily challenge theme. Memory verses moved from a V1.5 weekly-curated feature to a **required V1 field on every devotional**; the memorization *practice* (spaced repetition) remains V1.5.
- **"One Day. One Verse. One Message."** — added as product principle #9 (vision), a README non-negotiable, a design principle, and an editorial law.
- **Notification philosophy** — reframed from "calm = minimal" (hard cap of 1 non-transactional push/day) to "calm = completion-aware": a daily reminder ladder of up to four rungs, every rung canceled the instant the devotional is done, with user-chosen intensity presets and automatic step-down.
- **Grace Days** — expanded from a fixed 2/month into a full system: monthly grant, earning (+1 per perfect week, +1 per Journey), a 4-day holding cap, a 2-consecutive-day limit, and a proactive streak-pause mechanism for camps/exams.
- **Community model** — the absolute "group spaces only, no one-to-one anything" rule was deliberately revised: teen-to-teen **encouragement notes** now exist as a constrained, screened, retained, auditable channel within mutual Friendships. The ban on adult–teen private messaging remains absolute.

## Document-by-document changes

**README.md** — Non-negotiable #4 reworded (reminders help; guilt still banned); #5 extended to Friends/Partners; new non-negotiable #7 (One Day. One Verse. One Message.); terminology entries added (Memory Verse / Verse of the Day, Friends, Accountability Partners); CHANGELOG added to the document map.

**01-vision.md** — "Not social media" bullet updated for Friends; philosophy bullet on community updated for chosen friendships; product principle 5 (Calm) rewritten for the habit-reminder philosophy; principle 7 extended (relationships are chosen, never suggested); new principle 9 (One Day. One Verse. One Message.); Connect value expressions now include friends and accountability partners.

**02-roadmap.md** — Sequencing rule 3 includes Friends/Partners behind the safeguarding gate; V1 Today scope includes the memory verse as Verse of the Day; V1 Notifications scope replaced "strict frequency caps" with the reminder ladder; out-of-V1 list corrected (memory-verse *practice*, Friends, Partners); V1.5 memory-verse bullet rewritten as the practice layer; V2 gains Friends and Accountability Partners scope items, a smarter notification-intelligence line, and two new expected outcomes (including the partner WED-retention-lift hypothesis).

**03-user-personas.md** — Tolu: reminder and daily-verse needs, V2 friend need added; Emeka: natural-accountability-partner behavior added; Mr. Okafor: privacy boundary extended to encouragement notes.

**04-information-architecture.md** — Consolidation table gains the Verse of the Day + Memory Verse merge row; Today branch restructured (memory verse/VOTD card at 1.3, V1); Tribe branch gains the full Friends surface (4.3); Me → Settings gains Friends & privacy and richer notification preferences; system-relationships section gains the one-verse rule and the Relationship system as a shared service; scalability rule 2 includes Friends.

**05-navigation.md** — Notifications section rewritten for completion-aware sending; deep-link table gains Verse of the Day and friend-invite patterns (invite links auth-then-resume and never auto-friend).

**06-user-flows.md** — Flow 5 rewritten (memory verse in the reader, completion cancels reminders, challenge echoes the verse); flow 17 rewritten (ladder, presets, honest permission prompt, 7-day auto step-down); three new flows added: 22 Add a friend, 23 Set up an Accountability Partner, 24 A day in the streak (reminder ladder end to end); former flows 22/23 renumbered to 25/26 with all cross-document references updated.

**07-feature-specifications.md** — #4 Today: memory verse/VOTD acceptance criteria and the one-source-of-truth rule; #5 Content: memory verse is a required, publish-blocking devotional field; #8 Progress: expanded Grace Days reference and reminder cross-link; #10 Notifications: fully rewritten (ladder, presets, intelligent timing, auto step-down, central service enforcement; complexity M→L); #17 Announcements: batching language aligned; #19 cross-references the new specs; **new #21 Friends** and **new #22 Accountability Partners** with full AC and metrics.

**08-bible-experience.md** — §7 retitled "Memory Verses & the Verse of the Day" and rewritten around the single daily verse (V1), practice (V1.5), and friend challenges (V2); §11 operating rule 3 updated (daily verse defaults to WEB so share cards stay license-clean); §12 integration table gains memory-verse/VOTD and Notifications rows.

**09-design-principles.md** — New visual-principle paragraph for One Day. One Verse. One Message.; anti-principle 3 rewritten (shame-framed urgency banned; warm streak reminders sanctioned); new anti-principle 7 (no social-validation visuals).

**10-design-system.md** — Verse card renamed and expanded to the verse-of-the-day card; friend card added (no counts/metrics); bottom sheets gain the reminder-intensity picker, partner consent sheet, and encouragement note composer.

**11-content-strategy.md** — Tone table gains the streak-reminder row; devotional structure now includes the required memory verse and the "one truth" editorial check; the Notifications section rewritten with the four canonical rungs, the invite-vs-indict test, and an updated banned list; encouragement-note templates section added.

**12-gamification.md** — Hard rule 2 rewritten (guilt/shame banned; warm streak-preservation reminders explicitly sanctioned); rule 1 extended to friend surfaces; **new "Streak reminder strategy" section** (the four-rung ladder, intensity presets, V2 intelligent timing, software-enforced step-down, copy law); **Grace Days expanded into a full section** (allocation, earning, cap, anti-loophole limits, streak pause, analytics, UX voice); memory-verse section updated to the daily-verse model with friend challenges; **new "Friends & Accountability Partners" section** (what friendship funds vs. never funds); milestone taxonomy gains Connect milestones; motivation-psychology section updated (the reminder tension named and managed, relatedness via friends/partners, social support beats social pressure); success/guardrail metrics extended.

**13-community.md** — Design doctrine updated for real friendships; "What we will never build" rewritten: adult–teen private messaging stays absolute, open-ended unmonitored teen chat stays banned, and the constrained encouragement-note channel is defined with its conditions (this deliberate revision of the former group-only rule must be explicitly covered by the ratified safeguarding policy before Friends ships); **new Friends section** (mutual/teen-peer-only, no metrics, all capabilities, privacy-within-friendship); **new Accountability Partners section** (dual consent, status-never-content, silent exit); privacy law rule 1 extended (friend lists, encouragement notes, scoped safeguarding-lead audit exception); moderation pipeline covers note screening; parent boundaries extended; safety-by-design checklist expanded from 6 to 8 questions.

**14-analytics.md** — Notification metrics rebuilt per-rung with step-down monitoring; new Grace Days metric line; new Friends & Accountability metrics block (headline: WED retention lift for partnered teens; relationship analytics aggregate-only); guardrail table gains reminder-fatigue and grace-day-loophole rows; sharing loop names the VOTD card and friend invites; event taxonomy examples extended (`reminder_sent/acted`, `grace_day_applied`, `friend_request_sent`, `encouragement_note_sent`, etc.).

**15-technical-architecture.md** — Data model gains `memory_verse` (required on devotionals, single VOTD source), `grace_day_ledger`, `reminder_schedule`, `friendship`, `accountability_partnership`, `encouragement_note`, `verse_challenge`; model notes enforce adult–teen friendship rejection at the data layer and screening-gated note delivery; notifications infrastructure rewritten around the ladder scheduler with event-driven completion cancellation; offline daily-content tier names the memory verse.

**16-release-checklist.md** — Devotional-buffer item requires the memory verse on every entry (zero VOTD gaps); new test items for the reminder ladder (cancellation within seconds, step-down, timezone edges) and Grace Day logic (cap, consecutive limit, pause/resume); the ✧ community gate expanded to cover the encouragement-note channel, Friends server-side constraints, and partner consent/revocation; flow count updated to 26.

## Removed

- The hard cap of "max 1 non-transactional push per day" (superseded by the completion-aware ladder + presets + step-down; announcements retain a 1/day batch limit).
- The blanket ban on "loss-aversion notifications" (narrowed to a ban on guilt/shame framing; positively framed streak preservation is sanctioned).
- The absolute "no one-to-one communication between teens" rule (replaced by the constrained encouragement-note channel; the adult–teen ban is untouched).
- The standalone weekly-curated memory verse concept (superseded by the devotional's daily memory verse).

## Recommendations discovered during the revision

1. **Ratify the messaging revision formally.** The encouragement-note channel softens a prior absolute safeguarding rule. Regional/national leadership should explicitly approve its design (screening, retention, safeguarding-lead audit access) in the written safeguarding policy before V2 — the release checklist now enforces this, but the conversation should start now.
2. **Watch the ladder's first 90 days closely.** Per-rung conversion and the step-down rate will tell you quickly whether "Standard" (morning + evening) is the right default. If most teens resolve at rung 1, consider making Gentle the default and letting motivated teens opt up.
3. **The memory verse raises the editorial bar.** Every devotional author must now supply a verse that can stand alone on a share card and thread through the challenge. Update the devotional writer's guide and the 60-day buffer review to check verse quality, not just presence.
4. **Partner-nudge consent wording deserves teen testing.** The whole Accountability Partner feature hinges on teens genuinely understanding what they're enabling. Test the consent screen with real Region 63 teens before build.
5. **Grace Day pause vs. earn balance is a guess.** The +1/perfect-week earn rate and 14-day pause allowance are starting values; the analytics now exist to tune them — commit to reviewing after one exam season.
