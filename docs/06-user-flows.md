# 06 — User Flows

Flows are written as numbered steps with decision points (◇), system actions (⚙), and failure branches (✖). Personas from `03-user-personas.md` are referenced by name. All flows assume mobile unless stated; all must survive a 3G connection and a mid-flow network drop.

**Global flow rules**

- Every flow must be completable one-handed on a 360px screen.
- Every network action shows optimistic or skeleton feedback within 100ms (`09-design-principles.md`).
- Every failure branch ends in a recoverable state with a plain-language message (`11-content-strategy.md` for error voice).
- No flow may dead-end a guest; the worst outcome is a contextual signup prompt.

---

## 1. First launch

1. Tolu taps a WhatsApp link → PWA opens to **Today (guest)**.
2. Today shows: today's devotional (fully readable), locked streak card ("Start your streak"), Bible and Library visible in nav.
3. ◇ She reads the devotional as a guest — no interruption. Value before commitment.
4. At the devotional's end: a single inline card — "Save your progress and start your streak → Create account."
5. ⚙ First visit triggers the PWA install prompt only **after** the first completed devotional read, never on arrival.
6. ✖ Offline first launch: cached app shell loads with a friendly "You're offline — connect once to fetch today's devotional" state.

## 2. Guest browsing

1. Guest moves freely across Today, Bible, Library, Tribe (see `05-navigation.md`, Guest).
2. Personalization actions (save, highlight, register, streak) show a contextual bottom-sheet: what the account unlocks, in one sentence, with `Sign up` / `Not now`.
3. ⚙ Guest reading position in the Bible is stored locally and migrated into the account on signup — nothing is lost by starting as a guest.

## 3. Signup

Optimized for teens on shared devices; minimal fields.

1. Entry: contextual prompt or Me tab → **Sign up**.
2. Fields, one screen: first name, phone number *or* email, password. Alternative: **Continue with Google** (one tap).
3. ⚙ OTP verification via SMS (phone) or link (email). ✖ OTP not received → resend with 60s cooldown; switch to email path offered after two failures.
4. Screen two: date of birth (age-band logic: under-13 blocked with a kind message; 13–19 standard; 20+ flagged for role assignment), gender (optional), **parish selection** (region → searchable parish list; "I'm not sure" allowed — assigns region-level default, coordinator can correct later).
5. ⚙ Account created; guest local data migrated; role = Teen; landing on Today with streak card active: "Day 1 starts today 🌱".
6. ✖ Existing phone/email → inline "Looks like you already have an account — log in?" with prefilled identifier.

## 4. Login

1. Identifier (phone/email) + password, or Google.
2. ✖ Forgot password → OTP/link reset flow, ≤3 screens.
3. ⚙ Session: long-lived refresh token; teens should essentially never be logged out on their own device (`15-technical-architecture.md`).

## 5. Read devotional (the core daily loop)

1. Open app → Today. The Memory Verse / Verse of the Day card (the devotional's memory verse — one source of truth) sits at the top; devotional card shows title + est. read time (e.g., "4 min").
2. Tap → Devotional Reader: title, **memory verse** (the day's verse, live link + one-tap share card), anchor Scripture reference (live link), body, reflection question, prayer.
3. ◇ Taps the Scripture reference → **Bible Reader opens at the passage** with "← Back to devotional" chip (`08-bible-experience.md`). Reads, returns.
4. Scrolls to end → ⚙ devotional auto-marked complete (scroll-depth + dwell heuristic; no "mark as read" button to game or forget). ⚙ Completion also cancels all remaining habit reminders for the day (`07-feature-specifications.md` #10).
5. Completion moment: gentle streak animation ("Day 12 🌱"), share-the-verse shortcut (the memory verse, pre-rendered as a share card), done. No confetti storms (`09-design-principles.md`). The daily challenge, when themed, echoes the same verse — one message end to end.
6. ✖ Offline: today's + yesterday's devotionals (memory verses included) are pre-cached on last connection; completion syncs when back online.
7. Empty state (content gap): "Today's devotional is on its way. Read yesterday's, or continue your Bible reading →" — the pipeline failure never blames the teen, and admins are alerted (`14-analytics.md` monitoring).

## 6. Read Bible / 7. Search Scripture / 8. Highlight verse / 9. Create note / 10. Continue reading

Specified in full in `08-bible-experience.md` (flows B1–B7). Summary of the canonical loop:

1. Bible tab → Reader opens at last position (Continue Reading).
2. Navigator: book grid → chapter grid → reader. Two taps from anywhere to any chapter.
3. Verse tap → action sheet: Share · Save · Highlight ✧ · Note ✧ · Copy.
4. Search: query → results grouped by book, tap → reader at verse, highlighted.
5. ✖ Offline: cached translation (WEB) fully readable; search runs against local index.

## 11. Register for event → 12. Receive QR ticket

1. Tolu opens a shared deep link → **Event detail**: banner, date/venue, organizer (name + role — legitimacy matters to parents), price, capacity remaining, schedule.
2. Tap **Register** → ◇ guest? → lightweight signup (flow 3) → resume registration automatically.
3. Registration form: pre-filled from profile (name, parish); event-specific fields only (e.g., emergency contact for camps). One screen where possible.
4. ◇ Paid event → payment method: **Pay now (Paystack: card/bank/USSD/transfer)** or **Share payment link** (sends to a parent — `03-user-personas.md`, Mr. Okafor).
5. ⚙ Payment webhook confirms → registration state `confirmed` → **QR ticket issued**.
6. Ticket delivered: confirmation screen, Me → My Tickets, notification, and email/SMS fallback. Ticket page works offline (QR cached).
7. ✖ Payment failed → registration held in `pending` for 24h with retry; capacity not consumed by unpaid registrations after expiry.
8. ✖ Event full → waitlist offer with position number; auto-promotion notification if a slot opens.
9. Check-in day: coordinator scans QR (flow 19) → teen sees "Checked in ✓".

## 13. Join a Journey ✧ (V1.5)

1. Entry: Today card, Library → Journeys catalog, or a shared link.
2. Journey detail: what it is, duration ("21 days"), daily commitment ("~7 min/day"), what you'll earn (certificate).
3. **Start Journey** → Day 1 step appears on Today the next morning (or immediately, user's choice).
4. Daily: Today shows the Journey step card → step = devotional segment + Scripture + reflection/challenge → completion updates progress.
5. ◇ Missed days: Journey pauses, never punishes; "Pick up where you left off" (`12-gamification.md`).
6. Completion → certificate issued to Recognition; share option; coordinator sees aggregate completion in Console.

## 14. Watch media / 15. Listen to podcast

1. Library → shelf or search → content detail.
2. **Video:** poster + explicit play tap (never autoplay — data cost), quality selector defaulting per data-saver setting, resume position stored.
3. **Podcast:** play → mini-player docks above nav, persists across the whole app, background audio via media session API; playback speed; resume.
4. ✖ Connection drop mid-playback: buffered audio continues; player shows reconnecting state; position preserved.
5. Data-saver mode (Settings → Data & offline): audio-only default for videos where available, thumbnail-lite images.

## 16. Bookmark/save content

1. Save icon on any content card/detail → toast "Saved" with **Undo**.
2. Me → Saved: filter chips (All · Verses · Articles · Audio · Video). Items are live pointers; unpublished content shows a graceful "no longer available" row.

## 17. Receive notification

1. ⚙ Habit reminders follow the ladder in `12-gamification.md`: morning ("Good morning! Today's devotional and memory verse are ready."), then afternoon, evening, and final reminders **only if the day's devotional is still incomplete**. Completing it cancels every remaining rung instantly. Transactional and event notifications are separate.
2. Tap → deep link to subject (usually Today, ready to read) with working back path. Inbox mirrors every push (nothing exists only as a push).
3. First-run: push permission requested **only after** the user's first completed devotional or an event registration — never on first open. The prompt sets expectations honestly: "We'll remind you about today's devotional. You choose how often."
4. Reminder intensity presets in Settings → Notification preferences: **Gentle** (morning only), **Standard** (morning + evening, default), **Committed** (full ladder). Every rung individually configurable; quiet hours respected.
5. ✖ Ignored reminders: if a teen ignores reminders for 7 consecutive days, ⚙ the system automatically steps intensity down one level and tells them ("We've quieted things down — turn reminders back up any time.") — respect is enforced by software, not just policy (`14-analytics.md` guardrails).

## 18. Volunteer ✧ (V2)

1. Tribe → Serve → opportunities list (scoped to hierarchy: parish/area/region).
2. Opportunity detail: what, when, who to report to, requirements.
3. **I'm interested** → coordinator receives it in Console → approves → teen notified; commitment appears in Me.

## 19. Coordinator workflow (Chinedu's event, end to end)

1. Console → Events → **New event**: title, banner, description, venue, date/time, audience scope (his area), capacity, price, custom fields, registration deadline.
2. ⚙ Draft → preview as teen → **Publish** → shareable link + optional announcement to scope.
3. Live dashboard: registrations, payments reconciled via webhook, waitlist.
4. Check-in mode: full-screen scanner (any logged-in user with `event.checkin` grant, so Super Teens can scan); scan → green flash + name, duplicate scans flagged amber; offline check-in queue syncs later (✖ venue connectivity).
5. Post-event: attendance report (registered vs. paid vs. checked-in), CSV export, one-tap "thanks for coming" announcement.

## 20. Admin publishing (Funmi's devotional pipeline)

1. Console → Content → Devotional calendar (month view; gaps visibly flagged).
2. **New devotional**: date, title, anchor Scripture (validated reference → becomes live link), body (rich text), reflection, prayer. Save as draft.
3. ◇ Review workflow: author submits → reviewer (doctrinal check) approves → **scheduled**. Two-person rule for anything reaching all teens.
4. ⚙ Publishes automatically at 05:00 WAT on its date; pre-caching hint sent to clients overnight on Wi-Fi where possible.
5. ✖ Unpublish/correct: fixes propagate; a correction to an already-read devotional shows a subtle "updated" tag, no re-notification.

## 21. Offline mode (cross-cutting)

Cached and fully functional offline: app shell, today's + yesterday's devotionals, default Bible translation (WEB), saved articles (✧ explicit downloads), My Tickets QR, current manual (teachers).
Queued for sync: devotional completions, reading events, challenge completions, check-ins (coordinator), saves.
Honest state: a slim offline banner; actions that truly need connectivity (payment, registration, search beyond local index) say so plainly and offer retry — never a spinner that lies.

## 22. Add a friend ✧ (V2)

1. Entry: Tribe → Friends → **Invite friends** (share link via WhatsApp), or a friend-invite deep link, or "Add friend" on a group member's profile (group members only — no stranger discovery).
2. ◇ Recipient opens the link → auth-then-resume → **request confirmation screen** showing the requester's first name, avatar, parish. Accept / Decline (decline is silent — the requester is never told).
3. ⚙ Friendship is mutual-only and teen-peer-only: adults cannot friend teens; the system blocks cross-role requests (`13-community.md`).
4. Once friends: friend profile unlocks (first name, parish, opt-in milestones), encouragement notes (constrained composer, screened), prayer requests to friends, shared Journeys, memory-verse challenges.
5. Block/remove available from every friend surface; both are silent and immediate. ✖ Abuse in an encouragement note → Report action → moderation queue with SLA (`13-community.md`).

## 23. Set up an Accountability Partner ✧ (V2)

1. Tribe → Friends → friend profile → **Ask to be accountability partners** (friends only; 1–3 partners max).
2. ◇ Consent screen for *both* teens, in plain language, listing exactly what a partner sees and receives: activity status (active today / not yet — never content), milestone celebrations, and — **only if I turn it on** — a nudge when I've been inactive a few days. Both must accept.
3. Partner space: shared prayer list, shared Journey option, "celebrate" action on milestones.
4. ⚙ Inactivity nudge (if enabled by the inactive teen, in advance): after 3 quiet days the partner gets "Tolu hasn't been around for a few days — send some encouragement?" The nudge never says what was or wasn't read.
5. Either side can end the partnership at any time, silently, from Settings → Friends & privacy. All partner permissions revoke instantly.

## 24. A day in the streak (reminder ladder, end to end)

1. 06:30 — morning push: "Good morning! Today's devotional and memory verse are ready." ◇ Tolu opens and completes → ⚙ all remaining rungs canceled. Done for the day.
2. ◇ She doesn't open it. 13:30 — afternoon rung (Standard/Committed presets): "Have you had a chance to spend time in God's Word today?"
3. 18:30 — evening rung (Committed): "Keep your streak alive. Today's devotional is still waiting."
4. 20:45 — final rung (Committed, always before quiet hours): "There's still time to continue today's journey."
5. ◇ Day ends incomplete → ⚙ if a Grace Day is available it is applied automatically and visibly the next morning ("Grace covered Tuesday 🌱"); otherwise the streak resets with fresh-start framing — never a red "you lost it" moment (`12-gamification.md`).
6. ⚙ V2 intelligence: rung times shift to the teen's own habitual window (a night reader gets a later ladder), and 7 days of ignored reminders auto-steps intensity down (flow 17).

## 25. Error states (canonical patterns)

| Situation | Pattern |
|---|---|
| Network failure | Inline retry card, cached content shown if available, never a full-screen dead end |
| Payment failure | Specific reason when known (declined/timeout), retry + alternate method, registration held |
| Auth/session expiry | Silent refresh first; only then a soft re-login sheet preserving in-progress state |
| Server error | "Something went wrong on our side" + retry; auto-reported (`16-release-checklist.md` monitoring) |
| Permission denied | Should be near-impossible (role-gated UI is invisible, not disabled); if reached: neutral redirect home |
| Stale deep link | "This event has ended / content moved" + nearest useful alternative |

## 26. Empty states (canonical patterns)

Empty states teach and invite; they never scold (`11-content-strategy.md`).

| Surface | Empty state |
|---|---|
| Saved | "Verses and content you save will live here. Try saving today's verse →" |
| My Tickets | "No tickets yet. See what's coming up →" (link to Events) |
| Search (no results) | Suggest spelling/nearest book name; for Bible, offer keyword vs. reference tips |
| Notifications | "All caught up 🌱" |
| Progress (new user) | "Your story starts today — read your first devotional →" |
| Coordinator event list | "Create your first event" with a 3-step explainer |
| Prayer Wall ✧ (new group) | Seeded by the group's teacher with a first prayer, by policy — no cold-start ghost towns (`13-community.md`) |
