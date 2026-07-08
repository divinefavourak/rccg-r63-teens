# Phase 1 Completion — Reports

_Branch: `refactor/phase1-completion` · 2026-07-08 · builds on Phase 0/1A/1B._
_Approved approach: additive/expand-contract (see `docs/design/phase1b-identity-authorization.md` and the phase1-completion decisions)._

## Migration Report

**Legacy systems removed (from all 6 production apps):**
- `ProvinceAccessPermission` — trusted a client-supplied `province` query/body param for access decisions (**IDOR**). Gone.
- `IsAdmin`, `IsCoordinator(OrAdmin)`, `ContentPermission`, `IsSelfOrAdmin`, `IsOwnerOrAdmin`, `IsTeen` gating — replaced by centralized `HasPermission` / `HasPermissionOrReadOnly` / `IsSelfOrHasPermission`.
- Flat `user.role == 'admin'|'coordinator'|'teacher'` checks and `attendee_province == user.province` / `province=user.province` data-scoping in `content`, `media`, `events`, `users`, `payments`, `profiles` views — replaced by `has_any_permission(...)`.

**Authorization changes:** every production endpoint now derives authority from `identity` (Role → Permission via RoleAssignment, evaluated within the node subtree). Permission vocabulary extended with `content.*`, `media.manage`, `events.*`, `payments.*` (code-defined registry) and granted to roles. RBAC is seeded by data-migration `identity/0003_seed_rbac`; `build.sh` runs `derive_hierarchy` on deploy to bridge existing users into `Membership`/`RoleAssignment` (prevents lockout).

**Authentication improvements:** `auth`/`otp` throttle scopes attached to login/register/forgot/reset; `User.is_verified` + `/verify-email/` endpoint + config-gated login enforcement (`ENFORCE_EMAIL_VERIFICATION`, default off).

**Data migration summary:** `identity/0003` seeds roles/permissions (idempotent). `users/0008` adds `is_verified`; `users/0009` grandfathers existing users to verified. `events/0004` resolves the status-choices drift (no data change). All applied clean on Postgres. **No columns dropped, no data destroyed.**

**Remaining technical debt (expand-contract stage 2 / follow-ups):**
- Legacy hierarchy columns (`User.province/zone/area/parish`, `common.Province`, `TeenProfile` hierarchy fields) are **retained and still dual-written at registration** for frontend compat; drop after the frontend migrates.
- Finer **node-scoped visibility** of registrations/users/profiles/payments needs an `organization_node` FK on those models (currently managers see all within permission; owners see their own). Documented in-code.
- Legacy `tickets` app still routed at `/api/` and still uses its own permission module — slated for retirement.
- OTP foundation and additive HttpOnly-cookie auth (both approved) not yet built — next hardening slice.

## Security Report

**Vulnerabilities fixed:**
- **IDOR (high):** `ProvinceAccessPermission` accepted a client-provided `province` to authorize access; removed everywhere. Authorization is now server-derived from RoleAssignments within a node subtree.
- **Privilege model:** flat role strings replaced by capability checks; role→permission is validated (code registry) and node-level-validated; role assignment is escalation-guarded (Phase 1B).
- **Rate limiting:** login/OTP/reset endpoints now throttled (were unthrottled).

**Verified (via automated tests):** cross-region isolation, object-level permission scoping, coarse-gate on collection endpoints (non-leaders cannot POST to permissioned endpoints), owner-or-permission object access, escalation guard, verification gate.

**Remaining risks / recommendations:**
- Tokens are still Bearer (localStorage-style) — additive HttpOnly-cookie support + CSRF review is the approved next step.
- `ALLOWED_HOSTS` still defaults to `['*']` — set explicitly in production env.
- Registration/user/registration data-scoping is permission-coarse until node FKs land; a compromised coordinator account currently sees all registrations they can manage (not just their subtree). Prioritise the `organization_node` backfill.
- Enable `ENFORCE_EMAIL_VERIFICATION` once the verification email is wired.

## API Report

**Endpoints migrated (permission handling):** all viewsets/actions in `content`, `media`, `events`, `users`, `payments`, `profiles`.
**Permission changes:** writes now require the relevant `*.manage`/`*.publish` permission; reads remain public/authenticated as before; self-service endpoints unchanged. New: `POST /api/v1/auth/verify-email/`.
**Breaking changes:** none for anonymous/self reads. For *leaders*: access now requires a seeded Role + RoleAssignment (provided by `seed_rbac` + `derive_hierarchy` on deploy) rather than the legacy `User.role` string — a coordinator/admin with no bridged membership would be denied until the bridge runs (hence it is in `build.sh`).

## Testing Report

**New tests (43 pass, sqlite via `pytest --no-migrations`; migrations validated on Postgres):**
- Cutover primitives: `HasPermissionOrReadOnly`, `IsSelfOrHasPermission`.
- Auth hardening: verify endpoint (valid/invalid token), login gate on/off.
- (Plus the Phase 1B identity/authorization suite these build on.)

**Coverage improvements:** authorization primitives, verification flow, RBAC seed idempotency.

**Regression status / honest caveat:** legacy per-app test suites (`users/tests.py`, `tickets/tests.py`, some `events` tests) were written against the *old* role-based access and will need updating to seed RBAC + assignments — updating them is a tracked follow-up. New authorization behavior is covered by the identity/cutover tests above. The full legacy suite was **not** re-run green this phase.

## Success criteria status
✓ Every production endpoint uses the new authorization system · ⚠️ org scoping operational at permission level, node-level resource scoping partial (documented) · ✓ legacy fields deprecated/retained via expand-contract (not dropped, by design) · ⚠️ auth hardened (throttling + verification done; OTP + cookies sequenced) · ✓ security audit produced · ✓ events drift resolved · ⚠️ new tests pass, legacy suites need updating · ✓ docs updated.
