# 10 — Design System ("Tribe DS")

The design system implements `09-design-principles.md` as tokens and components. It is the shared language between design and engineering; nothing ships with hard-coded values that a token covers.

## Token architecture & naming

Three tiers, CSS-variable-ready, theme-aware:

1. **Primitive tokens** — raw values: `green.500`, `space.4`, `radius.md`. Never used directly in components.
2. **Semantic tokens** — meaning-mapped: `color.action.primary`, `color.surface.raised`, `color.text.muted`. Theme switching (light/dark/sepia) happens at this tier.
3. **Component tokens** — scoped: `button.primary.bg`, `card.padding`. Only where components need to diverge.

**Naming convention:** `category.role.variant.state` (e.g., `color.action.primary.pressed`, `color.feedback.success.bg`). Code: kebab-case CSS custom properties (`--color-action-primary`); design: matching Figma variables. One source of truth exported to both.

## Grid & layout

- Base unit **4px**; all spacing/sizing derives from it.
- Mobile: 4-column fluid grid, 16px margins, 16px gutters. Tablet: 8-column, 24px margins. Desktop: 12-column, max content width 1200px; reading surfaces capped at 680px regardless of viewport.
- Breakpoints: `sm 360 · md 480 · lg 768 · xl 1024 · 2xl 1280` (`09-design-principles.md`).

## Spacing scale

`space.1 = 4 · 2 = 8 · 3 = 12 · 4 = 16 · 5 = 20 · 6 = 24 · 8 = 32 · 10 = 40 · 12 = 48 · 16 = 64`

Rules: card internal padding `space.4`; between cards `space.6`; section breaks `space.8`; screen top/bottom padding `space.6`/`space.16` (clearing bottom nav).

## Typography scale

UI face: warm geometric sans; Reader alt: serene serif (`09-design-principles.md`).

| Token | Size/Line | Weight | Use |
|---|---|---|---|
| `display` | 32/40 | 700 | Big moments (streak milestone, certificate) |
| `title.lg` | 24/32 | 700 | Screen titles |
| `title.md` | 20/28 | 600 | Card titles, section heads |
| `title.sm` | 17/24 | 600 | List item titles |
| `body.lg` | 18/30 | 400 | **Bible & devotional reading default** (user-scalable 14–28) |
| `body.md` | 16/24 | 400 | Standard UI text |
| `body.sm` | 14/20 | 400 | Secondary text, metadata |
| `caption` | 12/16 | 500 | Labels, timestamps, verse numbers |

Reader line-height 1.65; verse numbers render `caption` weight 500 at 60% text color, superscript.

## Colour tokens (semantic layer)

Exact hex values are finalized in Figma with contrast verification; roles are normative:

| Semantic token | Role | Notes |
|---|---|---|
| `color.surface.base / raised / sunken` | Backgrounds | Warm off-white (light) / deep warm neutral (dark) / sepia set for Reader |
| `color.text.primary / secondary / muted / inverse` | Text | ≥4.5:1 on their surfaces |
| `color.action.primary (+hover/pressed/disabled)` | Buttons, active nav | The living green |
| `color.accent.celebrate` | Recognition, milestones | Warm amber, sparing |
| `color.feedback.success / info / caution / error` (+`.bg` pairs) | System feedback only | Error never used in gamification |
| `color.highlight.1–4` | Bible highlights ✧ | Muted; readable text on top in all themes |
| `color.border.subtle / strong` | Dividers, inputs | |

Status colors for Console entities: `status.draft (gray) · review (blue) · scheduled (purple) · published (green) · archived (muted)`; event registration: `pending (amber) · confirmed (green) · waitlist (blue) · cancelled (gray)`.

## Elevation

Four levels, shadow+ (dark mode: surface lightening instead of shadow):

`elevation.0` flat (base surfaces) · `1` cards · `2` bottom nav, app bars, docked mini-player · `3` sheets, modals, menus. No decorative shadows.

## Radius

`radius.sm 8 · md 12 · lg 16 · xl 24 · full 999` — inputs/chips `sm–md`, cards `lg`, sheets `xl` (top corners), avatars/pills `full`. Rounded = warm; consistency = calm.

## Core components

Each component ships with: anatomy, variants, states (default/hover/pressed/focus/disabled/loading), tokens used, accessibility notes, and do/don't examples. Inventory and key rules:

**Buttons** — variants: primary (filled green), secondary (tonal), tertiary (text), destructive (Console only). Sizes: `lg 48px` (primary mobile actions), `md 40`, `sm 32` (Console density). One primary button per screen. Loading state replaces label with inline spinner, width locked.

**Inputs** — text field (label-above, 48px min height), OTP field (auto-advance), select/sheet-picker (mobile uses bottom sheets, not dropdowns), search field, textarea, toggle, checkbox/radio (44px targets), date picker. Errors inline below field, `feedback.error`, specific copy (`11-content-strategy.md`).

**Cards** — content card (media items), devotional card (Today hero), **verse-of-the-day card** (the day's memory verse: verse + reference + share action; doubles as the shareable frame), event card (date block + title + price/state), progress card (streak), journey step card ✧, friend card ✧ (first name, avatar, parish — never counts or metrics). All `radius.lg`, `elevation.1`, tap-whole-surface.

**Navigation** — bottom nav bar (5 slots, fixed spec — `05-navigation.md`), nav rail (tablet), top app bar (3 contextual variants), Console sidebar, breadcrumbs (Console), back header.

**Lists** — standard row (56px), row with meta/trailing action, section headers, swipe actions (Saved: unsave), Console data table (sortable, pinned column, horizontal scroll).

**Badges & chips** — role tag (Teen/Super Teen/Teacher…), scope tag (parish/area/…), filter chips (Saved, search scopes), count badge (notification bell only — the sole numeric badge in the teen surface), status badges (Console).

**Tabs** — top tabs (segmented, max 4) for intra-screen sections (e.g., My Bible: Highlights/Notes/Bookmarks/History). Never nested tabs.

**Modals & dialogs** — confirm dialog (destructive confirmations, Console), alert dialog (rare), full-screen modal (Console editors). Teen surface prefers bottom sheets over modals in all but destructive cases.

**Bottom sheets** — the teen surface's workhorse: verse actions, pickers, contextual signup prompts, typography settings, share sheet, reminder-intensity picker, partner consent sheet ✧ (plain-language permission list, dual-confirm), encouragement note composer ✧ (templates + short text field, report affordance). Grabber handle, `radius.xl` top, drag-to-dismiss, max 90vh with internal scroll.

**Charts (Console + Me/Progress)** — line (trends), bar (comparisons by parish/area), simple donut (completion), calendar heat-map (personal reading history — private surface only). Rules: always labeled axes, color-blind-safe series palette, no 3D, no gratuitous animation; empty-data states designed.

**Skeletons** — text lines, card, list-row, reader-page skeletons; shimmer subtle; skeleton-first loading is the default (`09-design-principles.md`).

**Media** — video player (poster + tap-to-play, quality menu), podcast player + docked mini-player, audio scrubber, image with blur-up loading.

**Feedback** — toast (bottom, above nav, 3s, single-line + optional action), inline banners (offline bar, sync state), empty-state block (illustration + one line + one action — `06-user-flows.md` flow 26), streak celebration moment (specced motion, `09-design-principles.md`).

**QR components** — ticket QR display (offline-capable, brightness-boost hint), scanner view (Console check-in: viewfinder, result flash green/amber, queue indicator for offline scans).

## Component hierarchy

```
Primitives (tokens)
  → Atoms (button, icon, chip, input, avatar)
    → Molecules (list row, card, search bar, verse action bar, form field group)
      → Organisms (bottom nav, devotional card stack, event registration form,
                    Bible reader surface, Console data table)
        → Templates (Today layout, Reader layout, Detail layout, Console layout)
          → Screens (assembled per 04-information-architecture.md)
```

Rules: organisms may not invent new atoms; screens may not restyle organisms; divergence requires a token or a documented variant — never a local override.

## Iconography

Single icon family, rounded, 2px stroke, 24px grid (20px Console-dense). Filled variants for active nav states. Custom set for identity moments (leaf/growth motif, streak flame, QR, prayer ✧). Always paired with labels in navigation (`05-navigation.md`).

## Governance

- Tokens and components live in a versioned package consumed by the app; Figma libraries mirror releases.
- Changes go through a lightweight RFC (what, why, screenshots, accessibility check).
- A quarterly audit removes drift (local overrides, orphan styles).
- The design system serves the principles; when they conflict, `09-design-principles.md` wins.
