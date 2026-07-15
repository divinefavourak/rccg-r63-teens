# 01 — First production deployment

**Situation this runbook addresses (real, as of 2026-07-14):** production is
running a backend several phases old. It has 34 real users, 2 real events (one with
443 registrations), and a devotional history — but the Bible, Progress, and
Notifications tables do not exist, the hierarchy tree is empty, and no user holds a
role assignment. This is not a fresh install (see [02](02-fresh-installation.md)
for that); it is an **upgrade of a live database with real data in it**.

Read this once before running anything.

---

## Before you start

- [ ] You have a **verified database backup** taken minutes ago (see
      [08 — Rollback](08-rollback.md) §Backup). This is the non-negotiable step.
      443 people's camp registrations are in this database.
- [ ] You know the deployed git SHA and can redeploy the previous one.
- [ ] `DATABASE_URL` points at production and you have confirmed it (`python
      manage.py dbshell` → `\conninfo`).
- [ ] Production secrets are set (see [07](07-production-secrets.md)).

## What will change, and what will not

The migrations that are about to run are **additive**: new apps (`bible`,
`progress`, `notifications`), new columns on existing models. The one migration
that touches existing rows is `events/0007`, which copies `target_provinces` into
`scope_node`. The audit confirmed **both production events have empty
`target_provinces`, so that migration is a no-op on this database** — no event's
audience changes. (Re-confirm with the dry run in step 3.)

No existing user, event, registration, or devotional is deleted or rewritten.

---

## Procedure

### 1. Snapshot

```
# Take and verify a backup FIRST. See 08-rollback.md.
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M).sql
```

### 2. Deploy the code, then check readiness *before* migrating

```
python manage.py verify_deployment
```

Expected: a wall of failures, most saying "run migrate". That is correct — the
code is ahead of the schema. You are looking for anything *unexpected* (a settings
failure, a database it cannot reach).

### 3. Preview the one data migration

```
python manage.py migrate events 0007 --plan
# and confirm the no-op, read-only:
python manage.py shell -c "from events.models import Event; \
print('events with province targeting:', Event.objects.exclude(target_provinces=[]).count())"
```

Expect `0`. If it is not zero, **stop** and read `events/migrations/0007`'s
docstring — some events would widen to region visibility, and that is a product
decision, not an ops one.

### 4. Apply migrations

```
python manage.py migrate
```

This creates the Bible/Progress/Notifications schema and adds the review-gate and
scope columns. Additive; safe.

### 5. Bootstrap RBAC and the hierarchy

```
python manage.py bootstrap_production --dry-run   # preview the tree it will build
python manage.py bootstrap_production
```

`bootstrap_production` runs `seed_rbac` (adds the `bible.manage` permission the
deployed DB is missing), then `derive_hierarchy` (builds Region 63's tree from the
34 users' province/parish fields, places each user, and maps the 1 admin + 7
coordinators to role assignments), then `verify_deployment`.

**`derive_hierarchy` is fail-closed:** the 23 users with no province land in an
"Unassigned" bucket, and any coordinator whose data does not reach province level
is reported as unresolved rather than mis-assigned. Read that output — those people
need a manual `grant_role` (see [04](04-rbac-bootstrap.md)).

### 6. Install the Bible text

The schema now exists but has no text. See [03 — Bible import](03-bible-import.md).

```
python manage.py import_bible web.json     # the V1 default translation
```

### 7. Configure push (optional for launch, required for the habit loop)

Until this is done, notifications reach the in-app inbox but never a phone. See
[06 — Push notifications](06-push-notifications.md).

### 8. Final verification

```
python manage.py verify_deployment --strict
```

Drive it to green, or to a state where every remaining warning is a deliberate,
documented decision (e.g. "push is intentionally deferred to week 2").

---

## Definition of done

- [ ] `verify_deployment` exits 0 (or every warning is a signed-off deferral).
- [ ] You can log in as the admin and see the console.
- [ ] A test teen account sees today's devotional and can open the Bible reader.
- [ ] The 443 December Campout registrations are still present
      (`Event.objects.get(title__startswith='December').registrations.count()`).

## If it goes wrong

Go to [08 — Rollback](08-rollback.md). Because the schema changes are additive,
the fastest recovery is usually to redeploy the previous code SHA (the old code
ignores the new tables) rather than to restore the backup — but the backup is
there if a data migration is implicated.
