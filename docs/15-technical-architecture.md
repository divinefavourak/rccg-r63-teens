# 15 — Technical Architecture

This document defines architectural *principles and shapes*, plus a recommended reference stack. Engineering may vary implementations, but the invariants (tenancy, offline, API-first, RBAC model, performance budgets) are binding.

## High-level architecture

```
                        ┌──────────────────────────────┐
   Teens / Leaders ───▶ │  PWA (installable web app)   │
   (Android-first)      │  app shell + service worker  │
                        └──────────────┬───────────────┘
                                       │ HTTPS / JSON (versioned API)
                        ┌──────────────▼───────────────┐
                        │        API Application        │
                        │  Auth · RBAC · Hierarchy      │
                        │  Content · Bible · Progress   │
                        │  Events/Payments · Notifs     │
                        └───┬──────────┬───────────┬────┘
                            │          │           │
                 ┌──────────▼─┐  ┌─────▼─────┐ ┌───▼────────────┐
                 │ PostgreSQL │  │   Redis    │ │ Object storage │
                 │ (primary)  │  │ cache/queue│ │  + CDN (media) │
                 └────────────┘  └───────────┘ └────────────────┘
                            │
              ┌─────────────┼───────────────────────────┐
        ┌─────▼─────┐ ┌─────▼──────┐ ┌──────────▼──────────┐
        │ Paystack  │ │ Push (Web  │ │ SMS/Email providers │
        │ webhooks  │ │ Push/FCM)  │ │ (OTP, transactional)│
        └───────────┘ └────────────┘ └─────────────────────┘
```

**Shape:** a modular monolith exposing a versioned JSON API, with background workers (queue via Redis) for notifications, webhooks, exports, and analytics ingestion. Not microservices — a small team shipping V1 does not pay the distributed-systems tax; module boundaries (auth, hierarchy, content, bible, progress, events, notifications, community ✧) are kept clean so extraction is possible if scale ever demands it.

**Reference stack:** the existing team's fluency matters more than fashion. Two sanctioned combinations: **Django + DRF** (matches the team's current RCCG platform experience) or **NestJS + Prisma** (matches the team's product experience elsewhere). Pick one, document the decision as an ADR, and stop debating. Frontend: **Next.js PWA** (React), TypeScript throughout, PostgreSQL (managed), Redis, S3-compatible storage + CDN.

## API design

- Versioned REST (`/api/v1/…`), resource-oriented, cursor pagination, consistent error envelope (machine code + human message keyed for i18n — `11-content-strategy.md`).
- **API-first is the mobile strategy:** the same API serves the PWA today and native apps in V3 with zero backend rework (`02-roadmap.md`). No view logic in the API; no PWA-only endpoints.
- Idempotency keys on payment and registration mutations (retry safety on flaky networks).
- Rate limiting per user/IP; stricter on auth and OTP endpoints.

## Authentication & sessions

- Argon2/bcrypt password hashing; OTP via SMS/email for verification and reset; Google OAuth.
- Short-lived access token + rotating refresh token in **HTTP-only, Secure, SameSite cookies** (no tokens in localStorage). Sessions effectively persistent on a teen's own device (`06-user-flows.md` flow 4); server-side revocation list for compromised sessions.
- Device sessions listed in Settings with remote sign-out.

## Roles, permissions & hierarchy (the RBAC model)

Everything scoping-related hangs on two entities:

- `hierarchy_node` — tree: National → Region → Province → Zone → Area → Parish (closure table or materialized path for fast subtree queries).
- `role_assignment` — (user, role, node): "Coordinator of Area X", "Admin of Region 63", "Teacher of Parish Y".

Rules:

1. Permissions are **capabilities** (`content.publish`, `event.manage`, `event.checkin`, `analytics.view`, `roles.assign`, `moderation.act` ✧) granted by role, always evaluated **within the assignment's subtree**.
2. Every scoped entity (content, event, announcement, group ✧) stores a `visibility_node_id`; a user sees entities whose node is an ancestor-or-self of their parish (plus explicitly targeted nodes).
3. Server-side enforcement is the source of truth; client-side gating is UX only (`05-navigation.md`, invisible-not-disabled).
4. All privileged mutations are audit-logged (actor, action, target, timestamp, before/after).

## Multi-region support (tenancy)

**Decision: single application, single database, region as a first-class scope — not per-region deployments.**

- A "region tenant" is simply a `Region` node plus its subtree, its role assignments, and its scoped content. Onboarding a region = data + configuration, never code (`07-feature-specifications.md` #3 AC; `02-roadmap.md` V2).
- A **National scope layer** sits above regions: nationally published content (e.g., a national devotional, national events) is visible to all; regional content stays regional. This is the "publish once, distribute everywhere" mechanism (`01-vision.md` Year-2 vision).
- Why not database-per-region: RCCG regions share national content, users move between parishes/regions, national analytics must aggregate, and operational overhead of N databases would sink a small team. Row-level scoping with rigorous query discipline (repository-layer scope enforcement + tests) is the right trade-off at this scale.
- **Hard rule, enforced in code review:** no code path may reference Region 63 (or any node) by ID or name. Region-specific behavior, if ever genuinely needed, is configuration on the node.

## Data model (core entities, indicative)

`user · profile · hierarchy_node · role_assignment · content_item (typed: devotional/article/video/podcast/manual/announcement; devotionals carry a required memory_verse reference — the day's Verse of the Day, single source of truth) · series · scripture_ref (parsed references on content) · bible_translation · bible_text (book/chapter/verse, per translation) · spiritual_action (event stream) · reading_position · streak_state · grace_day_ledger (grants, earns, applications, pauses) · reminder_schedule (per-user ladder state; completion-aware cancellation) · saved_item · highlight ✧ · note ✧ · plan / journey ✧ · plan_progress ✧ · friendship ✧ (mutual, teen-peer constraint enforced at write) · accountability_partnership ✧ (consent flags per permission) · encouragement_note ✧ (retained, screened, auditable) · verse_challenge ✧ · event · registration · payment · ticket · checkin · notification · device_push_subscription · milestone / certificate ✧ · report ✧ · moderation_action ✧ · audit_log`

Notes: `spiritual_action` is append-only and powers Progress + analytics (`14-analytics.md`); the devotional's `memory_verse` is dereferenced by every Verse-of-the-Day surface (Today card, widgets, notifications, share cards, challenge theme) — no table or service may define a second daily verse; Bible text for public-domain translations is loaded via an ingestion pipeline with verse-level addressing (`08-bible-experience.md`); notes/highlights sync offline-first with last-write-wins (notes conflict-copy, never destroy); `friendship` and `accountability_partnership` writes enforce role checks server-side (adult–teen friendship is rejected at the data layer, not just the UI — `13-community.md`); `encouragement_note` delivery is gated on the safety-screening pipeline.

## Storage, media & CDN

- Object storage (S3-compatible) for images, audio, video, PDFs, certificates; CDN in front with long-cache immutable URLs.
- Upload pipeline generates data-light variants automatically: responsive image sizes (WebP/AVIF), audio at modest bitrates (Opus where supported), video via HLS with a low-bitrate rung — **Nigerian data cost is a first-order constraint**, not an optimization (`03-user-personas.md`).

## Caching strategy

- **Redis:** hot content (today's devotional per region resolves once, serves thousands), session/rate-limit state, queues.
- **HTTP/CDN:** immutable asset caching; short-TTL + ETag on content APIs.
- **Client (service worker):** the offline layer below.

## Offline strategy (PWA)

Cache tiers (implements `06-user-flows.md` flow 21):

1. **App shell** — precached, versioned, instant cold start.
2. **Daily content** — today's + yesterday's devotionals (memory verse / Verse of the Day included) and today's Scripture chapter, cached on session and via background refresh where supported.
3. **Bible core** — default translation (WEB) as a structured, compressed local dataset (IndexedDB) with a local search index; downloaded once with resume support (`08-bible-experience.md` §9).
4. **User-critical** — My Tickets QR payloads (signed, verifiable offline), current manual (teachers), reading position.
5. **Outbox** — queued mutations (`spiritual_action`s, saves, check-ins, analytics events) with background sync and idempotent server handling; user-visible sync state (`09-design-principles.md` feedback).

## PWA strategy & future mobile

- V1 ships as an installable PWA: one codebase, instant updates, no store friction, WhatsApp-link installs (`03-user-personas.md`, Tolu's install path). Web Push for notifications (Android/Chrome coverage is strong for this audience; iOS PWA push is supported on modern iOS — verified in release QA).
- Known PWA ceilings (storage eviction pressure, iOS quirks, media download UX) are monitored; when they become the binding constraint on the roadmap (not before), V3 native apps (Android first) reuse the API and design system wholesale (`02-roadmap.md`).

## Notifications infrastructure

Web Push (VAPID/FCM) + in-app inbox as the mirror of record + SMS/email for transactional fallback (tickets, OTP, payment receipts). A central notification service owns the **habit reminder ladder**: per-user `reminder_schedule` state, rung scheduling within preset + quiet-hours constraints, **completion-aware cancellation** (a `devotional_completed` action cancels the day's remaining rungs within seconds, including queued sends — an event-driven cancel path, not a polling job), 7-day-ignore auto step-down, and (V2) the learned-timing model. The service also enforces announcement batching and consent gating for partner nudges ✧ (`07-feature-specifications.md` #10, `13-community.md`) — no feature may send around it.

## Payments

Paystack integration: initialize → redirect/inline → **webhook as source of truth** (signature-verified, idempotent processing); reconciliation view compares provider records to registrations (`03-user-personas.md`, Chinedu). Shareable payment links for parent payment. No card data ever touches our servers (PCI scope stays SAQ-A).

## Performance budgets (binding)

- First load ≤ 300KB critical path (gzipped) on the teen surface; route-level code splitting; zero heavyweight third-party SDKs.
- Repeat visit to Today: interactive <1s on a mid-range Android over 3G (cached-first render — `09-design-principles.md`).
- API p95 < 300ms for read endpoints; devotional publish→visible < 60s.
- Images per screen ≤ 200KB total on mobile defaults; data-saver mode reduces further.

## Security & compliance (with `16-release-checklist.md`)

TLS everywhere · OWASP-aligned controls (injection-safe ORM use, CSRF on cookie sessions, strict CSP, dependency scanning) · secrets in a managed store · least-privilege infra access · encrypted backups with restore drills · NDPR data-protection measures per `13-community.md` · audit logging of privileged actions · penetration test before launch.

## Scalability posture

Region 63 scale (thousands to low tens of thousands of users) is comfortably a single well-indexed Postgres + Redis + CDN problem. The national future (hundreds of thousands) is handled by: read replicas, the append-only `spiritual_action` stream partitioned by month, CDN-heavy content delivery, queue-based fan-out for notifications, and the modular monolith's extraction seams. We deliberately do not pre-build for scale we don't have; we do refuse to build anything that *prevents* it (the tenancy and API-first invariants).

## Engineering practices

ADRs for consequential decisions · CI with tests + lint + accessibility checks · staging environment with seeded multi-region data (tests must run against ≥2 fake regions to keep tenancy honest) · feature flags (community ✧ gates, region-level enablement) · error tracking + uptime monitoring + performance monitoring wired before launch (`16-release-checklist.md`).
