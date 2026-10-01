# 1 — How It Should Look and Feel

*(Plain-English version of `docs/09-design-principles.md`. If you want the full technical detail, read that file.)*

This is the most important guide. It describes the feeling every screen must have.

---

## The feeling in three words

**Warm. Calm. Alive.**

- **Warm** — rounded shapes, soft warm colours, friendly words, and drawings of real people.
- **Calm** — lots of space, one main thing per screen, quiet colours. No badges or dots fighting for attention.
- **Alive** — gentle movement and small happy moments. Think of a leaf slowly growing, not confetti popping.

Picture a bright, welcoming church youth hall on a Sunday morning: full of life, but calm when it is time to read. That is the feeling. It should be the **opposite** of a noisy social feed.

**The Bible reader is the calmest screen of all.** When a teen is reading, the design should almost disappear.

**One main idea per screen.** The Today screen shows one thing: today's reading and its verse. Not a busy dashboard.

## Words / fonts

- One clear, friendly font for the app. It must be very easy to read.
- The Bible reader can offer a second, softer "book" font as an option.
- Body text is never smaller than 16px. In the Bible it starts at 18px, and the reader can make it bigger or smaller (from 14px up to 28px).
- Keep lines of text a comfortable width — not too wide.

## Space

- Give things room to breathe. Cramped screens feel stressful.
- Everything lines up to a small 4px grid. On phones: about 24px between cards, and at least 16px of padding inside them.
- Empty space is a good thing, not wasted space.

## Colours

- Backgrounds are a soft off-white — never pure white (easier on the eyes and on phone batteries).
- Text is a soft dark colour — never pure black.
- **Green** is the main colour (the "growing" 🌱 colour). Use it only for the important things: main buttons, the active tab, streak moments. If everything is green, nothing stands out.
- **Amber** (warm yellow) is only for celebration moments.
- Red is only for real errors. Never use red on streaks or games.
- Every colour pairing must be easy to read (pass contrast checks).

## Must-haves for everyone (accessibility)

This is a rule for launch, not a nice extra:

- Taps must be at least 44 × 44px (fingers on cheap phones are not precise).
- Everything still works if the user makes text twice as big.
- Never use colour alone to mean something — always add an icon or a label.
- Screen readers must be able to read everything out.
- Respect "reduce motion" settings — turn animations off for people who ask.

## Movement

Movement has only three jobs: help people know where things came from, show that something worked, and (rarely) celebrate.

- Keep it quick: most movements 150–250ms; celebrations a little longer.
- Celebrations are gentle and happen at most once per session. A leaf unfurling, not a confetti cannon.
- No blinking, no looping, no shaking, no pulsing dots.

## Pictures and drawings

- Use warm, friendly **drawings** that show **Nigerian teens** — real skin tones, hair, school and church life. Not stock Western youth-group photos.
- Use drawings for welcome screens, empty screens, and milestone moments. Never as random filler.
- Real **photos** appear only in the Tribe section (events). Never on the daily Bible or Today screens — those stay calm and drawn/typographic.

## Dark mode

- Every screen needs a dark version from day one (teens read at night).
- Dark backgrounds are a soft dark colour, not pure black.
- The Bible reader also gets a third "sepia" mode — a warm, paper-like colour for comfortable reading.
- Follow the phone's setting by default, but let the user choose.

## Loading and waiting

- Show a soft grey placeholder shape (a "skeleton"), not a spinning wheel.
- Show yesterday's saved content instantly, then quietly refresh.
- For long things (payment, upload) show progress and a calm, reassuring message.

## The 7 things to NEVER do

1. No endless scrolling in the teen app.
2. No videos that auto-play.
3. No scary "your streak is about to die!" messages. Reminders are always warm and kind.
4. No sneaky tricks (guilt messages, hidden ads, forced sharing).
5. No busy admin-style clutter in the teen screens.
6. No trendy redesigns that break the calm feeling.
7. No like counts, follower counts, or popularity numbers on friends or profiles. *(The one exception: community notes will have public likes and reposts — but that is a later version.)*
