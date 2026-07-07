# Phase 1 Design — Church Hierarchy + Scoped RBAC

_Status: **Draft for approval** (no code until approved) · 2026-07-07 · Refs: `docs/BACKEND-AUDIT.md`, `07-feature-specifications.md` #2/#3, `15-technical-architecture.md`_

## 1. Goal & non-goals

**Goal:** Replace the hard-coded `common.Province` enum and the free-text `zone/area/parish` CharFields with a real hierarchy **tree** and a **scoped, capability-based RBAC** model — the keystone the docs require ("no code path may reference any node by ID or name").

**Non-goals (this phase):** Bible, Progress, notifications, Console UI. Frontend changes beyond what's needed to keep existing screens working. We do **not** drop the legacy string fields in this phase (expand-and-contract — see §6).

## 2. What exists today (the problem)

- `common/models.py::Province` — enum of Lagos provinces (`LAGOS_PROVINCE_9…REGIONAL_HQ`). Hard-codes the tenant. ❌
- `User.province` (enum), `User.zone/area/parish` (free-text). `TeenProfile` duplicates the same 5 fields + `department`. `EventRegistration` snapshots them.
- `User.role` — flat CharField (`admin/coordinator/teacher/teen/individual`).
- `common/permissions.py` — checks `role == 'admin'`; `ProvinceAccessPermission` compares province strings and trusts a client-supplied `province` param (IDOR risk).

## 3. Target data model

### 3.1 `HierarchyNode` (new app: `hierarchy`)

A tree with typed levels: **National → Region → Province → Zone → Area → Parish** (+ optional `Department` under Parish). Ascending order per docs: Parish → Area → Zone → Province → Region → National.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | consistent with the codebase |
| `node_type` | choices | `national, region, province, zone, area, parish, department` |
| `name` | CharField | e.g. "Region 63", "Lagos Province 9", "RCCG Ikorodu" |
| `slug` | Slug | unique within parent |
| `code` | CharField, optional | external/church code for CSV import matching |
| `parent` | FK self, null for root | tree edge |
| `is_active` | bool | soft-disable |

**Tree implementation — recommended: `django-treebeard` `MP_Node` (materialized path).** The docs sanction "closure table or materialized path." treebeard is mature, gives `get_descendants()`/`get_ancestors()`/`move()` with correct subtree re-pathing — which we need for the docs' "moving a parish between areas re-scopes its members automatically." Rolling our own path maintenance is the kind of clever code the charter tells us to avoid. _(Adds one dependency; alternative options in §8.)_

**Invariant:** `node_type` must be exactly one level below its parent's type (Parish's parent is an Area, etc.). Enforced in `clean()` + a `save()` guard.

### 3.2 `RoleAssignment` (new)

The docs' `role_assignment(user, role, node)`.

| Field | Type | Notes |
|---|---|---|
| `user` | FK User | |
| `role` | choices | `teacher, coordinator, admin` (leadership roles; `teen`/`super_teen` stay on the profile — see §5) |
| `node` | FK HierarchyNode | the scope: "Coordinator of Area X" |
| `assigned_by` | FK User, null | audit |
| `assigned_at` | datetime | audit |
| `is_active` | bool | |

`unique_together = (user, role, node)`.

### 3.3 Membership pointer

Add nullable `home_node = FK(HierarchyNode)` to `User` (and mirror to `TeenProfile` only if needed; preference is **single source on User**, `TeenProfile` reads through). A teen "belongs to exactly one parish (or a region-level unassigned bucket)."

## 4. Capabilities & permission evaluation

Capabilities (from `15-technical-architecture.md`): `content.publish`, `event.manage`, `event.checkin`, `analytics.view`, `roles.assign`, `moderation.act` (✧V2).

```
ROLE_CAPABILITIES = {
    'admin':       {all capabilities},
    'coordinator': {event.manage, event.checkin, analytics.view, content.publish(scoped)},
    'teacher':     {event.checkin, analytics.view(own class)},
}
```

**Evaluation rule:** `user_has_capability(user, cap, target_node)` is true iff the user has an active `RoleAssignment` whose `role` grants `cap` **and** whose `node` is an **ancestor-or-self** of `target_node`. Ancestor check is a cheap materialized-path prefix comparison.

**DRF surface:** a `HasCapability(cap)` permission factory + a queryset mixin `scoped_to_user(qs, user)` that filters `visibility_node` to the subtree(s) the user can see. Server-side is the source of truth; client gating is UX only.

**Scoped visibility:** every scoped entity gains `visibility_node = FK(HierarchyNode)`. Users see entities whose node is ancestor-or-self of their `home_node` (plus explicitly targeted nodes). Retrofitting `visibility_node` onto content/events is staged (§6) — not all in this PR.

## 5. Roles: leadership vs. identity

- **Leadership roles** (teacher/coordinator/admin) → `RoleAssignment` rows (scoped). A user can hold several (e.g. Coordinator of Area X *and* Teacher of Parish Y).
- **Teen / Super Teen** → these are *identity/level*, not scoped capabilities. Keep on the profile (`age_group`, a `is_super_teen`/tag). Docs: "Super Teen adds capability" but its V1 surface is a profile tag + share tooling, not scoped authority.
- **Transition:** `User.role` is kept during this phase as a **denormalized convenience mirror** of the highest leadership assignment (or `teen`), so existing code/serializers keep working. Dropped in the contract phase.

## 6. Migration strategy — expand & contract (parallel change)

Three PRs, each independently deployable and reversible:

**Phase 1a — Introduce (this design's core PR)**
1. Add `hierarchy` app: `HierarchyNode`, `RoleAssignment` (schema migration).
2. Add nullable `User.home_node`.
3. **Data migration (backfill):**
   - Create `National` root → `Region 63` node (as *data*, not code — permitted).
   - For each distinct `province` value in use → `Province` node under Region; each distinct `(province, zone)` → Zone; `(…, area)` → Area; `(…, parish)` → Parish. Normalize (trim/casing) and dedupe.
   - Point each `User.home_node` at the matched Parish node; unmatched/blank → a `Region 63 / Unassigned` bucket node. Emit a **report of unmatched rows** for admin cleanup.
   - Convert `User.role` into `RoleAssignment` rows: `admin` → Region 63 node; `coordinator` → their Province node; `teacher` → their Parish node.
4. New permission classes added **alongside** the old ones (no behavior change yet).

**Phase 1b — Cut over**
- Repoint permission classes and querysets to node-based checks; dual-read (`home_node` first, string fallback). Replace `ProvinceAccessPermission` usages. Add `visibility_node` to content/events with backfill.

**Phase 1c — Contract**
- Drop `common.Province`, the `zone/area/parish` string fields on `User`/`TeenProfile`, and the denormalized `User.role` (or keep `role` as a pure mirror if the frontend still reads it — decided at 1c).
- `EventRegistration` **keeps** its string snapshot fields (they are historical attendee records), optionally gaining a nullable `node` FK.

## 7. Testing (per charter + release checklist)

- Model tests: tree invariants (wrong parent type rejected), ancestor/descendant correctness, node move re-scopes members.
- Permission tests: **the docs' "attempt matrix"** — every role × out-of-scope resource returns 403; run against **≥2 seeded fake regions** (tenancy honesty, per `16-release-checklist.md`).
- Migration test: backfill on a copy of prod-shaped data; assert zero user loses a home_node (bucket fallback), unmatched report is produced.
- Regression: existing event/registration/content endpoints still pass.

## 8. Open decisions (need your call — see the questions posted with this doc)

1. **Tree library:** `django-treebeard` (recommended) vs. hand-rolled materialized path vs. closure table.
2. **Backfill source:** auto-derive the tree from existing messy free-text (fast, needs cleanup after) vs. admin defines the canonical tree first via CSV import, then map users (cleaner, slower, needs the CSV).
3. **Migration cadence:** the 3-PR expand/contract above (recommended) vs. a single larger PR.

## 9. Risks

- **Dirty source data:** free-text `zone/area/parish` almost certainly has typos/casing/duplicates → the Unassigned bucket + unmatched report are the safety net; no user is ever dropped.
- **Dependency add** (treebeard) — small, mature, MIT.
- **Frontend coupling:** the frontend currently sends/reads `province` strings (see `formFields.tsx`). 1a/1b keep those working via the denormalized mirror; frontend migration is a separate, later task.
