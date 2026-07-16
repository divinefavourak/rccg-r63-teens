# 05 — Navigation

Navigation implements the five-intent architecture from `04-information-architecture.md`. The rules here are binding for all platforms.

## Global rules

1. **Five destinations, forever:** Today · Bible · Library · Tribe · Me. New features join existing destinations; the primary nav never grows.
2. **Bible is center.** On mobile bottom nav, Bible occupies the center slot — a physical statement of the product's foundation.
3. **One-thumb reachability.** All primary navigation and primary actions live in the bottom 60% of mobile screens.
4. **Never trap the user.** Every screen has an obvious way back; deep links always land with a functioning back path.
5. **Navigation is calm.** No badge counts on nav items except the Notifications bell (and even that is capped — see Notifications below). No red dots competing for attention.

## Mobile navigation (primary platform)

### Bottom navigation bar

Persistent on all top-level and most second-level screens.

```
┌─────────────────────────────────────────────┐
│                 (content)                   │
├─────────┬─────────┬─────────┬───────┬───────┤
│  Today  │ Library │  BIBLE  │ Tribe │  Me   │
│   ☀️    │   ▶     │   📖    │  ⛪   │  👤   │
└─────────┴─────────┴─────────┴───────┴───────┘
```

- Icons + labels always (no icon-only nav; labels aid younger teens and low-literacy contexts).
- Active state: filled icon + accent color + label weight change. Inactive: outline icons.
- Bottom nav **hides on scroll-down, returns on scroll-up** inside the Bible Reader and article/long-form readers only — reading is the one context where immersion beats wayfinding. Everywhere else it is fixed.
- Re-tapping the active tab scrolls to top / pops the tab's stack to root (platform convention teens already know).
- Each tab maintains its own navigation stack; switching tabs preserves position within the previous tab.

### Top app bar

Contextual per screen: screen title or logo (Today), search icon (Library, Bible, Tribe), notifications bell (Today and Tribe), overflow only when genuinely needed. The Bible Reader has its own specialized header (book/chapter pill, translation pill, search) — see `08-bible-experience.md`.

### Drawer

**There is no hamburger drawer for teens.** Five tabs + Me covers the entire teen surface; a drawer would be a dumping ground and violates "simplicity over complexity." The Console (leader surface) may use a collapsible side rail on desktop — that is a different surface with different users.

## Tablet navigation

Tablets are rare among Nigerian teens but common among teachers/admins using the Console.

- **Teen surface (≥768px):** bottom nav is replaced by a **left navigation rail** (same five items, icons + labels). Content area gains a max-width to preserve line lengths (`09-design-principles.md`).
- **Bible on tablet:** reader supports a side panel for search results/notes ✧ alongside the text.
- **Console:** designed desktop/tablet-first with a persistent left sidebar (Overview, People, Content, Events, Manuals, Analytics, Moderation ✧, Settings).

## Desktop navigation

- **Teen surface:** top header with logo left, the five destinations center, search + notifications + avatar right. Content constrained to a comfortable reading column; the desktop teen experience is a widened mobile experience, not a different product.
- **Console:** persistent left sidebar + breadcrumbs (`Console → Events → Teens Hangout → Registrations`). Dense tables are permitted here; the Console is a working tool.

## Search

Search is a top-bar icon, not a nav destination.

- **Scoped by origin:** search opened from Bible searches Scripture; from Library searches content; from Tribe searches events/announcements.
- **Unified search ✧ (V1.5):** a single search surface with scope chips — `All · Bible · Library · Events` — reachable from Today. Results grouped by type, Scripture results always first (foundation, not afterthought).
- Recent searches stored locally; popular searches curated, never algorithmic trends.

## Notifications

- Bell icon in the top bar (Today, Tribe) opens the **Notifications inbox** (Me → 5.6 is the same surface).
- Badge shows unread count, capped display at "9+". Notification *sending* follows the habit-reminder ladder and configuration rules in `07-feature-specifications.md` #10 — reminders are completion-aware (they stop once today's devotional is done), so the inbox stays calm for consistent users.
- Inbox groups by day; each item deep-links to its subject (event, devotional, announcement, friend request ✧).

## Guest navigation

Guests see the same five-tab structure — deliberately. The guest experience is a preview of the real product, not a marketing site.

- **Today (guest):** today's devotional readable in full; streak/challenge cards render in a locked "Sign up to start your streak" state.
- **Bible (guest):** fully readable and searchable. The Bible is never paywalled behind an account. Personalization (bookmarks, history sync) prompts signup contextually.
- **Library (guest):** browse everything; play featured items; other playback prompts signup.
- **Tribe (guest):** events viewable; tapping Register starts the lightweight signup-then-register flow (`06-user-flows.md`).
- **Me (guest):** becomes the auth screen (sign up / log in).

Signup prompts are **contextual and dismissible** — triggered by an action that genuinely needs an account, never by interstitials on open.

## Authenticated navigation

As specified throughout. Landing screen is always **Today**. Session restoration returns the user to their last tab.

## Role-based navigation

Roles add capability; they never fork the teen experience.

| Role | What changes |
|---|---|
| Teen | Baseline five tabs |
| Super Teen | Baseline + role tag on profile + Serve/volunteer entries in Tribe + share tooling |
| Teacher | Baseline + **Manuals section unlocked in Library** + "Console" entry appears in Me (class view) |
| Coordinator | Baseline + Console entry (People, Events, Content submission, scoped Analytics) |
| Administrator | Baseline + full Console for their scope |

Rules:

- Role capabilities are **scope-aware** (a coordinator's Console shows only their area — `15-technical-architecture.md`).
- Leaders keep the full teen experience; a coordinator has a streak too. The Console is an *additional* place, entered deliberately, never mixed into teen surfaces.
- Role-gated items are invisible (not disabled) to those without the role — no locked doors to rattle.

## Deep linking

Every meaningful entity has a stable, shareable URL. Deep links are a growth channel (WhatsApp forwarding is the region's real social network — `03-user-personas.md`).

| Entity | Pattern |
|---|---|
| Devotional | `/today/2026-07-07` |
| Verse of the Day | `/today/2026-07-07/verse` (share-card target; resolves to the devotional's memory verse) |
| Bible passage | `/bible/jhn/3/16` (+ `?t=web` translation, `?v=16-18` range) |
| Library item | `/library/{slug}` |
| Event | `/events/{slug}` |
| Ticket | `/me/tickets/{id}` |
| Journey ✧ | `/journeys/{slug}` |
| Friend invite ✧ | `/friends/invite/{code}` (auth-then-resume; lands on a request-confirmation screen, never auto-friends) |
| Console object | `/console/events/{id}` etc. |

Behavior rules:

- Deep links open **in context with a working back path** to the entity's natural parent (a shared verse link back-navigates to the Bible Reader, not a dead end).
- Unauthenticated users hitting an auth-required link get the guest view where possible, or auth-then-resume (post-login redirect to the original target) where not.
- Links carry region context implicitly via the entity; a Region 63 event link opened by a future Region 30 user shows the event with a "hosted by Region 63" frame, not an error (`15-technical-architecture.md`).

## Back navigation

- **Android hardware/gesture back is sacred.** It always goes back one step in the current stack; at a tab root it exits the app (never hijacked into "are you sure?" dialogs except during unsaved form input or mid-payment).
- In-app back arrows appear on all pushed screens, top-left.
- **Reading return path:** when a Scripture link opens the Bible from a devotional/article, a "← Back to devotional" affordance persists (dismissible chip), because reader-to-Bible-and-back is the single most important loop in the product (`08-bible-experience.md`).
- Payment flows: back is intercepted only between "payment initiated" and "payment resolved," with a clear resume/cancel choice.

## State persistence

- Bible reading position, tab stacks, audio playback (mini-player persists across all tabs), and form drafts survive navigation.
- Podcast mini-player docks above the bottom nav; tapping expands to full player; swipe down re-docks.
