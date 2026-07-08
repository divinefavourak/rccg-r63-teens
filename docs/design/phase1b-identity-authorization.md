# Phase 1B Design — Identity, Membership & Authorization

_Status: **Draft for approval** (no implementation until the 3 decisions below are made) · 2026-07-08_
_Builds on Phase 1A (`hierarchy` app). Refs: docs/07 #1–#3, docs/15 (RBAC), docs/03 personas._

## 0. The core problem: reconciling 1B with 1A

Phase 1A already merged:
- `hierarchy.HierarchyNode` — the org tree ✅ (keep as-is)
- `hierarchy.Membership` — a user's single home node (`OneToOne`, no role)
- `hierarchy.RoleAssignment` — (user, role, node) authority
- capability logic + `HasCapability` inside the `hierarchy` app

Phase 1B asks for a **Membership that carries a role + lifecycle (start/end/active/created_by/transfer) and allows multiple per user**, plus a proper role/permission/authorization layer, plus User↔Profile separation.

1A's `Membership` and `RoleAssignment` are **the same concept 1B wants, split in two** — and, importantly, **neither is wired into any view yet**, so we can reshape them now at near-zero risk. This design does that.

## 1. Target architecture

Introduce a dedicated **`identity` app** (docs "accounts/" in the app architecture). The `hierarchy` app goes back to being *only* the org tree; everything about *who a user is and what they may do* lives in `identity`. This is the clean "identity & authz layer that sits on top of the hierarchy."

```
hierarchy/   -> HierarchyNode + tree services ONLY  (Membership, RoleAssignment, permissions.py MOVE OUT)
identity/    -> Profile, Membership (with role+lifecycle), Role/Permission registry,
                authorization service, DRF permissions, API
users/       -> User = identity credentials only (+ is_verified)
```

### 1.1 `Membership` (replaces 1A `Membership` + `RoleAssignment`)
`user · node · role · start_date · end_date(null) · is_active · is_primary · created_by · created_at`
- A user may hold **several** active memberships (e.g. Teacher @ Parish A *and* Coordinator @ Area).
- `is_primary` marks the "home node" (the belonging that 1A's OneToOne encoded) — typically the Teen membership.
- `end_date` + an append-only `MembershipTransfer` (from_node, to_node, at, by) give transfer history without mutating the audit trail.
- Validation (docs 1B): no duplicate active (user, node, role); role must be valid at the node's level (see §1.2); can't assign to an inactive node.

### 1.2 Roles & permissions — **centralized code registry** (recommended)
A single `identity/authorization.py` defines:
- `Role` (enum): `super_admin, national_coordinator, regional_coordinator, province_coordinator, parish_leader, teacher, teen, parent`
- Each role declares the **node level it is valid at** (regional_coordinator → `region`, parish_leader → `parish`, teen → `parish`), enabling the "invalid organization assignment / role conflict" validation 1B asks for.
- `Permission` verbs: `view, create, update, delete, approve, publish, manage` (per resource domain).
- `ROLE_PERMISSIONS: {role: {permission verbs}}` — role-driven, not booleans, expandable by editing one table-of-truth.
Evaluated **within the node subtree** (reusing 1A's materialized-path scoping).

_Not_ DB-backed Role/Permission tables — that's editable-RBAC complexity the docs don't call for and 1B warns against ("no unnecessary complexity"). Alternative in §4.

### 1.3 Authorization service (centralized)
`identity/authorization.py`: `has_permission(user, permission, node)`, `has_any_permission(user, permission)`, `scoped_queryset(qs, user, permission, node_field)`, `visible_nodes(user, permission)` — the single home for all authz logic (ports 1A's `services` capability functions, now permission-verb based). Views call these; **no authz logic in views**.

### 1.4 `Profile` (identity app) vs the existing `TeenProfile`
- New `Profile`: `display_name, first_name?, last_name?, photo, gender, birthday, bio, timezone, preferences(JSON)` — one per user, general identity/presentation.
- `TeenProfile` (existing) keeps only **teen/event-specific** data (guardian, medical, emergency). Its **church-hierarchy fields move to Membership**; its engagement stats (streak counts) belong to Phase 2 Progress, not here.
- **User stays identity-only:** `email, username, phone, password, is_active, is_verified (NEW), date_joined, last_login`.

## 2. Auth audit — findings & what this phase touches

| Finding | Recommendation | This phase? |
|---|---|---|
| Tokens in JSON body, not HTTP-only cookies (docs/15) | Move to Secure HttpOnly cookies | Recommend; **defer** to keep scope on identity (flag) |
| No email verification (`is_verified`), login ungated | Add `is_verified` + verify endpoint + gate login | **Yes** (identity-core) |
| Username-based login; docs want phone/email + OTP | Allow email-or-phone login now; OTP later | Partial: email/phone login **yes**, OTP defer |
| Throttle scopes unused on `login`/`forgot-password` | Attach `throttle_scope='auth'/'otp'` | **Yes** (small, security) |
| Flat `role=='admin'` perms, client-supplied province (IDOR) | Replace with authorization service + node scope | **Yes** (the point of 1B) |
| `user.save()` full-row on every login | `update_fields=[...]` | **Yes** (trivial) |

## 3. Migration strategy — expand & contract (no data loss)

1. **Introduce** `identity` app: `Profile`, `Membership`, `MembershipTransfer`; `User.is_verified`. Data-migrate 1A `hierarchy.RoleAssignment` + `Membership` rows into `identity.Membership`; backfill `Profile` from User/TeenProfile identity fields; keep legacy fields in place.
2. **Cut over** authorization service + API + admin to `identity.Membership`; dual-read hierarchy fields.
3. **Contract** (later phase): drop `hierarchy.RoleAssignment`, the old `Membership`, and the hierarchy/profile fields on `User`/`TeenProfile`.

`derive_hierarchy` (1A) is updated to write `identity.Membership` instead of the two 1A models.

## 4. Decisions (made 2026-07-08)

**A. Membership and RoleAssignment stay SEPARATE (DDD: identity vs authority).**
- `Membership` = belonging: `user · organization_node · is_primary · joined_at · is_active`. No role.
- `RoleAssignment` = authority: `user · role(FK) · node · start_date · end_date · is_active · appointed_by`.
- One primary Membership (home node) + 0..n RoleAssignments across levels per user.

**B. DB-backed RBAC with code-defined permission identifiers.**
- Models: `Permission(code, label)`, `Role(code, label, allowed_node_types)`, `RolePermission(role, permission)`, `RoleAssignment(user, role, node, lifecycle)`.
- `Permission.code` values come from a code registry (`identity/permissions_registry.py`) — validated, no arbitrary strings; Role↔Permission links are admin-editable (reconfigure without a deploy).
- `Role.allowed_node_types` validates assignments (regional_coordinator only at a `region` node, etc.). Seeded idempotently via `manage.py seed_rbac`.

**C. Pragmatic User/Profile split.** User keeps `email/username/phone/password/first_name/last_name/is_active/is_verified(NEW)/timestamps`; new `identity.Profile` holds `photo/gender/birthday/bio/timezone/preferences`; church-hierarchy fields move to Membership (expand-contract).

**App layering (consequence of A+B):** `Membership` + `RoleAssignment` move from `hierarchy` into `identity`, so `identity → hierarchy` is the only dependency direction. `hierarchy` becomes org-structure only (HierarchyNode + tree services + node-scoping helpers stay).

## 5. Out of scope (per 1B): Bible, Devotionals, Friends, Notifications, Events, Library, Prayer. Cookie-auth and OTP are *recommended* but deferred so this phase stays on identity/authz.
