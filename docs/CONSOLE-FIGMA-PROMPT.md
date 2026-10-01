# Figma Prompt — Redesign the Faith Tribe Console (admin panel)

**How to use this file**

- **Figma Make / First Draft / any AI design tool:** paste **Part A** first (context + tokens), then **Part B** (the role model — this is what makes the screens differ), then one screen prompt from **Part C** per generation. Don't paste the whole file at once; you'll get mush.
- **A human designer:** hand them the whole file. Part A is the brief, Part B is the permission model, Part C is the screen list, Part D is the complete button inventory, Part F explains what changed in the backend and why.
- This covers the **Console only**. The teen app, mobile, and landing page are covered by `docs/DESIGNER-BRIEF.md`.

**Contents**

| Part | What it is |
|---|---|
| A | Master context prompt — tokens, tone, structure |
| B | **The role model** — 6 personas, the 21×6 permission matrix, what each one's Console looks like |
| C | 12 screen prompts, each with its per-role variants |
| D | **Complete action inventory** — every button in the Console, with the permission that reveals it |
| E | Component kit |
| F | Backend gap table + non-negotiable rules |
| G | Deliverables |

---

## PART A — Master context prompt (paste this first)

> Design **the Console** for Faith Tribe — a daily Bible app for teenagers, starting with RCCG Region 63 (Nigeria). The Console is a **desktop-first web tool for church leaders**: teachers, parish leaders, coordinators, and administrators. It is a separate surface from the teen app, entered deliberately from Me → "Console". It is a working tool, so it may be **dense** — dense tables, multi-column layouts, keyboard-driven — while the teen app stays calm and spacious.
>
> **Tone:** professional and quiet. Warm, not corporate. It should feel like a well-made piece of church administration software, not a SaaS analytics dashboard. No gradients, no glassmorphism, no decorative shadows, no hero illustrations.
>
> **Reuse the existing design tokens. Do not invent new colours or fonts.**
>
> - Primary / action: green `#10B981`. Used sparingly — primary buttons, active nav, selected state.
> - Celebration accent: amber `#F59E0B`. Almost never used in the Console.
> - Surfaces: warm off-white (never pure white) in light mode; deep warm neutral (never pure black) in dark mode.
> - Font: **Inter** for all UI. Tabular figures in every table and metric.
> - Base unit **4px**. Spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64.
> - Radius: sm 8 · md 12 · lg 16 · xl 24 · full 999. Inputs and chips sm–md, cards lg.
> - Type scale: `title.lg` 24/32 700 · `title.md` 20/28 600 · `title.sm` 17/24 600 · `body.md` 16/24 400 · `body.sm` 14/20 400 · `caption` 12/16 500.
> - Elevation: 4 levels only. Flat base, level 1 cards, level 2 app bar, level 3 modals/menus. In dark mode lighten the surface instead of casting a shadow.
> - Desktop grid: 12 columns, max content width 1200px. Breakpoints sm 360 · md 480 · lg 768 · xl 1024 · 2xl 1280.
>
> **Status colours (normative — these map to real backend states):**
>
> - Content pipeline: `draft` gray · `in review` blue · `approved` teal · `scheduled` purple · `published` green · `archived` muted gray.
> - Event registration: `pending` amber · `confirmed` green · `waitlisted` blue · `checked in` teal · `attended` green · `cancelled` gray · `no show` muted.
> - Payment: `not required` muted · `pending` amber · `paid` green · `refunded` purple · `failed` red.
> - Bulk upload: `pending` gray · `processing` blue · `completed` green · `partial` amber · `failed` red.
> - Never use colour alone. Every status pill carries an icon and a text label.
>
> **The three structural ideas that define this Console — get these right and everything else follows:**
>
> **1. Everything is scoped to a position in the church tree.** The organizational hierarchy is exactly seven levels, top-down: **National → Region → Province → Zone → Area → Parish → Department.** A node's type must be exactly one level below its parent's. Every member, event, content item, and analytic belongs to a node. A leader only ever sees and manages their own node and everything beneath it.
>
> So the Console needs a **persistent scope switcher in the top bar** — a searchable tree picker showing the current node and its full path (e.g. `National → Region 63 → Lagos Province 69 → Ikeja Zone → RCCG Rehoboth Parish`). Changing scope re-filters every screen. This is the Console's most important control; treat it like a repository picker in a developer tool, not like a filter dropdown buried in a sidebar. Show the active scope as a persistent breadcrumb chip that stays visible when scrolled.
>
> **2. What a leader sees is computed from role grants, not from an "is admin" flag.** Six leader roles hold between 4 and 21 permissions each. The sidebar, the toolbars, the row menus, and the empty states are all *derived* from that set. **Design the Console as one product with six computed subsets — not as six products.** Part B gives you the exact matrix.
>
> **3. Absent, not disabled.** If a leader lacks a permission, the control is **not rendered** — no wall of padlocks, no greyed-out buttons. The two exceptions, where a visible-but-blocked control is correct because the block is about *this item* rather than about *this person*: (a) the Approve button on content you submitted yourself, and (b) the Publish button on a devotional missing its memory verse. In both cases replace the button with an explanatory chip that says why.
>
> **Every screen must be delivered in six states:** normal (with realistic Nigerian church content — real parish names, Nigerian names, Naira amounts, Africa/Lagos times, never lorem ipsum), loading (soft skeleton shapes, never spinners), empty (small illustration + one line + one action), error (kind, specific, tells the leader how to fix it), permission-denied (explains which role grants access, offers "Request access"), and dark mode.
>
> **Accessibility is a launch requirement:** ≥4.5:1 text contrast, 44×44px minimum targets, works at 200% text zoom, icon + label always, full keyboard operability on every table and dialog.

---

## PART B — The role model (paste this second — it is what makes the screens differ)

> The Console has **six leader roles**. They are not job titles; they are permission bundles, and the interface is computed from them. Design the shell once, then show it resolved for each role.

### B.1 The six personas

| Role | Assignable at | Permissions | Sidebar items | One-line character |
|---|---|---|---|---|
| **Super Admin** | National | **21 / 21** | 12 | Owns the platform. The only role that can edit what other roles mean. |
| **National Coordinator** | National | **19 / 21** | 12 | Runs the country. Everything except redefining roles and editing others' profiles. |
| **Regional Coordinator** | Region | **16 / 21** | 10 | Runs Region 63. Publishes content, appoints coordinators, cannot reshape the tree. |
| **Province Coordinator** | Province | **11 / 21** | 7 | Runs a province's people and events. Reads content, never publishes it. |
| **Parish Leader** | Parish | **7 / 21** | 5 | Runs one parish. Sees their people, runs the door at events. |
| **Teacher** | Parish **or** Area | **4 / 21** | 3 | Teaches a class. Lesson material, their teens, and check-in. |

Two further roles exist in the backend — **Teen** and **Parent** — and hold no Console permissions at all. They never see this product. Do not design for them here.

### B.2 The permission matrix (normative — 21 permissions × 6 roles)

> Design a screen that renders this exact matrix (see C4). It is also your spec sheet: every "does this role see this button?" question in Part D resolves against this table.

| # | Permission | What it unlocks | Super Admin | National Coord. | Regional Coord. | Province Coord. | Parish Leader | Teacher |
|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | `users.view` | See the people list | ● | ● | ● | ● | ● | ● |
| 2 | `users.manage` | Create/edit/deactivate accounts | ● | ● | ● | — | — | — |
| 3 | `profiles.view` | Open a member's profile | ● | ● | ● | ● | ● | ● |
| 4 | `profiles.manage` | Edit someone else's profile | ● | — | — | — | — | — |
| 5 | `memberships.view` | See who belongs where | ● | ● | ● | ● | ● | — |
| 6 | `memberships.manage` | Add / move / transfer members | ● | ● | ● | ● | — | — |
| 7 | `roles.view` | See roles and who holds them | ● | ● | ● | ● | — | — |
| 8 | `roles.assign` | Grant and revoke roles | ● | ● | ● | — | — | — |
| 9 | `roles.manage` | Change what a role *means* | ● | — | — | — | — | — |
| 10 | `hierarchy.view` | See the church tree | ● | ● | ● | ● | ● | — |
| 11 | `hierarchy.manage` | Add / rename / move nodes | ● | ● | — | — | — | — |
| 12 | `content.view` | See unpublished content | ● | ● | ● | ● | ● | ● |
| 13 | `content.publish` | Approve, schedule, publish | ● | ● | ● | — | — | — |
| 14 | `content.manage` | Create / edit / delete content | ● | ● | ● | — | — | — |
| 15 | `bible.manage` | Import & manage Scripture text | ● | ● | — | — | — | — |
| 16 | `media.manage` | Podcasts, videos, playlists | ● | ● | ● | — | — | — |
| 17 | `events.view` | See the event management list | ● | ● | ● | ● | ● | — |
| 18 | `events.manage` | Create events, edit registrations | ● | ● | ● | ● | — | — |
| 19 | `events.checkin` | Check attendees in at the door | ● | ● | ● | ● | ● | ● |
| 20 | `payments.view` | See payments & reconciliation | ● | ● | ● | ● | — | — |
| 21 | `payments.manage` | Refunds, payment plans | ● | ● | — | — | — | — |
| | **Total** | | **21** | **19** | **16** | **11** | **7** | **4** |

### B.3 The sidebar, resolved per role

> The sidebar is not a fixed list with things hidden. It is **generated** from the permission set. Design all six. The sidebar collapses to an icon rail; breadcrumbs sit under the top bar (`Console → Events → Teens Hangout → Registrations`).

```
SUPER ADMIN (12)          NATIONAL COORD (12)       REGIONAL COORD (10)
─────────────────         ─────────────────         ─────────────────
Overview                  Overview                  Overview
People                    People                    People
Hierarchy                 Hierarchy                 Hierarchy  (read-only)
Content                   Content                   Content
Events                    Events                    Events
Manuals                   Manuals                   Manuals
Library & Media           Library & Media           Library & Media
Bible                     Bible                     Notifications
Notifications             Notifications             Analytics
Analytics                 Analytics                 Settings   (limited)
Settings                  Settings
Audit Log                 Audit Log

PROVINCE COORD (7)        PARISH LEADER (5)         TEACHER (3)
─────────────────         ─────────────────         ─────────────────
Overview                  Overview                  Overview
People                    People      (read-only)   Manuals
Hierarchy  (read-only)    Hierarchy   (read-only)   My Class
Events                    Events      (read-only)
Manuals                   Manuals                   [Check In — floating
Analytics  (scoped)       Check In                   action, see below]
Settings   (account only) Settings    (account only) Settings (account only)
```

### B.4 Four rules that follow from the matrix — design these deliberately

> **1. The Teacher's check-in problem.** A Teacher holds `events.checkin` but **not** `events.view`. They may check someone in but may not browse the event list — so check-in *cannot* be reached by drilling into an event. Give the Teacher and Parish Leader a **direct "Check In" entry point**: a card on their Overview naming today's event, plus a persistent action in the rail. Design that path explicitly.
>
> **2. Province Coordinators read content but never touch it.** They hold `content.view` (they can read unpublished material, so they know what's coming) but not `content.manage` or `content.publish`. Their Content view is a **read-only reading list** — no New button, no editor, no review queue, no pipeline actions. Not a greyed-out toolbar: no toolbar.
>
> **3. Hierarchy is visible to almost everyone and editable by almost no one.** Five of six roles hold `hierarchy.view`; two hold `hierarchy.manage`. So the tree screen has two distinct designs: an **explorer** (navigate, search, see counts, click into a node) and an **editor** (the explorer plus Add child, Rename, Move, Deactivate, Import CSV). Design both.
>
> **4. You cannot grant authority you do not hold.** The backend refuses any grant whose permissions are not a subset of the granter's own permissions at that node. So the role picker in the Assign flow is **computed, not fixed**:
>
> | Granting leader | Role cards they actually see | Count |
> |---|---|---|
> | Super Admin | Super Admin · National Coord · Regional Coord · Province Coord · Parish Leader · Teacher · Teen | **7** |
> | National Coordinator | National Coord · Regional Coord · Province Coord · Parish Leader · Teacher · Teen — **not** Super Admin | **6** |
> | Regional Coordinator | Province Coord · Parish Leader · Teacher · Teen — **not** National or Super Admin | **4** |
> | Province Coord / Parish Leader / Teacher | **none — the Assign button does not exist for them** | 0 |
>
> Two counts that are easy to get wrong, both falling straight out of the rule:
>
> - **`parent` never appears, for anyone — including Super Admin.** Its `allowed_node_types` is empty, and `assign_role()` validates the node level *before* it checks escalation, so the grant is refused at every node in the tree. There are eight seeded roles but only seven that can ever be granted.
> - **`teen` appears for the Regional Coordinator.** It carries zero permissions, and the empty set is a subset of everything, so the escalation rule permits it to anyone holding `roles.assign`. It is the *node level* that constrains it (parish only), not authority.
>
> Design the Regional Coordinator's four-card picker as a first-class state, not as a degraded version of the seven-card one. When a role is excluded, that is invisible — but if the leader searches for it, show one calm line: "Only a National Coordinator can appoint a Regional Coordinator."

### B.5 The scope ceiling

> A leader's role is granted at a node, and their authority covers **that node and everything beneath it** — never sideways, never up. This changes the scope switcher's shape per role:
>
> - **Super Admin / National Coordinator** — full tree, 7 levels deep, needs search and virtualisation.
> - **Regional Coordinator** — rooted at Region 63; National is visible as a non-selectable ancestor breadcrumb.
> - **Province Coordinator** — rooted at their province; typically 3 levels below them.
> - **Parish Leader** — rooted at one parish, with only its departments below. **Design the "nowhere to switch to" state**: the switcher becomes a static label, not a dropdown that opens onto a single item.
> - **Teacher** — no scope switcher at all. Their context is their class.
>
> Every list, count, chart, and export in the Console is filtered by the active scope. Put the scope in the export filename and in the empty-state copy: "No events in Lagos Province 69 yet."

---

## PART C — Screen prompts (one generation each)

Each screen below states its **base design**, then its **role variants**, then its **complete control list**. Generate the base first, then the variants.

### C1 · Overview — the scope-aware work queue

> Design the Console **Overview** — the landing screen after sign-in, scoped to the leader's current node.
>
> This is a **work queue, not a vanity dashboard.** Lead with things that need a human decision today; put numbers underneath.
>
> **Band 1 — "Needs you now."** At most four urgent cards. Each states a problem in plain words and carries exactly one action:
> - **Devotional gap** — "No devotional is scheduled for Thursday 4 September." The backend raises this when nothing covers the next 48 hours. A devotional counts as covering a day only if it is **Approved, Scheduled, or Published** — a Draft covers nothing. Show the next 14 days as a strip of small day pills, covered vs. uncovered.
> - **Review queue** — "6 items are waiting for approval," with a sub-count of items *you* submitted and therefore cannot approve.
> - **Pending registrations** — "12 event registrations awaiting confirmation."
> - **Unreconciled payments** — "₦84,000 across 7 registrations."
>
> **Band 2 — scope summary.** Four compact stat tiles: Members (with change this month), Active this week, Events upcoming, Content published this month. Each tile names the scope it applies to. No sparklines unless the number genuinely trends.
>
> **Band 3 — two columns.** Left: "This week's pipeline" — a 7-day horizontal strip showing each day's devotional and its pipeline colour, clickable through to the calendar. Right: "Recent activity" — an audit feed reading `[who] [did what] [to what] [when]`, e.g. "Tunde Adeyemi approved 'Standing Firm' · 2 hours ago".
>
> **Role variants — design all four:**
>
> | Role | What the Overview becomes |
> |---|---|
> | Super Admin / National | All four urgent cards, all four tiles, both columns, plus a platform-health strip (failed pushes, stuck bulk uploads, Bible import status). |
> | Regional Coordinator | All four urgent cards, all four tiles, both columns. No platform-health strip. |
> | Province Coordinator | **Two** urgent cards only — pending registrations and unreconciled payments. No devotional gap card, no review queue (they cannot act on either). Tiles: Members, Active this week, Events upcoming. Right column keeps the activity feed; left column becomes "Upcoming events in this province". |
> | Parish Leader | One urgent card: today's event and its check-in state. Tiles: Members, Active this week. A "Check In" primary button. Below: this week's manual. |
> | Teacher | No urgent band. Three cards stacked: **Today's check-in** (or "No event today"), **This week's manual** with a "Open lesson" button, **My class** — a roster of their teens with this week's completion. This is the whole screen. |
>
> **Controls:** scope switcher · notification bell · account menu (Profile, Switch to teen app, Sign out) · per-card single action · "View all" on each band · date-range on the activity feed.

### C2 · People — the member list

> Design **Console → People**, a dense table of members inside the current scope.
>
> Columns: avatar + name, home parish (their **primary** membership node), roles held (small pills, each showing the node it applies at — `Teacher @ Ikeja Parish`), status, joined date. A person may hold several roles at several nodes.
>
> **Two things the old admin panel had no concept of, which must be visible here:**
> - **Membership and authority are separate.** A member has one *primary* (home) node and may have additional non-primary affiliations. Authority is a different thing entirely: a time-bounded role grant. Never merge them into one "role" column.
> - **Transfers are an append-only history.** A "Transfers" tab shows `from node → to node`, who moved them, when, and why. Nothing on this tab is editable — design it as a record, not a table with a row menu.
>
> Row click opens a **detail drawer** (not a new page) with tabs: Profile · Memberships · Roles · Activity · Notifications. Design the drawer.
>
> **Role variants:**
>
> | Role | People becomes |
> |---|---|
> | Super Admin | Full table. Toolbar: Search · Filters · **Add member** · **Bulk actions** · Columns · Export CSV. Tabs: Members · Roles · Assignments · Transfers. Row menu: View, Edit profile, Change membership, Transfer, Assign role, Revoke role, Deactivate. |
> | National / Regional | Same, minus **Edit profile** (that needs `profiles.manage`, which only Super Admin holds). |
> | Province Coordinator | Table + Transfers tab. Toolbar: Search · Filters · Columns · Export. **No Add member, no Assign role** (no `users.manage`, no `roles.assign`). Row menu: View, Change membership, Transfer. The Roles tab is present but read-only — they can see who holds what, not change it. |
> | Parish Leader | **Read-only roster** of their parish. Search and Export only. No row menu; row click opens the drawer with Profile and Activity tabs only. No Roles tab, no Transfers tab (`memberships.view` yes, `roles.view` no). |
> | Teacher | Not in the sidebar. Their equivalent is **My Class** (C12) — the same data, one node, no admin verbs. |
>
> Include the **bulk-select state**: the action bar that slides over the table showing count and actions (Confirm · Transfer · Export · Deactivate), with the actions filtered by permission.

### C3 · People — assign a role

> Design the **Assign a role** flow. This is the most consequential thing a leader can do, so it must be deliberate and legible. It is visible only to Super Admin, National Coordinator, and Regional Coordinator.
>
> A role grant is **not a checkbox**. It is: a **person**, a **role**, a **node** it applies at, a **start date**, an optional **end date**, and it records **who granted it**. A grant is "current" only when it is active *and* today falls inside its window.
>
> Design a side panel with six steps:
> 1. **Person picker** — search, showing each result's home parish.
> 2. **Role picker** — cards, not a dropdown. Each card: role name, one-line description, permission count, and the node levels it is valid at. **Only show roles this leader may actually grant** (see B.4). Roles invalid for the *chosen node* are shown greyed with a reason: "A Province Coordinator cannot be assigned at a Parish."
> 3. **Node picker** — the tree, pre-filtered to nodes valid for the chosen role and inside the granter's subtree.
> 4. **Start date** (defaults to today) and an **"Ends" / "No end date"** toggle. An end date before the start date is refused inline.
> 5. **Permission preview** — the 21 permissions as a live checklist, filling in as the role is chosen. This is the safety rail: the leader sees the consequence before confirming.
> 6. **Plain-English confirmation** — "Ngozi Okafor will be able to manage events and check in attendees for Lagos Province 69 and everything beneath it, from 1 September 2026 with no end date."
>
> Design three more states of this flow:
> - **Escalation refused** — the leader picked a role broader than their own authority. One calm sentence, no red alarm: "You cannot grant a role broader than your own authority here."
> - **Already granted** — re-granting an existing active assignment is harmless and keeps the original start date. Say so: "Ngozi already holds this role here since 1 March 2026. Nothing changed."
> - **Revoke** — a confirm dialog explaining that revoking ends the grant today and preserves the history rather than deleting it.
>
> Also design the **role list** (`People → Roles`): each role with permission count, valid node levels, current holder count, and a "system role — cannot be deleted" lock on the seeded eight.

### C4 · Roles & permissions — the matrix (Super Admin only)

> Design **Settings → Roles & Permissions**, the only screen where what a role *means* can be changed. `roles.manage` is held by Super Admin alone, so this screen exists for exactly one persona.
>
> The **permission matrix**: 8 roles as columns, 21 permissions as rows, cells granted / not granted / locked. It must stay readable at 21 × 8 — sticky row and column headers, the grid scrolling inside its own container, row-group headers by domain (Identity · Hierarchy · Content · Media · Events · Payments).
>
> Cell interaction: click to toggle, with a confirmation summarising the blast radius — "14 people currently hold Regional Coordinator. They will all gain `payments.manage` immediately."
>
> Design the guard rails: system roles are locked and say so; the permission *codes* are fixed in code and cannot be invented here, so there is no "Add permission" button — only "Create custom role", which starts from an empty column.
>
> Every other role hits this URL's **permission-denied state**: "Changing what a role means requires Super Admin. Your role is Regional Coordinator." with a "Request access" action.

### C5 · Hierarchy — the church tree

> Design **Console → Hierarchy**. This screen does not exist in the current admin panel at all, and it has **two versions** — see B.4 rule 3.
>
> Seven levels: **National → Region → Province → Zone → Area → Parish → Department.** Each node has a name, a type, an optional external church code, and an active flag. Siblings order by name.
>
> Split layout: scrollable tree on the left (expand/collapse, search, level-coloured type badges, member counts), node detail on the right — name, type, code, active toggle, direct member count, subtree member count, roles assigned at this node, events owned by this node.
>
> **Explorer version** (Regional Coordinator, Province Coordinator, Parish Leader — `hierarchy.view`): navigate, search, expand, click into a node, see counts, jump to that node's people or events. No mutation controls at all. Rooted at the leader's own node.
>
> **Editor version** (Super Admin, National Coordinator — `hierarchy.manage`): the explorer plus **Add child node · Rename · Move · Deactivate · Import from CSV · Export tree**.
>
> **The critical constraint to design around:** a node's type must be *exactly one level below* its parent's. You cannot put a Parish directly under a Province. Design "Add child node" so the type is **pre-determined and shown as a fixed label**, never a dropdown — make the invalid move unrepresentable rather than validating it afterwards.
>
> Design the **move node** confirmation: moving a node moves its whole subtree and changes what many people can see. Show the impact count — "This moves 3 areas, 24 parishes and 1,842 members" — and require typing the node name to confirm.
>
> Include the fresh-install empty state (a National root and nothing else) and the CSV import flow that reconciles rows by church code.

### C6 · Content — the devotional calendar

> Design **Console → Content → Calendar**, the devotional pipeline seen as a calendar. This is the single most valuable new screen in the Console.
>
> A month grid where **every day is a slot that must be filled.** Exactly one devotional per calendar date. Each day cell shows the title, its status colour, and the memory verse reference.
>
> A day is **covered** only if its devotional is **Approved, Scheduled, or Published**. Draft and In-review cover nothing — the design must make that unmistakable at a glance, because it is the entire point of the screen. Uncovered days render as a visible gap: dashed border, warning tint, "+ Add".
>
> Above the grid: a gap banner — "2 days in the next 14 have no approved devotional" — with the dates as clickable chips. Any uncovered day inside the next 48 hours escalates to urgent treatment.
>
> Also design the **list view** of the same data and a **day-detail popover** showing theme, memory verse, submitter, approver, and the workflow buttons.
>
> **Role variants:** Super Admin / National / Regional get the full toolbar — month/quarter toggle · status filter · **New devotional** · **Bulk import** · **Auto-fetch from web** · Export. A **Province Coordinator sees the same calendar with no toolbar buttons and no + Add affordance on empty days** — it is a forecast for them, not a workspace. Parish Leader and Teacher do not have this screen; they see published content in the teen app.

### C7 · Content — the review queue and the two-person gate

> Design **Console → Content → Review**. Visible to `content.publish` holders only: Super Admin, National Coordinator, Regional Coordinator.
>
> The pipeline has six states in fixed order: **Draft → In review → Approved → Scheduled → Published → Archived.** Design a compact horizontal stepper that appears on every content item showing current state and what comes next.
>
> **The rule that shapes this screen: the person who submitted an item can never be the person who approves it.** Two different people must touch anything that goes region-wide. So each row shows `Submitted by [name] · [when]` prominently, and when the viewer *is* that person, the Approve button is replaced by an explanatory chip — "You submitted this — someone else must approve it" — never a greyed-out button with no reason.
>
> Queue rows: item type (Devotional / Manual / Manual Series / Article), title, target date, submitter, time waiting, status. Sort by time waiting by default.
>
> Design the **review detail view**: two columns, content on the left rendered as the teen will see it, review panel on the right containing:
> - Submitter and submission time.
> - **Publish-readiness checks** as a pass/fail checklist — a devotional cannot be published without exactly one primary memory verse (it *is* the Verse of the Day). Show why the button is blocked, don't just block it.
> - Actions: **Approve · Send back · Schedule · Publish**.
> - **Send back** opens a required-notes field. Those notes go to the author and are cleared on resubmission — so design the author's view of a returned item too, with the reviewer's notes in a prominent callout and a **Resubmit** button.
> - Provenance once approved: "Approved by Tunde Adeyemi · 28 Aug 2026, 14:22".
>
> Design the **state-machine refusals** as inline messages, since the backend enforces them: only a Draft may be submitted; only an In-review item may be approved or sent back; only an Approved item may be scheduled; only Approved or Scheduled may be published.
>
> Also design the **devotional editor**, matching the real content shape: Date · Theme · Memorise (reference + text) · Bible Reading (reference + text) · Message (rich text) · Key Point · Bible in One Year · Author · Hymn · Anchor Scripture · Prayer · Confession · Action Point · cover image · audio file or URL · tags · target age groups · discussion questions (repeatable) · scripture references (repeatable, typed anchor/reading/cross-reference). Group into collapsible sections with completion indicators — it is a long form and must not read as one endless column. Scripture references render as verified live links with an inline "resolved / not found" indicator.

### C8 · Events — list, editor, registrations, check-in

> Design the **Events** section. Four screens, and it is the section where role differences bite hardest.
>
> **Events list** — table with title, type, date, venue, **scope** (which node owns it — new, and a visible column), registration status, registered/capacity as a small progress meter, revenue. An event with no scope node is visible to *everyone*; show that as an explicit "All regions" chip, never an empty cell.
>
> **Event editor** — sections: Basics · Date & venue (virtual/hybrid toggle) · **Scope & audience** · Registration · Pricing · Organizer · Extras (what to bring, schedule, FAQs). The **Scope & audience** section is the one to get right: a node picker for who owns and can see the event, plus target age groups (All · Children 6–8 · Pre-Teen 9–12 · Teens 13–19 · Superteens 19+), min/max age, and a guardian-consent toggle. Live plain-English preview: "Visible to 1,842 teens across Lagos Province 69."
>
> **Registrations** — dense table: registration ID, attendee, age, parish, status pill, payment status pill, amount, checked-in. Filters for status, payment, parish, age group. Row expands to the full record: guardian details and consent timestamp, emergency contact, and **medical information (conditions, allergies, medications, dietary needs, special needs)** — design this block as visually distinct and clearly marked sensitive, because it is minors' health data being read by volunteers at a venue.
>
> **Check-in** — a purpose-built screen for a volunteer at a door, on a phone, on a bad connection. Large QR viewfinder, big manual-search fallback, confirmation showing the attendee's name and photo with a large green tick. Design the failure states: already checked in, not found, wrong event, unpaid, cancelled. Persistent counter — "184 of 240 checked in" — and an offline banner with a queued-scans count.
>
> **Role variants — design all five:**
>
> | Role | Events becomes |
> |---|---|
> | Super Admin / National | Everything, plus **Refund** on a paid registration (`payments.manage`). |
> | Regional Coordinator | Everything except Refund. Payments are visible, not actionable. |
> | Province Coordinator | Full list, editor, registrations and check-in — but only for events inside their province. The scope picker in the editor is rooted at their province, so they **cannot create a region-wide event**. Payments visible, no refunds. |
> | Parish Leader | **Read-only event list** (`events.view`, no `events.manage`) — no New Event, no editor, no registration row menu. Plus full **Check In** (`events.checkin`). This split is the design challenge: they can work the door but not touch the record. Registration rows open a **read-only attendee card** whose only action is Check in. |
> | Teacher | **No event list at all** (no `events.view`). Only the Check In screen, reached from Overview or the rail. Design that entry: a card naming today's event, or "No event today". |
>
> Also design the **bulk upload** flow (`events.manage`): file picker → column mapping → validation preview with per-row reasons → import summary showing total / successful / failed / partial, with a downloadable error report.

### C9 · Notifications — the reminder system

> Design **Console → Notifications**. It does not exist in the current admin panel and needs care, because the product's stated position is to remind persistently but never guilt anyone. Visible to Regional Coordinator and above.
>
> **Tab 1 — Send an announcement.** Compose form: title, body, deep link, target scope (node picker), target age groups, send now or schedule. Live audience-size preview. A prominent, calm advisory: **only one announcement push per person per day is delivered — a second lands silently in their inbox.** Frame that as a feature of the product's restraint, not an error.
>
> **Tab 2 — Ladder health.** The daily habit ladder has four rungs at default times: **Morning 06:30 · Afternoon 13:30 · Evening 18:30 · Final 20:45.** Teens choose an intensity: **Gentle** (morning only), **Standard** (morning + evening, the default), or **Committed** (all four). Reminders stop the instant the teen completes the day.
>
> The headline metric: **the share of days resolved at rung 1.** Most days should never need rung 3. Design it as a large percentage with a four-segment bar showing where days resolve. Beneath: intensity distribution across the scope, and a count of teens auto-stepped-down (the system lowers intensity after 7 consecutive ignored days; **Gentle is the floor and never steps down to silence**).
>
> **Tab 3 — Delivery.** Push subscriptions active vs. failed, quiet-hours suppressions (default 21:30–06:00, absolute for everything except transactional messages like tickets and receipts), and a recent-sends log with dedupe status.
>
> **The forbidden design moves, stated so the mockups don't drift:** no "your streak is about to die" copy, no red urgency on reminders, no leaderboard of who is most engaged, and **no control anywhere that lets an admin raise a teen's reminder intensity for them.** Only the teen raises it; the system may only lower it.

### C10 · Analytics

> Design **Console → Analytics**, scoped to the leader's node and everything below it.
>
> Four sections: **Engagement** (daily active teens, devotional completion rate, streak distribution, grace days used), **Content** (reads, shares, completion by item, most-read devotionals), **Events** (registrations over time, check-in rate, revenue), **Reach** (members by node — a treemap or ranked bar of the subtree).
>
> Design a node-comparison table: child nodes as rows, metrics as columns, ranked. Make it clearly a **pastoral** tool, not a league table — no trophies, no medals, no "top performer" badges. Where a parish is struggling, the design should invite a follow-up rather than shame one.
>
> Charts use one accessible sequential palette, never the brand green as a data colour where it could be confused with an action. Include date-range control, scope indicator, and CSV export. Every chart needs a loading skeleton and an empty state ("Not enough data yet — check back after 7 days").
>
> **Role variants:** Super Admin / National see all four sections plus platform-wide rollups. Regional Coordinator sees all four for Region 63. **Province Coordinator sees Engagement and Events only** — no Content section, since they neither produce nor publish it. Parish Leader and Teacher have no Analytics screen; their numbers live inline on Overview and My Class.

### C11 · Bible · Manuals · Library & Media · Settings · Audit Log

> Design these five sections as single screens each.
>
> **Bible** (`bible.manage` — Super Admin and National Coordinator only). Translation management: a list of translations (KJV, WEB) with book/chapter/verse counts, licence and attribution text, and import status. The import is idempotent and re-runnable; show "Last imported · 2 Aug 2026 · 31,102 verses" and a running-import state with per-book progress. Reading Scripture is public and needs no permission — this screen gates writes only, so it is rarely visited. Controls: Import translation · Re-run import · Set default translation · Edit attribution · View import log.
>
> **Manuals** (`content.manage` to edit, `content.view` to read). Weekly Sunday-to-Saturday teaching material grouped into series; list by series and week number. The editor needs a clearly separated **Teacher edition** block — teacher notes, discussion guide with answers, extra resources — with an unmistakable "teachers only, never visible to teens" marker. Fields: series, week number, week start/end dates, title, theme, memory verse + text, lesson objectives, lesson content, key takeaways, discussion questions, practical application, activity suggestions, opening prayer points, closing prayer, cover image, PDF, additional resources, target age group. **The Teacher's version of this screen is read-only and opens straight to the current week's lesson** — that is their most-used screen in the whole Console, so design it as a reading experience, not a record view.
>
> **Library & Media** (`media.manage`). Articles, podcasts, videos, playlists. Grid view with covers, category filter (Faith · Relationships · Education · Health · Lifestyle · Testimonies · News), status pills, featured and pinned toggles. Episode editor: series, episode/season number, title, description, show notes, thumbnail, media type (audio / video / both), audio and video sources, duration, transcript, chapters, guests, tags, explicit flag, target age groups.
>
> **Settings.** Design **two versions**. The full version (Super Admin / National): organization details, region configuration, notification defaults, roles & permissions link, integrations (Paystack keys, webhook status), data export, and account security. The **account-only version** (Province Coordinator, Parish Leader, Teacher): profile, password, two-factor, notification preferences, sessions, sign out. Nothing else — not a full settings page with most of it hidden.
>
> **Audit Log** (Super Admin / National). An append-only table: who, action, entity type, entity, when, IP, user agent. Filterable by actor, action, entity type, and date range, with before/after value diffs on an expanded row. This is a record, not a feed: quiet, monospaced identifiers, no avatars, no colour except on destructive actions. Nothing on this screen is editable or deletable — design it so that reads as obvious.

### C12 · My Class (Teacher) — the smallest Console

> Design **My Class**, the Teacher's only data screen and a deliberate demonstration that the Console degrades gracefully to four permissions.
>
> A Teacher holds `users.view`, `profiles.view`, `content.view`, `events.checkin`. That is enough for: a roster of the teens at their parish or area, each teen's profile, this week's manual, and the ability to check someone in at an event.
>
> Design it as **three cards on one page**, not as a stripped-down admin table:
> 1. **My teens** — a roster with photo, name, age, and this week's devotional completion as a small 7-dot strip. Click opens a read-only profile: name, age, home parish, guardian contact, recent activity. **No admin verbs anywhere** — no edit, no deactivate, no role controls.
> 2. **This week's lesson** — the current manual with its teacher edition open by default, and a "Open full lesson" action.
> 3. **Check in** — today's event or "No event today".
>
> This screen must not feel like a permission-denied version of People. It should feel like it was designed for a teacher first. That is the test of whether the whole role model works.

---

## PART D — Complete action inventory

> Every control in the Console, with the permission that reveals it. Use this as the checklist when building the component states — if a button is not in this table it should not appear in the design, and if a row's permission column is empty for a role, that control is **not rendered** for them.
>
> Legend: **SA** Super Admin · **NC** National Coordinator · **RC** Regional Coordinator · **PC** Province Coordinator · **PL** Parish Leader · **T** Teacher.

### D.1 Global shell

| Control | Behaviour | Permission | Roles |
|---|---|---|---|
| Scope switcher | Opens tree picker, re-filters every screen | `hierarchy.view` (implicit) | SA NC RC PC PL |
| Scope switcher (static label) | No sub-nodes to switch to | — | PL, T |
| Sidebar collapse | Toggles to icon rail | — | all |
| Notification bell | Opens the leader's own inbox | — | all |
| Global search | People, events, content within scope | — | all (results filtered by permission) |
| Account menu | Profile · Switch to teen app · Sign out | — | all |
| Breadcrumbs | Navigate up the current section | — | all |
| Theme toggle | Light / dark | — | all |

### D.2 People

| Control | Permission | SA | NC | RC | PC | PL | T |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| View member list | `users.view` | ● | ● | ● | ● | ● | ●¹ |
| Search / filter / sort / column visibility | `users.view` | ● | ● | ● | ● | ● | — |
| Export CSV | `users.view` | ● | ● | ● | ● | ● | — |
| Add member | `users.manage` | ● | ● | ● | — | — | — |
| Edit account (email, status) | `users.manage` | ● | ● | ● | — | — | — |
| Deactivate account | `users.manage` | ● | ● | ● | — | — | — |
| Send welcome email | `users.manage` | ● | ● | ● | — | — | — |
| Resend verification / trigger reset | `users.manage` | ● | ● | ● | — | — | — |
| View profile | `profiles.view` | ● | ● | ● | ● | ● | ● |
| Edit another person's profile | `profiles.manage` | ● | — | — | — | — | — |
| View memberships | `memberships.view` | ● | ● | ● | ● | ● | — |
| Add / change membership | `memberships.manage` | ● | ● | ● | ● | — | — |
| Set primary (home) node | `memberships.manage` | ● | ● | ● | ● | — | — |
| Transfer member | `memberships.manage` | ● | ● | ● | ● | — | — |
| View transfer history | `memberships.view` | ● | ● | ● | ● | ● | — |
| View roles & holders | `roles.view` | ● | ● | ● | ● | — | — |
| Assign role | `roles.assign` + subset rule | ● | ● | ● | — | — | — |
| Revoke role | `roles.assign` | ● | ● | ● | — | — | — |
| Set / change role end date | `roles.assign` | ● | ● | ● | — | — | — |
| Create custom role | `roles.manage` | ● | — | — | — | — | — |
| Toggle a permission on a role | `roles.manage` | ● | — | — | — | — | — |
| Bulk select → transfer / export / deactivate | as above per action | ● | ● | ● | ◐ | — | — |

¹ Teacher's list is **My Class** (C12), not the People table.

### D.3 Hierarchy

| Control | Permission | SA | NC | RC | PC | PL | T |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Browse / expand / search tree | `hierarchy.view` | ● | ● | ● | ● | ● | — |
| View node detail & counts | `hierarchy.view` | ● | ● | ● | ● | ● | — |
| Jump to node's people / events | `hierarchy.view` | ● | ● | ● | ● | ● | — |
| Export tree | `hierarchy.view` | ● | ● | ● | ● | — | — |
| Add child node (type pre-determined) | `hierarchy.manage` | ● | ● | — | — | — | — |
| Rename node / edit church code | `hierarchy.manage` | ● | ● | — | — | — | — |
| Move node (typed confirmation) | `hierarchy.manage` | ● | ● | — | — | — | — |
| Activate / deactivate node | `hierarchy.manage` | ● | ● | — | — | — | — |
| Import nodes from CSV | `hierarchy.manage` | ● | ● | — | — | — | — |

### D.4 Content (devotionals, manuals, articles)

| Control | Permission | SA | NC | RC | PC | PL | T |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| View calendar / list / unpublished items | `content.view` | ● | ● | ● | ● | ●² | ●² |
| Open read-only detail | `content.view` | ● | ● | ● | ● | ● | ● |
| New devotional / manual / series / article | `content.manage` | ● | ● | ● | — | — | — |
| Edit content | `content.manage` | ● | ● | ● | — | — | — |
| Delete / archive content | `content.manage` | ● | ● | ● | — | — | — |
| Add / edit memory verse (set primary) | `content.manage` | ● | ● | ● | — | — | — |
| Add / reorder scripture references | `content.manage` | ● | ● | ● | — | — | — |
| Add / reorder discussion questions | `content.manage` | ● | ● | ● | — | — | — |
| Upload cover image / audio | `content.manage` | ● | ● | ● | — | — | — |
| Bulk import devotionals | `content.manage` | ● | ● | ● | — | — | — |
| Auto-fetch devotional from web | `content.manage` | ● | ● | ● | — | — | — |
| Submit for review (Draft → In review) | `content.manage` | ● | ● | ● | — | — | — |
| Approve (In review → Approved) | `content.publish` + **not the submitter** | ● | ● | ● | — | — | — |
| Send back with notes (In review → Draft) | `content.publish` | ● | ● | ● | — | — | — |
| Resubmit after send-back | `content.manage` (author) | ● | ● | ● | — | — | — |
| Schedule (Approved → Scheduled) | `content.publish` + approved by someone else | ● | ● | ● | — | — | — |
| Publish (Approved/Scheduled → Published) | `content.publish` + approved + memory verse present | ● | ● | ● | — | — | — |
| Archive (Published → Archived) | `content.publish` | ● | ● | ● | — | — | — |
| Manage Bible translations / run import | `bible.manage` | ● | ● | — | — | — | — |
| Manage media, playlists, featured flags | `media.manage` | ● | ● | ● | — | — | — |

² Parish Leader and Teacher hold `content.view`, but their surface is the **manual reader**, not the calendar or the queue.

### D.5 Events

| Control | Permission | SA | NC | RC | PC | PL | T |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| View event list & detail | `events.view` | ● | ● | ● | ● | ● | — |
| Filter / search / export events | `events.view` | ● | ● | ● | ● | ● | — |
| Create event | `events.manage` | ● | ● | ● | ●³ | — | — |
| Edit event | `events.manage` | ● | ● | ● | ●³ | — | — |
| Set scope node & audience | `events.manage` | ● | ● | ● | ●³ | — | — |
| Publish / unpublish / feature event | `events.manage` | ● | ● | ● | ● | — | — |
| Open / close / reopen registration | `events.manage` | ● | ● | ● | ● | — | — |
| View registrations & stats | `events.manage` | ● | ● | ● | ● | —⁴ | — |
| View sensitive medical block | `events.manage` | ● | ● | ● | ● | — | — |
| Confirm registration | `events.manage` | ● | ● | ● | ● | — | — |
| Cancel registration (with reason) | `events.manage` | ● | ● | ● | ● | — | — |
| Move to / from waitlist | `events.manage` | ● | ● | ● | ● | — | — |
| Register someone on their behalf | `events.manage` | ● | ● | ● | ● | — | — |
| Edit internal notes | `events.manage` | ● | ● | ● | ● | — | — |
| Bulk upload registrations | `events.manage` | ● | ● | ● | ● | — | — |
| Bulk confirm / cancel / export | `events.manage` | ● | ● | ● | ● | — | — |
| Send bulk confirmation emails | `events.manage` | ● | ● | ● | ● | — | — |
| Download registration QR / ticket PDF | `events.view` | ● | ● | ● | ● | ● | — |
| **Scan QR to check in** | `events.checkin` | ● | ● | ● | ● | ● | ● |
| **Manual search check-in** | `events.checkin` | ● | ● | ● | ● | ● | ● |
| Undo a check-in | `events.manage` | ● | ● | ● | ● | — | — |
| View payment status & reconciliation | `payments.view` | ● | ● | ● | ● | — | — |
| Verify / mark payment received | `payments.manage` | ● | ● | — | — | — | — |
| Issue refund | `payments.manage` | ● | ● | — | — | — | — |
| Create / edit payment plans | `payments.manage` | ● | ● | — | — | — | — |
| View registration audit log | `events.manage` | ● | ● | ● | ● | — | — |

³ Province Coordinator's scope picker is rooted at their province — they cannot create a region-wide event.
⁴ Parish Leader sees a **read-only attendee card** whose only action is Check in — not the registrations table.

### D.6 Notifications

| Control | Permission | SA | NC | RC | PC | PL | T |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Compose announcement | `users.manage` + scope | ● | ● | ● | — | — | — |
| Preview audience size | as above | ● | ● | ● | — | — | — |
| Send now / schedule / cancel scheduled | as above | ● | ● | ● | — | — | — |
| View ladder-health metrics | `users.view` + scope | ● | ● | ● | — | — | — |
| View delivery log & push health | `users.manage` | ● | ● | ● | — | — | — |
| Edit platform notification defaults | Super Admin | ● | — | — | — | — | — |
| **Raise a teen's reminder intensity** | **nobody — forbidden by design** | — | — | — | — | — | — |
| Manage own notification preferences | — | ● | ● | ● | ● | ● | ● |

### D.7 Analytics, Settings, Audit

| Control | Permission | SA | NC | RC | PC | PL | T |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Engagement / Reach analytics | scope | ● | ● | ● | ● | — | — |
| Content analytics | `content.view` + publish rights | ● | ● | ● | — | — | — |
| Event & revenue analytics | `events.view` + `payments.view` | ● | ● | ● | ● | — | — |
| Node comparison table | scope | ● | ● | ● | ● | — | — |
| Change date range / export CSV | scope | ● | ● | ● | ● | — | — |
| Organization & region settings | Super Admin / National | ● | ● | — | — | — | — |
| Integrations (Paystack, webhooks) | `payments.manage` | ● | ● | — | — | — | — |
| Roles & permissions matrix | `roles.manage` | ● | — | — | — | — | — |
| Own profile / password / 2FA / sessions | — | ● | ● | ● | ● | ● | ● |
| View audit log | Super Admin / National | ● | ● | — | — | — | — |
| Filter audit log / expand value diff | as above | ● | ● | — | — | — | — |

---

## PART E — Component kit prompt

> Build the Console component kit as Figma components with variants. These are in addition to the teen app kit — the Console is denser and needs its own set. Every component in light and dark, bound to variables; no hard-coded hex, spacing, or radius anywhere.
>
> 1. **Scope switcher** — top-bar tree picker. Variants: collapsed chip · open with search · deep path with truncation · **single-node static label** (Parish Leader) · absent (Teacher).
> 2. **Hierarchy tree row** — type badge, chevron, member count; default / hover / selected / disabled / drag-handle states; explorer vs. editor variants.
> 3. **Status pill** — all six content states, all seven registration states, all five payment states, all five upload states. Icon + label, never colour alone.
> 4. **Pipeline stepper** — the six-state indicator, with current / complete / blocked states.
> 5. **Data table** — sortable sticky header; row default / hover / selected / expanded; zebra option; density toggle; bulk-action bar; pagination; column-visibility menu; empty / loading / error rows.
> 6. **Permission matrix cell** — granted · not granted · inherited · locked (system role) · just-changed.
> 7. **Role card** — name, description, permission count, valid node levels, system lock; states: default · selected · invalid-for-this-node · **not-grantable-by-you**.
> 8. **Drawer** — right-side detail panel with tabs, two widths, read-only and editable variants.
> 9. **Date-range control** — including the open-ended "no end date" case role grants need.
> 10. **Metric tile** — value, label, delta, scope caption; loading and no-data variants.
> 11. **Alert banner** — info · caution · error · success, optional action.
> 12. **Confirm dialog** — standard, and a destructive variant requiring typed confirmation.
> 13. **Empty state** — full-page, in-table, and in-card sizes. Plus a **permission-empty** variant: not "no results" but "this isn't part of your role."
> 14. **Form section** — collapsible group header with completion indicator, for the long devotional, manual and event editors.
> 15. **Explanatory chip** — the replacement for a blocked button, carrying the reason ("You submitted this", "Add a memory verse first"). This component is what keeps rule 3 in Part A honest.
> 16. **Sensitive-data block** — the visually distinct container for minors' medical and guardian information, with its own marker and a collapsed-by-default state.

---

## PART F — What changed in the backend (context for the designer)

The existing admin panel has seven pages: Dashboard, Devotionals, Manuals, Media, Events, Users, Settings. All seven assume one kind of administrator. The backend has since gained capabilities none of them can express — and, more importantly, gained the notion that different leaders see different products.

| # | Backend change | What the current admin panel can't do | New Console surface |
|---|---|---|---|
| 1 | Seven-level hierarchy tree with a strict parent/child level rule | No concept of the tree; province was a hard-coded list of seven Lagos strings | **Hierarchy** (C5) + scope switcher (A) |
| 2 | 21 permissions in 8 roles, replacing boolean flags | One undifferentiated "admin" | **The whole Part B role model** |
| 3 | Time-bounded role assignments recording who appointed whom | No grants, no dates, no provenance | **Assign a role** (C3) |
| 4 | Anti-escalation rule: you may only grant what you already hold | Nothing — any admin could do anything | **Computed role picker** (B.4, C3) |
| 5 | Membership separated from authority; append-only transfer log | One flat user list | **People** (C2) |
| 6 | Six-state publishing pipeline + two-person review gate | A publish button on an edit form | **Review queue** (C7) |
| 7 | Devotional calendar with 48-hour gap detection | No way to see an unfilled day before it arrives | **Content calendar** (C6) |
| 8 | `Event.scope_node` replaced the hard-coded province array (closed an IDOR) | Events could not be scoped to a manager's subtree | **Events** (C8) |
| 9 | Notification service: 4-rung ladder, 3 intensities, quiet hours, announcement cap, auto step-down | Nothing | **Notifications** (C9) |
| 10 | Append-only progress actions, streaks, grace days, pauses | Nothing | **Analytics → Engagement** (C10) |
| 11 | Bible text import, search, licence-clean sharing | Nothing | **Bible** (C11) |
| 12 | Append-only audit log across users, roles, registrations | Partially surfaced in a notification dropdown | **Audit Log** (C11) |

**Non-negotiable rules that come from the backend, not from taste:**

1. A node's type must be exactly one level below its parent's.
2. A role is only assignable at the node levels it declares.
3. **A leader may only grant a role whose permissions are a subset of their own at that node.** No path in the UI may offer otherwise.
4. Authority flows down a subtree, never sideways and never up.
5. A submitter can never approve their own content.
6. A devotional cannot be published without exactly one primary memory verse — it is the Verse of the Day.
7. A day is only "covered" by a devotional in Approved, Scheduled, or Published state.
8. Only a Draft may be submitted; only an In-review item may be approved or sent back; only an Approved item may be scheduled; only Approved or Scheduled may be published.
9. An event with no scope node is visible to everyone — deliberate, not a bug.
10. Reminder intensity only ever steps *down* automatically; nothing but the teen raises it, and Gentle never steps down to silence.
11. Transfers, audit entries, and spiritual actions are append-only. Nothing in the UI may offer to edit or delete them.
12. Times and day boundaries are Africa/Lagos, not UTC.

---

## PART G — Deliverables

1. Console token set extending the existing Faith Tribe variables (light + dark; no sepia — that is a Reader-only mode).
2. The component kit in Part E, all 16 components with full variants.
3. All screens in Part C, each in six states (normal, loading, empty, error, permission-denied, dark).
4. **Six sidebar/permission resolutions** — Super Admin, National Coordinator, Regional Coordinator, Province Coordinator, Parish Leader, Teacher — with at least Overview, People, Events and Settings shown resolved for each.
5. The three "smallest Console" screens designed as first-class products, not as degraded admin views: **Teacher's My Class**, **Parish Leader's Check In**, **Province Coordinator's read-only Content**.
6. Prototypes for four flows:
   - **Assign a role** — including the escalation-refused branch.
   - **Submit → review → publish a devotional** — including the "you submitted this" branch.
   - **Create an event → view registrations → check someone in.**
   - **Sign in as a Teacher** — the whole product from their four permissions.
7. Realistic Nigerian content throughout — real parish names, Nigerian names, Naira amounts, Africa/Lagos times.

*If anything here conflicts with `docs/09-design-principles.md` or `docs/10-design-system.md`, those files win.*
