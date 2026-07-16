# 11 — Content Strategy

Words are half the product. A teen decides whether Faith Tribe feels like *theirs* largely from how it speaks. This document governs every string in the interface and every editorial output, and binds writers, designers, and engineers equally.

## Voice

Faith Tribe's voice is a **slightly older friend who walks with God** — the 22-year-old worker every teen respects: warm, real, encouraging, never preachy, never childish, never corporate.

Five voice attributes:

1. **Warm, not gushing.** "Good to see you, Tolu" — not "OMG WELCOME BACK BESTIE!!!"
2. **Faith-filled, not preachy.** Scripture is woven naturally; the app never lectures. We invite, we don't scold.
3. **Clear, not clever.** Plain sentences, everyday words. Understanding beats wordplay, always. (Also serves low-literacy and second-language readers.)
4. **Honest, not hype.** No fake urgency, no exaggeration, no manipulative FOMO. If content is 40 minutes long, say 40 minutes.
5. **Young, not childish.** We respect teens as capable people. No baby-talk, no forced slang. A well-placed, natural Nigerian expression is welcome; engineered "how do you do, fellow kids" slang is banned.

## Tone (voice, adjusted by moment)

| Moment | Tone | Example |
|---|---|---|
| Daily greeting | Warm, light | "Tuesday, July 7 — let's spend a few minutes with God." |
| Devotional intro | Reflective | Written in the devotional's editorial voice (below) |
| Streak milestone | Celebratory, brief | "30 days of showing up. God sees it. 🌱" |
| Streak reminder | Warm, inviting, never accusing | "Keep your streak alive. Today's devotional is still waiting." |
| Streak reset | Grace-first | "New day, fresh start. Yesterday doesn't disqualify you." |
| Error | Calm, responsible | "That didn't go through — it's on our side. Try again?" |
| Payment | Precise, trust-building | Exact amounts, clear recipients, receipts confirmed |
| Safeguarding/report flows ✧ | Serious, safe, plain | No emoji, no lightness; clear next steps |

Rule of thumb: the more sensitive the moment, the plainer the language and the fewer the decorations.

## Writing style rules (UI copy)

- Sentence case everywhere (buttons included): "Start journey", not "Start Journey".
- Buttons are verbs: "Register", "Read now", "Save". Never "OK"/"Submit" where a specific verb exists.
- Second person, active voice: "You're registered" beats "Registration has been completed".
- One idea per sentence; ≤2 sentences per UI message; body copy targets a 12-year-old reading level without talking down.
- Numerals for numbers ("3 days", not "three days"); WAT for times; ₦ with thousands separators ("₦1,500").
- Emoji: sparingly, from the sanctioned set (🌱 🙌 ❤️ 📖 ⛪ ✨), never in errors, payments, or safeguarding contexts, never more than one per message.
- No exclamation stacking. One "!" maximum, rarely.

## Editorial content standards

**Devotionals** — 350–500 words (≈4 min); structure: title → anchor Scripture (live link — `08-bible-experience.md`) → **memory verse** (required; this verse becomes the day's Verse of the Day across the whole platform — "One Day. One Verse. One Message.") → body speaking to real teen life (school, family, pressure, purity, purpose, money, phones) and reinforcing the memory verse's truth → one reflection question → short prayer. The verse, body, challenge, and notifications must carry *one* message; an editor's final check is "what single truth does a teen leave with today?" Doctrinally reviewed under the two-person rule (`07-feature-specifications.md` #5). Grounded in RCCG teaching; centered on Christ, not on behavior-management moralism.

**Bible notes / study content ✧** — explain context plainly; distinguish clearly between *the text says* and *scholars suggest*; never flatten difficult passages with clichés.

**Notifications** — the highest-stakes writing surface: ≤80 characters, concrete value, encouraging, never guilt. The habit reminder ladder (`12-gamification.md`) uses these canonical registers:

- *Morning (invitation):* "Good morning! Today's devotional and memory verse are ready."
- *Afternoon (gentle question):* "Have you had a chance to spend time in God's Word today?"
- *Evening (warm streak preservation):* "Keep your streak alive. Today's devotional is still waiting."
- *Final (open door):* "There's still time to continue today's journey."

Copy rules for reminders: reference *today's* content by name or theme where possible ("Today: 'When friends change' — 4 min"); frame positively (what's waiting, not what's slipping away); the streak may be mentioned as something to *keep*, never as something dying or lost. Banned: "You're falling behind!", "Don't lose your streak!", "Your streak is about to die", accusatory questions ("Where were you today?"), and any copy engineered to sting (`12-gamification.md`). The line between the two: an encouraging reminder makes a teen feel *invited*; a guilt mechanic makes them feel *indicted*. Every reminder string is reviewed against that sentence.

**Encouragement note templates ✧** — the Friends composer offers starter templates in the app's voice ("Praying for you today 🙌", "This verse made me think of you", "You've got this — God's with you"); teens may add short personal text. Templates are pastoral, specific, and never performative (`13-community.md`).

**Announcements** — coordinator-authored; the composer enforces: what, when, where, who to contact, in that order. Templates provided so quality doesn't depend on each coordinator's writing.

**Errors** — three parts, always: what happened (plainly), whose fault it isn't (never the teen's, in tone), what to do next. Specific beats generic: "Your card was declined by the bank" > "Payment error". No codes in the primary line (codes go in a details expander for support).

**Success messages** — confirm the *outcome*, not the system: "You're going to the December Campout 🎉 Your ticket is in Me → Tickets" beats "Transaction successful".

**Encouragement** — the signature register. Principles: name the action, not the person's worth ("You've read 12 chapters this month" — observable, true); God-centered, not performance-centered ("God's been meeting you here" not "You're crushing it, superstar"); never comparative ("more than other teens" is banned — `12-gamification.md`).

## Christian terminology guidelines

- Default to accessible phrasing with the biblical term intact where it matters: prefer "spending time with God" over "quiet time" in UI; prefer "growing in faith" over "sanctification" in product copy — depth belongs in devotionals and study content, which may and should teach richer vocabulary *with explanation*.
- RCCG-specific terms (parish, area, zone, province, region, workers, Digging Deep, conventions) are used correctly and consistently — this app speaks fluent RCCG. A glossary is maintained for new writers.
- Scripture quotations always carry reference + translation tag ("John 3:16, WEB") and honor per-translation attribution requirements (`08-bible-experience.md` licensing).
- Names of God rendered with reverence and consistency per the style guide (e.g., LORD small-caps convention followed per translation text as delivered — never editorially altered).
- We never use spiritual language manipulatively ("God wants you to open the app" is banned, obviously and always).

## Localization

- **V1 ships English (Nigerian register)** — international English with natural Nigerian idiom where it aids warmth.
- Architecture: all strings externalized from day one (i18n keys, no hard-coded copy), ICU message format for plurals/genders, layouts tolerant of +40% string expansion (French) — retrofitting i18n is a rewrite; building it in is cheap (`15-technical-architecture.md`).
- **V3 targets:** Yoruba, Igbo, Hausa UI; French for francophone regions (`02-roadmap.md`). Localization of *editorial* content (devotionals) is an editorial-capacity question, staged separately from UI translation.
- Scripture in Nigerian languages depends on Bible Society of Nigeria licensing — start early (`08-bible-experience.md`).
- Dates/times: WAT default with per-user timezone; day boundaries per Progress rules (`07-feature-specifications.md` #8).

## Content governance

- A single style guide (this document + a living glossary) owned by the content lead (Admin persona's team).
- All teen-reaching editorial content passes review; UI strings ship through a copy review in the design process.
- AI-assisted drafting is permitted for editorial *drafts* only; everything teen-facing is human-reviewed and doctrine-checked before publish (`08-bible-experience.md` AI guardrails).
