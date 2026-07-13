# Backend Audit Report — Faith Tribe

_Audit date: 2026-07-07 · Auditor: Lead Backend Architect · Basis: full read of `/docs` (01–16 + CHANGELOG) vs. current `backend/` implementation._

## 1. Executive summary

The backend is a **well-engineered Camp/Event registration system** that has had discipleship features (devotionals, manuals, articles, a partial gamification layer) grafted on. Code quality is good — abstract mixins, UUID PKs, thread-safe counters, audit logs. The problem is **architectural fit**, not craftsmanship.

The docs describe a multi-region teen discipleship platform whose spine is (a) a real church-hierarchy **tree** and (b) the integrated **Bible**. The backend has neither, and instead hard-codes the very things the docs forbid (Lagos provinces as an enum). Several implemented features are ones the docs explicitly **cut or ban** (coin/level gamification, free-text mood tracking).

## 2. Governing product decision (2026-07-07)

Confirmed with product owner during this audit:

1. **Backend stays flexible** for multiple age groups long-term (keep `age_group` / `target_age_groups`), **but the shipped product, docs, and UX stay teen-focused now.** `/docs` is the source of truth for the teen product.
2. **Remove/park coin-based gamification** (`ChildGameProfile` coins/mascots, `DailyRewardClaim`) in favor of the documented **Recognition** system (milestones + certificates). Docs ban XP/points/levels.
3. **MoodEntry** retained **only if** it serves a spiritual purpose (contextual devotionals, prayer prompts, Scripture recommendations) — not as a generic tracker. Otherwise parked (mood is cut from V1; V2 "Heart Check" is privacy-gated, no free text).

## 3. Capability matrix — docs vs. implementation

| Documented V1 system | Status | Severity |
|---|---|---|
| Church hierarchy as a **node tree**, scoped RBAC | ❌ Flat CharFields + hard-coded Lagos province enum | 🔴 Critical |
| Region as tenant (**no hard-coded region**) | ❌ `Province` enum lists Lagos Provinces 9/28/… | 🔴 Critical |
| RBAC = capabilities within assignment subtree | ⚠️ Flat `role == 'admin'` + string province equality | 🔴 Critical |
| Integrated **Bible** | ✅ Schema + services (Phase 2A); text not yet imported | 🟢 Good |
| **Today** unified daily experience | ⚠️ Devotional + daily service exist; Today assembler still to build | 🟡 Medium |
| Memory verse = single-source Verse of the Day | ✅ `content.MemoryVerse`, one primary enforced; publish gate (Phase 2A) | 🟢 Good |
| **Progress**: `spiritual_action` stream + Grace Days | ❌ Naive counter, no grace, no tz-safety | 🟠 High |
| Auth: HTTP-only cookies, argon2/bcrypt, OTP, rate limiting | ⚠️ JWT Bearer, PBKDF2 default, no throttle, no OTP | 🟠 High |
| Events / tickets / payments / check-in | ✅ Strong, near-complete | 🟢 Good |
| Content pipeline (draft→review→published) | ⚠️ States exist, no two-person review | 🟡 Medium |
| Notifications (habit ladder) | ❌ Absent | 🟡 Medium |
| Library (unified media) | ⚠️ Split across `content` + `media` | 🟡 Medium |

## 4. Findings by severity

### 🔴 Critical
- **C1 — Hierarchy hard-coded.** `common/models.py::Province` enumerates `LAGOS_PROVINCE_9…REGIONAL_HQ`, referenced by `User`, `TeenProfile`, `EventRegistration`. Violates non-negotiable #2/#3 and `15-technical-architecture.md` ("no code path may reference any node by ID or name"). Onboarding another region becomes a code change. Docs prescribe `hierarchy_node` (closure table / materialized path) + `role_assignment(user, role, node)`.
- **C2 — RBAC flat, not scoped.** `common/permissions.py` checks `role == 'admin'` and compares `province` strings; no capability model, no subtree evaluation. `ProvinceAccessPermission` trusts a client-supplied `province` param → IDOR risk. **Partially resolved:** the `content` and `events` view layers now run on the centralized capability system (`HasPermission`/`HasPermissionOrReadOnly` + `has_any_permission` over `Perm.*`); the dead `content/permissions.py` (`role=='admin'`) has been removed. **Still open:** (a) `common/permissions.py::ProvinceAccessPermission` (the IDOR path) and other legacy per-app permission modules; (b) true *subtree* scoping on events — `EventViewSet.get_queryset` gates on the `EVENTS_MANAGE` capability but does not constrain rows to the manager's assignment subtree, because `Event` still carries the legacy `target_provinces` string array rather than a hierarchy-node FK. Real subtree scoping is blocked on Events adopting hierarchy nodes (a Phase 1c/later migration); wiring `scope_queryset` before then would be a no-op. (c) `events/serializers.py` still reads the legacy `User.role` field to stamp a `registration_type` *provenance label* (not an auth gate) — deferred to Phase 1c, which owns removal of `User.role`.
- **C3 — Bible absent.** ~~The documented foundation (translations, verse-addressable text, reading position, `ScriptureRef` parser) has no models.~~ **Resolved in Phase 2A** (`feature/scripture-foundation`): the `bible` app adds `BibleTranslation`/`BibleBook`/`BibleChapter`/`BibleVerse`, the personal layer (bookmarks, highlights, notes, reading history/progress/position), and a `ScriptureReference` resolver. Bible *text* is still unimported by design. See `docs/design/phase2a-scripture-foundation.md`.

### 🟠 High
- **H1 — Auth/security divergence.** `ALLOWED_HOSTS` defaults to `['*']`; no `DEFAULT_THROTTLE_RATES` (fixed in Phase 0); no `PASSWORD_HASHERS` → PBKDF2 not argon2/bcrypt (fixed in Phase 0); JWT via `Bearer` header (docs mandate HTTP-only Secure cookies; a launch-gate item); no OTP/phone auth despite being the primary documented signup path. _(Note: CORS is already DEBUG-aware + env-driven — acceptable.)_
- **H2 — Progress/streak naive.** `TeenProfile.update_streak` is a race-prone counter that resets on any gap; no Grace Days, no `spiritual_action` stream, no tz-safe day boundary. The WED North Star depends on the missing event stream.
- **H3 — Loose cross-app FKs.** `DevotionalProgress.devotional_id`, `ManualProgress.manual_id`, `Favorite.content_id` are bare `UUIDField`s — no referential integrity, no `select_related`. (`content.UserReadLog` already uses a proper FK — standardize on that.)

### 🟡 Medium
- **M1** — Hierarchy fields duplicated across `User` / `TeenProfile` / `EventRegistration` (registration snapshot is legit; User+Profile duplication is drift-prone).
- **M2** — Library fragmented: `Article` in `content`, podcasts/videos in `media`. Docs want one Library model with a `type` field.
- **M3** — `tickets` app marked "Legacy – will be deprecated" yet installed with a 1,274-line `views.py`.
- **M4** — Committed artifacts at backend root (`db.sqlite3`, `dump.rdb`, 12 ad-hoc email `test_*.py`). _(Fixed in Phase 0.)_
- **M5** — Thin test depth for the new domain; content two-person review unimplemented.

## 5. Refactor plan (phased, branch-per-task off `develop`)

- **Phase 0 — Hygiene & guardrails** (`refactor/repo-hygiene`) — remove committed artifacts + gitignore; add bcrypt `PASSWORD_HASHERS`; add DRF throttle rates; ADR for the stack decision. **← in progress**
- **Phase 1 — Hierarchy foundation** (`refactor/church-hierarchy`, keystone) — `HierarchyNode` (materialized path) + `RoleAssignment` + capability RBAC over subtrees; data-migrate province strings into nodes.
- **Phase 2 — Progress engine** (`refactor/progress-system`) — append-only `SpiritualAction` stream + `StreakState`/`GraceDayLedger`, tz-safe.
- **Phase 3 — Bible foundation** (`feature/scripture-foundation`) — ✅ **done.** `bible` app (translations/books/chapters/verses + bookmarks, highlights, notes, reading history/progress/continue-reading), `ScriptureReference` resolver, and the devotional memory verse wired as the single Verse-of-the-Day source. No text imported yet. Design: `docs/design/phase2a-scripture-foundation.md`.
- **Phase 4 — Library consolidation + auth hardening** — unify media; two-person review; JWT→HTTP-only cookies + OTP scaffolding.
- **Later (V1.5/V2 order)** — Notifications ladder, Recognition, Journeys, Community/safeguarding.

## 6. Parked / to-reconcile against philosophy
`ChildGameProfile` (coins/levels/mascot), `DailyRewardClaim`, standalone `Badge`/`Certificate` (→ merge into Recognition), `MoodEntry` (conditional per §2.3).
