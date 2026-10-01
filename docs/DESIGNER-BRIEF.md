# Faith Tribe — Design Brief

**For:** the UI/UX designer
**About:** Faith Tribe — a daily Bible app for teenagers (starting with RCCG Region 63)
**Where we are:** The backend is built and live. Now we need the screens designed.

---

## 1. What we are building

Faith Tribe helps teens spend time with God and read the Bible every day.

It has a **mobile app** and a **website**.

The app has 5 tabs at the bottom: **Today · Bible · Library · Tribe · Me.** The Bible is in the middle, on purpose.

## 2. How it should feel

Three words: **Warm. Calm. Alive.**

- **Warm** — rounded shapes, soft colours, friendly words.
- **Calm** — lots of space, one main thing per screen.
- **Alive** — gentle movement and small happy moments (think a leaf growing, not confetti).

It should feel like the *opposite* of a noisy social media feed. Quiet, kind, and easy.

**The big rule:** The Today screen shows ONE main thing — today's short reading and its Bible verse. It is not a busy dashboard.

## 3. Please read these first

These are the rules. I have written a **plain-English version of each one** for you (in the `docs/designer/` folder). Read them before you design:

- `designer/1-look-and-feel.md` — how it should look and feel (**most important**)
- `designer/2-colours-and-building-blocks.md` — colours, fonts, spacing, buttons, cards
- `designer/3-all-the-screens.md` — the full list of screens
- `designer/4-getting-around.md` — how people move around the app
- `designer/5-how-the-words-should-sound.md` — the writing style
- `designer/6-make-it-hooking.md` — how to make it engaging and habit-forming (the right way)
- `designer/7-children-direction.md` — *(planning only)* the future children's version (ages ~4–12; design after teen V1)

Each one also names the full technical version (files `09`, `10`, `04`, `05`, `11` in `docs/`) if you ever want the deep detail. If this brief and the look-and-feel rules ever disagree, follow the look-and-feel rules.

## 4. Two things to design

**1. The App** — for teens, on the phone. Calm and simple. Big tap targets.

**2. The Website** — this has two parts:
- A **landing page** to welcome new people and help them install the app.
- A **Console** — a desktop tool for church leaders (add events, publish readings, check people in). This one can be denser, like an admin tool.

Same colours for both. But the app stays calm; the Console is a work tool.

## 5. Colours and fonts (already chosen — please reuse)

Do not pick new ones. Use these:

- **Green `#10B981`** — the main colour (buttons, the active tab). Use it a little, not everywhere.
- **Amber `#F59E0B`** — for happy / celebration moments only.
- **Backgrounds** — soft off-white (not pure white). Dark mode uses soft dark (not pure black).
- **Font** — Inter.

Your job: turn these into a full set of design tokens in Figma, for **light mode, dark mode, and a sepia mode** (a warm paper colour for Bible reading).

## 6. What to design now

The backend is ready for all of these. Design them in this order.

**First — the daily habit:**
1. **Sign up / Log in** — by email, phone, or Google
2. **Today** — the reading, the verse of the day, the daily streak, one small challenge
3. **The reading page** — with links that open the Bible
4. **Bible reader** — the calmest screen. Pick book, chapter, verse. Two versions (WEB, KJV). Change text size. Share a verse.

**Next — content and events:**
5. **Library** — articles, videos, podcasts. Save items. Audio keeps playing in the background.
6. **Events** — see an event, register, pay (Paystack), get a QR ticket.
7. **Tribe** — church notices and your church info.
8. **Me** — profile, progress, saved items, notifications, settings.

**Then — the guest view:**
9. The same screens for people who have not signed up. They can read, but some buttons say "Sign up to…". The Bible is always free to read.

## 7. Do NOT design these yet

These come in a later version. Do not draw finished screens for them. If a screen links to one, just show a simple **"Coming soon"** state:

- Bible highlights and notes
- Reading plans and Journeys
- Badges and certificates
- Friends, prayer wall, groups
- **Community notes, likes, and reposts** (a later version — see below)
- Parent access

> **Note on community notes:** the plan is for teens to post short notes (like "God showed up for me today"), and other teens can **like and repost** them, with the counts shown. This is a *later version* (V2), after the safety and moderation tools are built — so please do **not** design it now. Just leave room for it under the Tribe tab and show a simple "Coming soon".

## 8. Every screen needs these versions

A screen is not finished until you show all of these:

1. **Normal** — with real content (real words, not "lorem ipsum")
2. **Loading** — a soft grey placeholder shape (not a spinning wheel)
3. **Empty** — a small picture + one line + one button
4. **Error** — a clear, kind message that tells people how to fix it
5. **Offline** — works with saved content, shows an "offline" bar
6. **Dark mode** — for every screen (teens read at night)

## 9. Rules you must follow

Required for launch:

- Text must be easy to read (strong colour contrast).
- Taps at least **44 × 44 px** (fingers on cheap phones).
- Still works when the user makes text twice as big.
- Always use an icon **and** a label — never colour alone.
- Gentle motion only. Nothing flashing or looping.

Please **do not**:

- No endless scrolling.
- No auto-playing videos.
- No scary messages like "your streak is about to die!"
- No follower counts or popularity numbers on profiles, friends, or streaks. (Community notes *will* get public likes and reposts — but that is a later version, so do not design it now.)
- No guilt or pushy pop-ups.

## 10. Screen sizes

- Design for the **phone first** (360 px wide).
- Also show tablet and desktop where the layout really changes.
- In the app, reading text stays narrow and easy to read, even on big screens.
- The Console is built for desktop.

## 11. What to hand over

1. Figma **colour / spacing / font tokens** (light, dark, sepia) — do this first.
2. A **component kit** — buttons, cards, inputs, tabs, and so on.
3. All the **screens**, grouped by the 5 tabs + website + Console.
4. Simple **click-through prototypes** for: sign up · reading → Bible → back · event sign-up → payment → ticket.
5. A set of **icons and friendly pictures**. Teens should see themselves — Nigerian teens, real skin tones and hair.
6. **Real words** on every screen (match file 11).

## 12. Two things to check early

1. Does the Inter font support Yoruba letters (ẹ ọ ṣ)? We may need this later.
2. Pick the serif font for Bible reading.

## 13. Done when…

- The token kit and component kit are built.
- Every "first" and "next" screen is done in all versions (normal, loading, empty, error, offline, dark).
- The reading → Bible → back flow is prototyped.
- The landing page and the Console are done.
- Every screen passes the reading / contrast / tap-size rules.
- No "later version" feature is fully designed — only shown as "Coming soon".

---

*If anything here clashes with files 09 and 10, follow 09 and 10. The look-and-feel rules always win.*
