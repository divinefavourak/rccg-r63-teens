# 2 — Colours and Building Blocks

*(Plain-English version of `docs/10-design-system.md`. Read that file for the full detail.)*

This is the kit of parts everything is built from. The goal: build it once in Figma, and both design and code use the exact same values. Nothing should use a random colour or size that isn't in this kit.

---

## Design tokens (name your styles)

A "token" is just a named style — like "main button colour" instead of a raw hex code. Set them up in three layers:

1. **Raw values** — the basic values (a green, a spacing size). Not used directly on screens.
2. **Named-by-job values** — like "main action colour" or "raised surface". This is the layer that changes between light, dark, and sepia mode.
3. **Part-specific values** — only when one part needs its own, like "primary button background".

Use clear names like `colour.action.primary`. The name in Figma must match the name in code exactly.

## Spacing (built on 4px)

Everything is a multiple of 4px:

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

Simple rules: 16px padding inside cards, 24px between cards, and leave room at the bottom of screens so the bottom nav bar doesn't cover content.

## Text sizes

| Name | Size | Used for |
|---|---|---|
| Display | 32px | Big moments (a milestone, a certificate) |
| Title large | 24px | Screen titles |
| Title medium | 20px | Card titles, section headings |
| Title small | 17px | List item titles |
| Body large | 18px | **Bible and devotional reading** (can be resized 14–28px) |
| Body medium | 16px | Normal text |
| Body small | 14px | Secondary info, dates |
| Caption | 12px | Small labels, timestamps, verse numbers |

## Colours (named by job)

| Name | Job |
|---|---|
| Surface (base / raised / sunken) | Backgrounds — soft off-white (light), soft dark (dark), warm paper (sepia) |
| Text (primary / secondary / muted) | Text, always easy to read on its background |
| Action primary | The green — buttons and the active tab |
| Accent celebrate | The amber — only for celebration moments |
| Feedback (success / info / caution / error) | System messages only. Error is never used on games/streaks |
| Highlight 1–4 | Bible highlight colours (later version) |
| Border (subtle / strong) | Lines, dividers, input outlines |

For the leader Console there are also status colours: draft (grey), review (blue), scheduled (purple), published (green), archived (muted). And for event sign-ups: pending (amber), confirmed (green), waitlist (blue), cancelled (grey).

## Rounded corners

`8 · 12 · 16 · 24 px`, plus fully-round for avatars and pills.
Inputs and chips use small rounding, cards use medium/large, bottom sheets round the top corners. Rounded = warm.

## Shadows (depth)

Keep shadows soft and subtle. Four levels only: flat backgrounds, cards, the bottom nav / top bars, and pop-ups / sheets. No decorative shadows. In dark mode, lighten the surface instead of adding a shadow.

## The parts to build

Build each of these with all its states (normal, hover, pressed, focus, disabled, loading), plus notes on how a screen reader reads it:

- **Buttons** — primary (filled green), secondary (soft fill), text-only, and a "destructive" one for the Console. Only **one** primary button per screen.
- **Inputs** — text field, one-time-code field, picker (use a bottom sheet on phone, not a dropdown), search, toggle, checkbox, radio, date picker. Errors show right under the field.
- **Cards** — content card, the Today devotional card, the verse-of-the-day card (also the share image), event card, streak/progress card. The whole card is tappable.
- **Navigation** — bottom nav bar (5 tabs), side rail (tablet), top bar, Console sidebar, back button.
- **Lists** — a standard row, rows with extra info or a trailing action, section headings, swipe-to-act, and a data table for the Console.
- **Badges and chips** — role tags (Teen, Teacher…), filter chips, and the notification count (the only number badge in the teen app).
- **Tabs** — top tabs for sections inside a screen (max 4). Never tabs inside tabs.
- **Pop-ups** — the teen app prefers **bottom sheets** (slide up from the bottom) over centre pop-ups, except for "are you sure?" confirmations.
- **Bottom sheets** — the workhorse of the app: verse actions, pickers, text-size settings, share, and more. Rounded top, a small grab handle, drag down to close.
- **Charts** (Console and progress) — line, bar, donut, and a calendar heat-map. Always label the axes, use colour-blind-safe colours, no 3D, and design the "no data yet" state.
- **Skeletons** — the soft grey loading placeholders.
- **Media** — video player, podcast player with a small docked mini-player, image with a soft blur-in.
- **Messages** — toast (small message at the bottom), offline bar, and the empty-state block (a small drawing + one line + one button).
- **QR parts** — the ticket QR (works offline, brighten-screen hint) and the Console check-in scanner.

## How the parts fit together

Small parts build bigger parts: tokens → basic parts (button, icon, input) → groups (cards, rows) → whole sections (bottom nav, the Bible reader) → full screens.

Rule: a screen should never restyle a part on its own. If something needs to look different, add a proper new version to the kit — don't hack it on one screen.

## Icons

- One icon family. Rounded, simple, drawn on a 24px grid (20px in the dense Console).
- Filled versions for the active tab.
- Always pair icons with a text label in navigation.
