# 08 — The Bible Experience

The Bible is not a feature of Faith Tribe. It is the foundation the product stands on. This document specifies the reader, its systems, its integrations, and the legal realities of Scripture licensing.

**Design north star:** a teen should be *in the text* within two taps from anywhere, and the text itself should be the calmest, most beautiful surface in the product.

---

## 1. The Reader

The reader is the most-used screen in the app. It is optimized for reading, not for chrome.

- **Layout:** single column, generous line height, comfortable measure (~55–65 characters), verse numbers in a muted superscript style that can be toggled off for immersive reading.
- **Header (collapses on scroll):** `[John 3 ▾]` book/chapter pill (opens Navigator), `[WEB ▾]` translation pill, search icon.
- **Chapter navigation:** swipe left/right or edge arrows for previous/next chapter; chapter transitions are instant (adjacent chapters pre-fetched).
- **Footer on scroll-end:** "Next: John 4 →" — reading momentum is sacred.
- **Typography controls:** text size, line spacing, serif/sans toggle, theme (light/sepia/dark) — in a quiet sheet, remembered per user (`09-design-principles.md`).
- **Bottom nav hides on scroll-down** in the reader only (`05-navigation.md`).

## 2. Navigation: Book → Chapter → Verse

- **Navigator sheet:** two-pane flow — book grid (OT/NT sections, testament tabs, recent books pinned at top) → chapter number grid → reader. Target: any chapter in ≤2 taps + 1 scroll.
- **Direct reference entry:** the search field parses references ("jn 3:16", "1 cor 13", "ps 23") with fuzzy book-name matching including common Nigerian abbreviations.
- **Verse selection:** tap a verse to select (subtle highlight); tap-drag or tap additional verses to extend a range; selection opens the verse action bar.

## 3. Verse actions

Selected verse(s) → action bar: **Share · Save · Highlight ✧ · Note ✧ · Copy**.

- **Share (V1):** two outputs — plain text (`"For God so loved…" — John 3:16 (WEB), via Faith Tribe` + deep link) and **verse image**: pre-designed calm templates (never busy), verse + reference + subtle Faith Tribe mark, sized for WhatsApp status. Two taps from selection to share sheet. This is the app's most important organic growth loop (`03-user-personas.md`, Tolu).
- **Save (V1):** bookmark to Saved (`04-information-architecture.md`).
- **Copy (V1):** verse text + reference + translation, correctly formatted.
- **Highlight ✧ (V1.5):** 4 muted highlight colors (no meaning imposed; teens create their own systems); highlights visible inline and listed in My Bible.
- **Note ✧ (V1.5):** private note attached to verse or range; markdown-lite; notes are **private absolutely** — never visible to teachers, coordinators, parents, or admins (`13-community.md` privacy rules).

## 4. Search

- **V1:** reference parsing + keyword search within the current translation; results grouped by book, verse tapped → reader with the verse gently highlighted. Local index for the default translation enables offline search.
- **V1.5:** phrase search, filters (testament/book), search history.
- **Future:** semantic search ("verses about fear") under the AI section below.

## 5. My Bible (personal layer)

Me-adjacent surface inside the Bible tab: **Highlights ✧ · Notes ✧ · Bookmarks · History**.

- **Reading history:** chapters read with dates — feeds Progress (`07-feature-specifications.md` #8); a teen can see their year of Scripture at a glance.
- **Continue Reading:** the single most valuable card on Today; resolves to last reading position (or active plan portion ✧). Position syncs across devices; guest position migrates on signup.

## 6. Reading Plans ✧ (V1.5)

- Plans = ordered daily Scripture portions; catalog curated by admins (starter set: Gospels in 40 days, Psalms of courage, New Believer 14-day).
- Today surfaces the day's portion; reading it in the reader auto-completes the day.
- Missed days pause the plan; the catch-up view shows "Day 12 of 40 — continue" not "9 days behind" (`12-gamification.md`).

## 7. Memory Verses & the Verse of the Day

**The rule (V1): the Verse of the Day *is* the memory verse of today's devotional.** One verse object, one source of truth — "One Day. One Verse. One Message." (`01-vision.md`). That single verse powers the Today card, home-screen widgets ✧, notification copy, the share card, the daily challenge theme, and (future) lock-screen widgets. No feature defines a competing daily verse.

- The memory verse renders on Today and inside the Devotional Reader; its reference is a live link into the Reader (a teen meets the verse, then meets it *in context*).
- The share card generator treats the day's verse as a first-class target: pre-rendered, two taps to WhatsApp status (`§3`).
- **Memory-verse practice ✧ (V1.5):** spaced-repetition review of daily verses plus any verse a teen adds from the action bar. Review = reveal-and-check (self-graded); scheduled reviews resurface on Today and count as spiritual actions for streaks.
- **Memory-verse challenges ✧ (V2):** a teen and a friend commit to the same verse (typically the day's verse); each sees the other's completion — no scores, no public recitation scoreboards (`12-gamification.md`, `13-community.md`).
- Mastery is private; a "verses hidden in my heart" count lives in Progress.

## 8. Cross-references ✧ (V1.5)

- Public-domain cross-reference dataset (Treasury of Scripture Knowledge — public domain) rendered as a subtle icon per verse; tapping opens a sheet of related passages, each one tap from its context.

## 9. Offline behaviour

Non-negotiable for Nigerian connectivity (`03-user-personas.md`).

- The **default translation (WEB) ships fully cached** after first load (~4–5MB compressed as structured JSON — one-time cost, prompted on Wi-Fi/good connection, resumable download).
- KJV downloadable on demand. Licensed translations follow their license terms — many restrict offline storage; the translation manager marks which translations are offline-capable.
- Reading positions, highlights, notes, bookmarks are offline-first with sync (last-write-wins per object; notes conflict-copied, never destroyed).
- Offline search runs against the local index of downloaded translations.

## 10. Translation management

- Translation switcher preserves book/chapter/verse position across translations.
- Per-translation metadata: name, abbreviation, language, copyright line (rendered where required by license), offline-capable flag, license source.
- Architecture treats translations as pluggable text sources: local (public domain, self-hosted) and remote (API-fetched, cached only within license terms). Adding a translation is content ops, not engineering (`15-technical-architecture.md`).

## 11. Licensing and legal considerations

This section is critical and must be reviewed with counsel before launch. Summary of the landscape:

**Public domain (safe to self-host, cache offline, and modify presentation):**

- **World English Bible (WEB)** — modern-English public domain translation, explicitly dedicated to public domain. Recommended **default translation for V1**: contemporary language, zero licensing risk, full offline freedom.
- **King James Version (KJV)** — public domain worldwide *except* the United Kingdom, where Crown letters patent apply. For a Nigeria-first product this is low risk, but note it if/when serving UK users.
- **American Standard Version (ASV)** and several others — available as additional options.

**Licensed translations (require agreements; V2 targets):**

- **NIV** (Biblica/Zondervan), **NLT** (Tyndale), **NKJV** (Thomas Nelson/HarperCollins), **The Message** (NavPress) — each requires a direct license; terms typically constrain verse-count display limits, offline storage, and require copyright notices. Licensing costs may be usage-based; budget conversations belong to the V2 planning cycle (`02-roadmap.md`).
- **ESV** (Crossway) — offers an API with a free tier under specific terms (verse limits per request, attribution, restrictions on offline storage and on constituting a "complete Bible"). Viable as a remote translation if terms are honored precisely.
- **API.Bible** (American Bible Society) — aggregates many translations, including African-language texts, under one API with per-translation terms; the most practical path to translation breadth in V2. Note: typically requires online fetching (limited caching), so it complements rather than replaces the self-hosted public-domain core.
- **YouVersion** does **not** license its content to third parties — do not plan around it.

**Operating rules:**

1. Self-hosted, offline-first core = public domain texts. Licensed texts layer on top under their own constraints.
2. Every rendered licensed verse carries its required copyright line; the verse-share image generator must include translation attribution for licensed texts (public domain texts get a simple `(WEB)` tag).
3. The Verse of the Day (the devotional's memory verse), plans, and AI features must respect per-translation display limits (e.g., some licenses cap consecutive verses); the daily verse defaults to the public-domain WEB text so the share card is always license-clean.
4. **Nigerian-language Scripture** (Yoruba, Igbo, Hausa Bibles) is largely administered by the Bible Society of Nigeria — open licensing conversations early for the V3 localization goal; relationship lead time is long.
5. Audio Bibles are licensed separately from text (often via Faith Comes By Hearing / Davar / publisher audio arms) — a V3 workstream.

## 12. Integration with every other feature

The rule: **any Scripture reference, anywhere, is a live link that opens the reader at that passage with a return path** (`05-navigation.md`, back navigation).

| Feature | Integration |
|---|---|
| Devotionals | Anchor Scripture opens in reader; a "← Back to devotional" chip persists; reading the anchor chapter counts as a spiritual action. The devotional's **memory verse is the Verse of the Day** (§7) — one verse threads the whole day |
| Journeys ✧ | Scripture steps open the reader; completion detected by reading, not by a checkbox |
| Memory verses / Verse of the Day | The daily verse links into its chapter; reviews deep-link into context ("see this verse in its chapter"); friend verse-challenges ✧ resolve to the same verse object |
| Notifications | Reminder copy references today's devotional and verse — the day's message follows the teen off-app (`07-feature-specifications.md` #10) |
| Podcasts / videos / articles | References in descriptions and show notes are parsed into live links |
| Sermon notes / manuals | Every reference in a manual is tappable — a teacher can move class from manual to text in one tap |
| Events | Theme Scripture on event pages links into the reader |
| Daily challenges | "Read Psalm 1" challenges deep-link and auto-complete on read |
| Search (unified ✧) | Scripture results always ranked first |
| Sharing | Every shared verse is a deep link back into the reader — Scripture is the growth loop |

Technical note: a single `ScriptureRef` parser/renderer service handles detection, validation, and linking of references across all content types — one implementation, everywhere (`15-technical-architecture.md`).

## 13. Future: audio Bible (V3)

Chapter-level audio with synchronized highlighting where licensing allows; background playback via the existing audio engine; offline audio packs sized for Nigerian data reality (opus/low-bitrate options).

## 14. Future: AI-assisted study (V3)

Direction, with guardrails set now:

- **In scope:** "explain this passage" (plain-language context), guided study questions, "where does the Bible talk about…?" semantic search, devotional-to-passage connections.
- **Guardrails:** AI outputs are clearly labeled as study aids, never presented as Scripture or doctrine; grounded in the displayed translation text; reviewed prompt/response frameworks approved by the content/doctrine team (`11-content-strategy.md`); no AI-generated "prophecy," prayer replies, or pastoral counseling — those route to humans (`13-community.md`).
- **Privacy:** teen questions to AI study tools are not exposed to leaders or parents.

## Success metrics (see `14-analytics.md`)

- Devotional → Bible tap-through rate (target ≥50%).
- Chapters read per Weekly Engaged Disciple per week.
- % of DAU with a Bible reading action.
- Verse shares per week (organic growth proxy).
- Offline reads as % of total (validates the caching strategy).
