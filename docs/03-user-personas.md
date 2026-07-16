# 03 — User Personas

These personas are grounded in the realities of RCCG teen ministry in Nigeria: shared and low-end Android devices, expensive mobile data, school-dominated weekdays, church-dominated Sundays, and a leadership structure of volunteer teachers and coordinators. They are design tools — every flow in `06-user-flows.md` should be walkable through at least one persona.

**Device and context assumptions (apply to all Nigerian personas):**

- Android dominates (~85%+ of teens), often devices with ≤3GB RAM and constrained storage.
- Data is purchased in small bundles; a 200MB day is normal. Every megabyte matters.
- Connectivity is intermittent — strong at home/school Wi‑Fi pockets, weak in transit and in some church buildings.
- WhatsApp is the communication default; email is checked rarely by teens.

---

## Persona 1 — Tolu, the Teen (primary persona)

**Age 15 · SS2 student · attends an RCCG parish in Ikorodu with her family · Android phone (shared charger, personal SIM)**

**Goals**

- Grow spiritually in a way that fits her real life, not an idealized one.
- Not fall behind: keep up with the devotional her teacher references on Sundays.
- Register for camp without begging someone to send her the form.
- Feel like she belongs to something bigger than her small teens class.

**Behaviour**

- Checks her phone before school (6:15–6:45am) and at night (9–10pm). School hours are offline.
- Reads in short bursts; a 4-minute devotional is right, a 15-minute one gets abandoned.
- Screenshots verses she likes and posts them to her WhatsApp status.
- Lets streaks and habits lapse during exam periods, then feels too guilty to restart.

**Needs**

- A daily experience that loads fast, works offline once cached, and finishes in under 5 minutes.
- A gentle way back after missing days (grace, not guilt — `12-gamification.md`), and well-timed reminders that keep her streak alive without shaming her (`12-gamification.md`, streak reminder strategy).
- Verse sharing that produces a beautiful image for WhatsApp status in two taps — the day's memory verse ready-made as a share card.
- Event registration that works on her phone and lets a parent pay.
- (V2) A best friend on the app: someone to pray with, send encouragement notes to, and do a Journey with — church friendship, not follower counts (`13-community.md`).

**Pain points**

- Devotional PDFs on WhatsApp are ugly, get buried, and eat storage.
- Data anxiety: hesitates to open anything that might autoplay video.
- Feels invisible in a large teens church; her consistency is never seen or celebrated.

**Technical ability:** High comfort, low patience. Native to WhatsApp/TikTok patterns; abandons anything with more than two confusing steps. Never reads instructions.

**Daily routine touchpoint:** Opens Today at 6:20am → devotional (4 min) → taps the referenced Scripture, reads the chapter (5 min) → shares a verse to status → closes app. Evening: sometimes a podcast while doing chores.

**User journey (first 30 days):** Hears about the app at church → installs PWA from a WhatsApp link → guest-browses a devotional → creates account to save her streak → builds an 11-day streak → misses 2 days during tests, grace days protect week one, streak resets gently in week two with an encouraging restart → registers for the December Campout, parent pays via transfer link → by day 30 she is a Weekly Engaged Disciple.

---

## Persona 2 — Emeka, the Super Teen (teen leader)

**Age 17 · SS3 · teen leader ("Super Teen") in his area · aspiring worker · mid-range Android**

Super Teens are teens with recognized peer-leadership responsibility: leading prayers, coordinating fellow teens, assisting teachers. Emeka is Tolu three years from now, with responsibilities.

**Goals**

- Lead by example — his consistency should be visible to those he leads (appropriately, not boastfully).
- Help his teacher: share announcements, rally teens for events, track who from his set is coming to camp.
- Develop toward formal ministry (the Serve pathway, `02-roadmap.md` V3).

**Behaviour**

- Everything Tolu does, plus: forwards event links to his set's WhatsApp group, answers "how do I register?" questions constantly, volunteers at events.
- Reads more deeply — uses notes and highlights once they exist (V1.5).
- (V2) A natural accountability partner: two or three younger teens choose him, and he checks in when their inactivity nudge arrives (`13-community.md`).

**Needs**

- Light leadership visibility: see registration status for teens in his unit (names and status only — no spiritual surveillance of peers).
- Shareable deep links for events and content.
- A volunteer signup flow that recognizes his role.
- Recognition that his service counts (Recognition system, `12-gamification.md`).

**Pain points**

- Being the human middleware between coordinators and teens ("Have you registered? Send me your name…").
- No pathway visibility: what does growth into leadership actually look like?

**Technical ability:** High. The person others hand their phone to.

**User journey:** Onboards in the first launch cohort → teacher assigns him the Super Teen role → uses share links to drive 20 registrations from his set → volunteers as a check-in scanner at the Campout → completes the "Leadership Foundations" Journey in V1.5 → earns the first certificate in his area.

---

## Persona 3 — Mrs. Adebayo, the Teacher

**Age 34 · banker · volunteer teens teacher at parish level · iPhone SE + work laptop**

**Goals**

- Teach the weekly manual well with minimal prep friction.
- Know her teens are engaging with the devotional between Sundays.
- Route pastoral attention to teens who are drifting.

**Behaviour**

- Prepares lessons Saturday evening on her laptop or phone.
- Currently receives manuals as PDFs in a teachers' WhatsApp group; prints or reads from her phone in class.
- Knows her ~25 teens personally; digital tools supplement, never replace, that knowledge.

**Needs**

- Weekly Manuals: current week prominent, downloadable/printable, offline-available (`07-feature-specifications.md`).
- A simple class view: her teens, their event registrations, and *coarse* engagement signals ("hasn't opened the app in 3 weeks"), not verse-by-verse surveillance.
- The ability to suggest content to her class.

**Pain points**

- Manual distribution is chaotic; wrong-week PDFs circulate.
- Zero visibility between Sundays; problems surface only when a teen stops attending.

**Technical ability:** Moderate. Competent with productivity tools, impatient with badly designed ones. Will not attend a training session — the product must be self-evident.

**User journey:** Invited by her area coordinator with a role-assignment link → sees her class roster auto-populated from parish assignment → downloads this week's manual Saturday → Sunday, references the devotional teens read that week → mid-week, notices two teens flagged as inactive for 21 days and calls their parents — a pastoral act the platform enabled but did not perform.

---

## Persona 4 — Bro. Chinedu, the Coordinator

**Age 28 · works in logistics · Area Teens Coordinator (oversees 6 parishes) · Android + laptop**

**Goals**

- Run events (registration, payment reconciliation, check-in) without spreadsheets.
- Publish area announcements that actually reach teens.
- Report accurate numbers upward (area → zone → province → region) without manual collation.

**Behaviour**

- The operational backbone: creates events, chases payments, prints name tags, compiles attendance reports at midnight.
- Manages 15+ WhatsApp groups today.

**Needs**

- Coordinator dashboard: event creation with capacity/pricing, live registration numbers, payment reconciliation against Paystack, QR check-in via phone camera, exportable reports (`07-feature-specifications.md`).
- Hierarchy-scoped analytics: his area only, rolled up by parish (`14-analytics.md`).
- Publishing tools with an approval flow so parish-level submissions reach him for review.

**Pain points**

- Reconciling bank-transfer screenshots against a registration spreadsheet.
- Event-day check-in queues managed with paper lists.
- Being asked "how many teens do we have?" and not having a defensible answer.

**Technical ability:** Moderate-high. Excel-fluent. Values reliability over beauty; will keep a parallel spreadsheet until the platform earns trust — earning that trust is a V1 success criterion.

**User journey:** Regional admin assigns his coordinator role and area scope → creates the area's "Teens Hangout" event with ₦1,500 fee → shares the deep link to parish groups → watches live registration counts → event day: two Super Teens scan QR tickets, 240 check-ins in 40 minutes → exports the attendance report → sends it upward the same evening, a task that previously took a week.

---

## Persona 5 — Sis. Funmi, the Administrator

**Age 31 · regional teens secretariat · manages platform content and people for the entire region · laptop-primary**

**Goals**

- Keep the daily devotional pipeline publishing without gaps.
- Manage the role and hierarchy structure (assign coordinators, teachers, Super Teens; manage parish lists).
- Guard content quality and doctrinal soundness.
- Own regional analytics and report to regional leadership.

**Behaviour**

- Desktop-heavy, batch-oriented: schedules a month of devotionals in one sitting, reviews submissions weekly.
- The escalation point for everything: forgotten passwords, wrong parish assignments, refund requests.

**Needs**

- Admin dashboard: content calendar with scheduling, review queue, user/role management with hierarchy scoping, event oversight across the region, moderation tools (V2), audit logs (`07-feature-specifications.md`).
- Bulk operations: CSV import of parishes and members, batch role assignment.
- Region-level analytics with drill-down (`14-analytics.md`).

**Pain points**

- No single registry of teens across the region; every program rebuilds its list.
- Content quality control currently happens in WhatsApp threads.
- Fear of publishing errors reaching thousands of teens with no recall.

**Technical ability:** High for productivity software; not a developer. Needs safe, reversible admin actions (drafts, scheduled publish, unpublish) rather than raw power.

**User journey:** Set up as the first regional admin during onboarding → imports the parish hierarchy via CSV → assigns coordinators → schedules the first 60 days of devotionals → establishes the weekly rhythm: Monday content review, Thursday analytics review → by month 3, presents the region's first data-backed ministry report.

---

## Persona 6 — Mr. Okafor, the Parent (limited access)

**Age 47 · civil servant · two teens on the platform · Android, WhatsApp-centric, moderate tech comfort**

**Goals**

- Know what his children are being taught and by whom (trust).
- Approve and pay for events safely.
- Encourage his teens' spiritual growth without surveilling it.

**Behaviour**

- Will not install "another app" enthusiastically; parent access must work via simple web links and WhatsApp-delivered notifications (V2, `13-community.md`).
- Pays via bank transfer or card when the flow is obviously legitimate.

**Needs**

- Event consent and payment: see event details (what, where, who is responsible, cost), approve, pay.
- High-level visibility only: "Tolu completed a 21-day Journey" — never her notes, highlights, prayer requests, encouragement notes with friends, or mood check-ins. This boundary is a hard privacy rule (`13-community.md`).
- Confidence in safety: visible safeguarding standards.

**Pain points**

- Paying for church programs via transfer-to-personal-account feels unsafe.
- Zero visibility into teen church programming today.

**Technical ability:** Low-moderate. Every parent flow must survive a first-time user on a mid-range Android over 3G, in one sitting, without a password if possible (magic links).

**User journey (V2):** Tolu registers for camp and enters his number → he receives a WhatsApp/SMS link → opens a consent page showing event details and the coordinator's name → approves and pays by card → receives the receipt and, after the event, a one-line "Tolu checked in safely" notification. Total lifetime taps: under ten.

---

## Persona priority

| Persona | Priority | Rationale |
|---|---|---|
| Tolu (Teen) | P0 | The mission. Every V1 decision optimizes for her first. |
| Bro. Chinedu (Coordinator) | P0 | Operational adoption gatekeeper; his trust unlocks the region. |
| Sis. Funmi (Admin) | P1 | The content pipeline lives or dies with her tools. |
| Mrs. Adebayo (Teacher) | P1 | Sunday-to-weekday bridge; manuals are a V1 feature. |
| Emeka (Super Teen) | P2 | Multiplier persona; light V1 support, full pathway by V3. |
| Mr. Okafor (Parent) | P2 | V2 by roadmap; consent/payment flows designed now, shipped later. |
