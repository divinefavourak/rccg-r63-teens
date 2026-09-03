# 7 — Designing for Children (planning note)

*(Direction from the product owner: we also want a version for **children, roughly ages 4–12**, as a companion to the teen app. This is **planned now, but the full screens come after the teen app launches.** So this page is the thinking, not finished designs — please don't build children's screens yet. It makes sure we get the direction right when we do.)*

---

## Who it's for

Children aged about **4 to 12**, under one "Children" umbrella, with the app quietly adjusting to the child's age:

- **Little ones (~4–7)** — can't really read yet. Picture-first, lots of audio, a friendly character, usually with a grown-up nearby.
- **Big kids (~8–12)** — can read; need simpler words and bigger visuals than teens; can use it more on their own.

The app should scale the amount of words vs. pictures by age.

## The golden rule

**This is a companion, not the teen app shrunk down.** Children are not small teens — different reading level, different attention span, different safety needs. Same warm brand, but genuinely redesigned for how children use apps.

## Safety comes first — even more than for teens

Young children need much stronger protection, and this is what earns parents' trust:

- **Accounts are created and managed by a parent or guardian.** A young child does not sign up alone.
- **Parent consent up front** (Nigeria's child-data rules), plus a **parent area** to see and control what the child does.
- **No open community for children at all.** No public feed, no stranger friends, and **no likes / reposts / popularity numbers** for kids. *(The teen "community notes with likes" is teen-only — it does not come down to children.)*
- **Parent controls:** daily time limits, quiet/bedtime, and a view of progress.
- **Collect the least data possible.**

## What stays the same as the teen app

- The same warm brand family: green + amber, the "growing 🌱" idea, calm and kind.
- The same building-block kit as a starting point (reuse the colours, spacing, and components) — just tuned bigger and more playful.
- The same idea of **hook the habit, not the session** (see `6-make-it-hooking.md`) — but even gentler.

## What changes for children

- **Far more pictures, far less text.** A friendly character / mascot guides them.
- **Audio everywhere** — stories read aloud, buttons that can speak — so children who can't read yet can still use it.
- **Bigger everything** — bigger taps (think 56–64px), bigger text, fewer choices per screen.
- **Simpler navigation** — fewer tabs, big clear icons. Maybe just Home · Bible stories · Fun · Me.
- **The Bible as illustrated, narrated stories** — not full chapters of text.
- **Playful, kid-friendly rewards** — stickers, a growing garden, characters — but still no dark patterns, and still a happy "you're done!" finish line.
- **Short sessions on purpose** — a young child's daily time is a few minutes, then done.

## The "hooking" question for children

Yes — make it delightful and something they want to come back to. But for children the guardrails matter **even more**, because parents watch closely and will delete anything that feels manipulative:

- Keep the finish line and the daily "done!" celebration.
- Reward showing up, gently. No streaks that make a 5-year-old feel guilty.
- No endless anything. No ads. No popularity. Short and sweet.
- Give parents visible controls — that trust is what lets the child keep using it.

## Content to plan for

- Children's Bible stories (illustrated **and** narrated), age-appropriate.
- Very short daily moments: a story, a simple prayer, one tiny activity.
- Kids' worship songs (maybe).
- Simple challenges a child can actually do.

## Open questions to settle before full design

- Exact age bands — two modes (4–7, 8–12) or three?
- One app with a "kids mode" a parent switches on, or a separate kids app? *(Leaning: same family, opened through a parent.)*
- Do we need a mascot / character? *(Probably yes, especially for little ones.)*
- Which do we build first — older kids (closer to teens, easier) or little ones?
- Who writes and illustrates the children's Bible stories?
- **Rewards for kids need their own decision.** The teen product deliberately bans points, XP, and levels (see the teen gamification rules). Young children may need gentler, more playful encouragement (stickers, a growing garden, a character) — but we must decide what's okay for kids without sliding into the "coins and points" pattern the teen product rejected. *(Note: an earlier child-UI experiment used coins/mascots — that was parked; don't revive it without a fresh decision.)*

## Next step

After the teen app (V1) launches, turn this note into a **full children's design brief** — like the teen pack, with screens, all their states, and its own separate safety review.
