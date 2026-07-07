# 01 — Vision

## Vision

**Faith Tribe is the digital home for every teenager in RCCG.**

The place a teen opens in the morning before school, the place their devotional lives, the place they read Scripture, register for camp, discover where to serve, and feel they belong to something bigger than their parish — a tribe of young people growing in faith together across Nigeria and beyond.

## Mission

To make spiritual growth part of a teenager's everyday life by putting Scripture, discipleship, and church community into the device they already carry — in a way that strengthens, and never replaces, their local church.

## Why this product exists

Three realities motivate Faith Tribe:

**1. Teen spiritual life is episodic; growth is daily.** Most RCCG teens engage with church intensely on Sundays and at camps, conventions, and conferences, then go quiet for the days and weeks between. Faith is formed in the gaps — the Tuesday morning before a test, the Friday night scrolling alone. No RCCG tool currently lives in those gaps. Faith Tribe does.

**2. The tools teens use daily were not built for them spiritually.** Teens spend hours a day inside products engineered to maximize attention: infinite feeds, outrage loops, comparison engines. YouVersion is excellent but generic; it knows nothing about a teen's parish, their coordinator, their camp, or the Teenage Open Heavens devotional. Faith Tribe is built for *this* teen, in *this* church, with *this* devotional, going to *this* event.

**3. RCCG's teen ministry runs on fragmented, manual infrastructure.** Registration lists on paper, devotionals as PDFs on WhatsApp, attendance on spreadsheets, announcements lost in group chats. Coordinators spend their energy on logistics instead of ministry. Faith Tribe consolidates this into one platform — which is also what makes the discipleship features distributable: the church structure is already inside the product.

## What Faith Tribe is not

Writing this down prevents scope drift:

- **Not a church website.** No "About Us" pages, no static brochureware.
- **Not an event registration site.** Events are one feature, not the center of gravity. If a teen only opens the app to register for camp twice a year, we have failed.
- **Not social media.** No public feeds, no follower counts, no likes, no algorithmic timelines, no infinite scroll. Community features exist — including a Friends system and Accountability Partners (see `13-community.md`) — but they are built for discipleship, encouragement, and accountability within real church relationships, never for social validation or engagement mechanics.
- **Not a replacement for church.** Every design decision should push teens *toward* their parish, their teachers, and physical gatherings — never away from them.

## Long-term vision (5 years)

1. **Year 1:** Faith Tribe is the daily companion for Region 63's teens. Devotional reading moves from PDFs to the app. Events run end-to-end on the platform.
2. **Year 2:** Two to four additional regions onboard using self-serve tenant tooling. The National Teens directorate publishes shared content (Teenage Open Heavens, national programs) once, distributed to all regions.
3. **Years 3–4:** Faith Tribe is the recognized standard youth platform across RCCG regions in Nigeria. Licensed modern translations, audio content, and native apps ship.
4. **Year 5:** Faith Tribe supports RCCG's international regions, multiple languages (Yoruba, Igbo, Hausa, French for francophone Africa), and AI-assisted study tools — a teen anywhere in the mission can grow with the same depth as a teen in Lagos.

Nothing built in Year 1 may structurally prevent Year 5. See `15-technical-architecture.md` for how this constraint is enforced.

## Product philosophy

**Technology should strengthen church life. Technology should never replace church.**

Practical consequences of this philosophy:

- Notifications call teens to Scripture and to gatherings, not merely back to the app.
- Success for a session can be *closing the app* — a teen who reads the devotional in four minutes and goes to school with a verse in mind is a win, not a retention failure.
- Community features route teens toward known, accountable people — their real church structure (teachers, coordinators) and mutually chosen church friendships — never toward strangers or algorithmic suggestions.
- We measure spiritual actions (Scripture read, journeys completed, service signups), not raw screen time. Time-in-app is explicitly *not* a goal metric (`14-analytics.md`).

## Core values

Every feature must reinforce at least one. A feature that reinforces none is cut.

| Value | Meaning | Primary expressions |
|-------|---------|---------------------|
| 🌱 **Grow** | Daily spiritual formation | Bible, Today, Journeys, reading plans, memory verses |
| 🤝 **Connect** | Real relationships within the church | Friends, accountability partners, groups, prayer requests, events, parish identity |
| 🙌 **Serve** | Ministry participation | Volunteer opportunities, roles, leadership pathways |
| ❤️ **Belong** | Every teen has a place in the tribe | Profiles, recognition, parish community, encouragement |

## Product principles

These are decision-making tools. When two designs conflict, the principle wins.

1. **Mobile-first.** Design at 360px on a low-end Android over 3G. Desktop is the adaptation, never the source.
2. **Simplicity over complexity.** Every screen has one job. When in doubt, remove.
3. **Daily engagement over seasonal engagement.** A feature used 5 minutes daily beats a feature used 5 hours yearly. The Today experience is the heartbeat; events are the peaks.
4. **Encourage rather than shame.** Broken streaks restart with grace, not guilt. No red badges of failure. No public leaderboards of spiritual activity (`12-gamification.md`).
5. **Calm rather than noisy.** No autoplay, no badge-count anxiety, no manufactured urgency. Notifications exist to serve habit formation — timely, encouraging reminders toward the day's devotional and streak (`12-gamification.md`) — and they stop the moment the day's time with God is done. The app should feel like a quiet room with a faithful friend who knocks, not a market.
6. **Ministry over entertainment.** Media exists to disciple, not to fill time. No infinite scroll in the Library.
7. **Community over algorithms.** Content is curated by teachers and coordinators who know these teens, not ranked by an engagement model. Relationships (friends, accountability partners) are chosen, mutual, and discipleship-shaped — never algorithmically suggested strangers.
8. **Spiritual growth before feature quantity.** We ship fewer features, deeper. See the consolidation decisions in `04-information-architecture.md`.
9. **One Day. One Verse. One Message.** Each day, the whole platform reinforces one central biblical truth. The devotional is the center of today's journey; its memory verse is the day's verse — the same verse that appears as the Verse of the Day on the home screen, in widgets, notifications, share cards, and the daily challenge theme. Disconnected content is a design failure; a teen should close the app carrying one message, not five.

## Definition of success

Faith Tribe succeeds when a teenager's spiritual habits change — measurably and durably.

**Qualitative:** A teen in Region 63 says, unprompted, "I read my Bible more because of Faith Tribe," and a coordinator says, "I spend less time on logistics and more time with my teens."

**Quantitative:**

### North Star Metric

> **Weekly Engaged Disciples (WED):** the number of teens who complete a meaningful spiritual action on **3 or more distinct days** in a week.

A *meaningful spiritual action* is one of: completing a devotional, reading a Bible chapter, completing a Journey step, completing a daily challenge, or memorizing/reviewing a memory verse.

Why this metric:

- It measures **habit**, not visits. Three distinct days is the threshold where behavior becomes rhythm.
- It counts **spiritual actions**, not screen time — aligned with the philosophy that closing the app quickly can be a win.
- It is **gameable only by discipleship.** The only way to grow WED is to help more teens engage with Scripture more regularly, which is exactly the mission.
- It scales across regions without redefinition.

Supporting metrics, guardrail metrics, and the full measurement framework live in `14-analytics.md`.

### Launch-year targets (Region 63)

- 60% of registered Region 63 teens activate an account within 6 months of launch.
- 25% of active accounts qualify as Weekly Engaged Disciples by month 6.
- 90% of regional teen events run registration and check-in through the platform.
- Devotional distribution moves fully off PDF/WhatsApp by the end of year one.

## Relationship to other documents

- What we build first: `02-roadmap.md`
- Who we build for: `03-user-personas.md`
- How the philosophy becomes structure: `04-information-architecture.md`
- How the philosophy becomes mechanics: `12-gamification.md`
- How we measure the mission: `14-analytics.md`
