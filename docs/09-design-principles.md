# 09 — Design Principles

## Visual philosophy

**Calm sanctuary, young heart.**

Faith Tribe should feel like the visual opposite of the feeds teens live in: unhurried, warm, spacious, and quietly confident. Not sterile-minimal (that reads cold and adult), and never gamified-loud (that reads cheap and manipulative). The reference emotional register is a bright, welcoming youth hall on a Sunday morning: light, warmth, life — and stillness when it's time to read.

Three words to design by: **Warm. Calm. Alive.**

- **Warm:** rounded forms, warm-tinted neutrals, human illustration, encouraging microcopy.
- **Calm:** generous whitespace, one focal point per screen, restrained color, no competing badges/dots.
- **Alive:** organic growth motifs (the 🌱 identity), gentle motion, celebration that feels like a smile rather than a slot machine.

The Bible Reader is the calmest surface in the product — when a teen is in the text, the interface disappears.

**One Day. One Verse. One Message** is also a visual principle: Today is designed around a single hero moment — the day's devotional and its memory verse — not a dashboard of competing cards. Everything else on Today visibly supports that one message (`01-vision.md`, `04-information-architecture.md`).

## Typography

- **Two-face system:** a warm, highly legible geometric sans for UI (with full Latin coverage incl. ẹ ọ ṣ with underdots for future Yoruba localization — verify before finalizing), and a serene serif offered as an *option* in the Bible Reader (serif toggle), because long-form Scripture reading benefits from it.
- Minimum body size 16px; reader default 18px with user scaling 14–28px.
- Line height 1.5 UI / 1.65 reader; reading measure 55–65ch.
- No decorative display faces; hierarchy comes from size, weight, and space — not novelty. Full scale in `10-design-system.md`.

## Spacing

- 4px base unit; components breathe — cramped layouts read as anxious. Default section rhythm on mobile: 24px between cards, 16px internal padding minimum. Whitespace is a feature, not waste (`10-design-system.md` for the scale).

## Colour usage

- **Foundation:** warm off-white surfaces (not pure white — softer on OLED and eyes), deep warm-neutral text (not pure black).
- **Primary accent:** a living green (the Grow 🌱 identity) used sparingly — primary actions, streak/growth moments, active nav. When everything is green, nothing is.
- **Secondary accents:** one warm amber for celebration/recognition moments; muted supporting hues for highlight colors in the Bible.
- **Semantic colors** (success/info/caution/error) reserved strictly for system feedback — never decorative. Error red appears rarely and never in gamification contexts (`12-gamification.md`: no red streak warnings).
- All combinations meet WCAG 2.1 AA contrast (4.5:1 body text, 3:1 large text/UI components); tokens carry verified pairings (`10-design-system.md`).

## Accessibility

WCAG 2.1 AA is a launch gate (`16-release-checklist.md`), not an aspiration.

- Touch targets ≥44×44px (48px preferred) — cheap Android digitizers are imprecise.
- Full text-scaling support without layout breakage up to 200%.
- Screen reader semantics on all interactive elements; verse structure exposed meaningfully (book/chapter/verse announced).
- Never color-alone meaning (icons/labels accompany states).
- Visible focus states for keyboard/switch access (Console especially).
- Reduced-motion preference honored globally.
- Low-literacy consideration: icon+label pairing everywhere (`05-navigation.md`), short sentences in UI copy (`11-content-strategy.md`).

## Motion & animations

Motion has three jobs: orient (where did that come from?), acknowledge (did that work?), and celebrate (rarely, warmly). Anything else is noise.

- Durations: 150–250ms standard transitions; 300–400ms only for celebration moments. Easing: standard decelerate for entrances, accelerate for exits.
- Screen transitions: subtle slide/fade consistent with platform back gestures.
- **Celebrations:** streak milestones and journey completions get one gentle, organic animation (a leaf unfurling beats confetti cannons). Max once per session. Never blocking; always skippable.
- No looping attention-grabbers, no shaking badges, no pulsing dots.
- All motion respects `prefers-reduced-motion`.

## Illustrations

- A custom, consistent illustration style: warm, organic, inclusive — Nigerian teens should see themselves (skin tones, hair, school and church contexts drawn from their world, not stock-Western youth-group imagery).
- Used for: onboarding, empty states, milestone art, seasonal moments. Never as filler.
- Style: flat with soft texture, rounded geometry, the green/amber palette; consistent line weight. Build a reusable scene/character kit rather than one-off art (`10-design-system.md` asset library).

## Photography

- Real ministry photography (events, camps, worship) appears in **Tribe** (event banners, recaps) — authentic, warm, well-lit, faces-forward with consent protocols (safeguarding: no identifying minors without consent — `13-community.md`).
- Photography does **not** appear in the daily spiritual surfaces (Today, Bible) — those stay illustrated/typographic to protect calm.
- Every photo ships in compressed responsive variants; hero images budgeted <120KB on mobile (data cost — `15-technical-architecture.md` performance budgets).

## Dark mode

- Full dark theme from V1 (teens read at night — `03-user-personas.md`, Tolu's 9–10pm window; OLED battery savings matter on their devices).
- Dark surfaces are deep warm neutrals, not pure black; accent colors get dark-mode variants tuned for contrast.
- Bible Reader adds a **sepia** theme (light-warm) as a third reading option.
- Follows system preference by default; user-overridable; choice persists.

## Microinteractions & feedback

- Every tap acknowledges within 100ms (state change, ripple, or skeleton).
- Save action → icon fill + toast with Undo. Completion → checkmark draw-in + streak tick. Errors → inline, specific, recoverable (`06-user-flows.md` flow 25).
- Haptics (where supported): one light tick for completion moments only. Sound: none, ever, outside media playback.
- Pull-to-refresh on feeds; the refresh indicator is the leaf motif — small identity moments compound.

## Loading states

- **Skeletons over spinners** for all content surfaces (perceived speed on 3G is a core UX metric).
- Cached-first rendering: show yesterday's cache instantly, refresh silently (Today, Library).
- Long operations (payment, upload) get progress + reassurance copy; payments additionally get a "don't close" hint.
- Never a full-screen blocking spinner where a skeleton could stand.

## Responsive behaviour

- Breakpoints: 360 (design base) / 480 / 768 (rail nav) / 1024 (Console sidebar) / 1280 (max content widths).
- Mobile-first CSS; the desktop teen surface is a comfortably widened mobile layout, not a re-imagining (`05-navigation.md`).
- Reader line length capped regardless of viewport; media players scale fluidly; Console tables may scroll horizontally with pinned key columns.

## Anti-principles (never do)

1. No infinite scroll anywhere in the teen surface.
2. No autoplaying media.
3. No shame-framed urgency: no red streak warnings, no countdown timers, no "your streak is about to die!" framing. Streak-preservation reminders exist and are encouraged (`12-gamification.md`) — but they are always warm, verbally positive ("Keep your streak alive", "There's still time"), and visually calm. Urgency is expressed through timing, never through alarm aesthetics.
4. No dark-pattern prompts (guilt-copy on dismiss, disguised ads, forced sharing).
5. No visual density borrowed from admin tools into teen surfaces.
6. No trend-chasing redesigns that break the calm identity for novelty.
7. No social-validation visuals: no follower counts, like counters, or popularity indicators on any friend surface ✧ (`13-community.md`).
