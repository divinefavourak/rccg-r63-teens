# 04 — RBAC bootstrap

Roles and permissions are seeded by migration; **role assignments are not**.
Getting from "roles exist" to "the right people hold them" is this runbook.

The production audit found the gap this closes exactly: 20 permissions and 8 roles
seeded, and **zero role assignments**. Every console surface was shut to every
non-superuser. The system looked configured and did nothing.

---

## The three layers

1. **Permissions** — capabilities (`content.publish`, `events.manage`). Defined in
   `backend/identity/permissions_registry.py`. Seeded by `identity/0003` and
   reconciled by `seed_rbac`.
2. **Roles** — named bundles of permissions (`regional_coordinator`, `teacher`).
   Same source, same commands.
3. **Role assignments** — *this user holds this role at this node*. This is the
   layer that must be bootstrapped by hand or derived from legacy data.

Authority is always evaluated over a **subtree**: a `regional_coordinator` at
Region 63 can act anywhere under Region 63, and nowhere else.

---

## Keeping roles and permissions current

```
python manage.py seed_rbac
```

Idempotent, and it must run **on every deploy**. The registry lives in code, so
when a release adds a permission (as `identity/0004` added `bible.manage`), the
deployed database is one permission behind until `seed_rbac` reconciles it. This is
exactly why production was found missing `bible.manage`. `verify_deployment` flags
this drift as an RBAC failure.

`seed_rbac` prunes extra grants from **system** roles (the code is authoritative
for them) but leaves custom roles and their grants untouched.

---

## Assigning roles

### From legacy user data (the production path)

```
python manage.py derive_hierarchy
```

Maps each user's legacy `User.role` string onto a real assignment, scoped to the
deepest node their data resolves to:

| Legacy `role` | Seeded role | Required level |
|---|---|---|
| `admin` | `regional_coordinator` | region |
| `coordinator` | `province_coordinator` | province |
| `teacher` | `teacher` | parish |
| `teen` | *(membership only — no authority)* | — |

**Fail-closed:** a coordinator whose record never carried a province cannot be
resolved to a province node, so it is **skipped and reported**, never guessed.
Read the command's `unresolved:` output — those people need a manual grant below.

### By hand (the escape hatch)

```
python manage.py grant_role <username-or-email> <role-code> "<node name>"
python manage.py grant_role --list      # show available roles and the tree
python manage.py grant_role tolu teacher "Parish A" --dry-run
```

Use this for:

- the users `derive_hierarchy` could not resolve,
- anyone appointed after the migration,
- the first real coordinator on a fresh install (the superuser grants it).

**Escalation is not enforced by this command** — deliberately. It is run from a
deploy shell by someone who already has the database; checking their authority
against a role they could simply `INSERT` would be theatre. The **API** path
(`assign_role` via the console) *does* enforce escalation, and every non-bootstrap
grant should go through the console so it is audit-logged and escalation-checked.

---

## Verification

```
python manage.py verify_deployment    # "role assignments exist"
```

This is a WARN (not just a presence check) if nobody other than a superuser holds
`content.publish`, `events.manage`, or `roles.assign` — because a region that
cannot publish a devotional or manage an event cannot actually run on the platform,
regardless of how many assignments exist.

## Checklist

- [ ] `seed_rbac` run; `verify_deployment` shows `RBAC seeded: OK`.
- [ ] At least one non-superuser holds `regional_coordinator` (or the relevant
      publish/manage capabilities).
- [ ] Every `unresolved:` user from `derive_hierarchy` has been granted a role or
      deliberately left as a plain member.
