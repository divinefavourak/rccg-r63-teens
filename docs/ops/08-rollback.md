# 08 — Rollback

When a deployment goes wrong. Read this *before* you deploy, not during the
incident.

---

## Backup (do this first, every time)

```
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M).sql
# Verify it is non-empty and restorable — an unverified backup is not a backup:
ls -lh backup-*.sql
head -5 backup-*.sql          # should be a real pg_dump header
```

For the first production deployment specifically: the database holds 34 real users
and 443 camp registrations. The backup is the thing that lets those survive a bad
migration.

---

## Choosing a rollback strategy

The right move depends on **what** went wrong. Diagnose before you act.

### Case 1 — code is bad, schema is fine (most common)

The new code has a bug, but the migrations applied cleanly and the data is intact.

**Redeploy the previous git SHA.** Do **not** roll migrations back. The migrations
in this release are additive (new apps, new nullable columns) — old code simply
ignores the new tables and columns, so a code-only rollback is clean and fast.

```
# Redeploy previous SHA via your platform. No database action needed.
python manage.py verify_deployment    # confirm the old code is happy
```

This is the fastest, safest recovery and it loses no data.

### Case 2 — a data migration did the wrong thing

The schema/data migration ran but produced wrong results (e.g. `events/0007`
widened event visibility unexpectedly — though the audit confirmed it is a no-op on
current production).

Migrations with a `backwards()` can be reversed:

```
python manage.py migrate events 0006      # reverse 0008 and 0007
```

`events/0007.backwards()` restores single-province events; it **cannot** perfectly
reconstruct a multi-province event that was widened to region (a single node cannot
re-become a list). If multi-province events were affected, **restore from backup**
instead — that is the only lossless path, and it is why the migration prints every
widened event by name.

### Case 3 — the database is corrupt or a migration failed partway

**Restore from backup.**

```
# New empty database, then:
psql "$DATABASE_URL_NEW" < backup-YYYYMMDD-HHMM.sql
# Point DATABASE_URL at it, redeploy the previous code SHA.
python manage.py verify_deployment
```

---

## What is reversible, and what is not

| Change in this release | Reversible? | How |
|---|---|---|
| New app tables (bible, progress, notifications) | Yes | `migrate <app> zero`, or ignore — old code doesn't touch them |
| New columns (review fields, `scope_node`, search vector) | Yes | Reverse the migration; columns are nullable |
| `events/0007` province → node data copy | **Partially** | `backwards()` restores single-province; multi-province needs backup |
| `events/0008` dropping `target_provinces` | Yes structurally | Column re-added by reversing; **data in it is gone** (but it was empty in production) |
| `seed_rbac` / `derive_hierarchy` writes | Yes | Additive and idempotent; harmless to leave, or delete the rows |
| Bible import | Yes | Delete the translation; teen annotations cascade — do not do this lightly |

The only genuinely lossy step is dropping `target_provinces` (`events/0008`), and
on current production that column is empty on every event — so there is nothing to
lose. On any other database, confirm it is empty (or backed up) before merging that
migration.

---

## After any rollback

```
python manage.py verify_deployment
```

Then confirm the specific thing that broke is gone, and that the load-bearing data
survived:

```
python manage.py shell -c "from events.models import Event; \
print(Event.objects.get(title__startswith='December').registrations.count())"   # expect 443
```

## Post-incident

- Record what broke, which case applied, and how long recovery took.
- If a migration was implicated, add a test that reproduces the failure before
  re-attempting the deploy.
- Re-verify the backup procedure actually produced a restorable file — the time to
  discover a bad backup is a drill, not an incident.
