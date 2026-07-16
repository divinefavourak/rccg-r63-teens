# 08 — Rollback

When a deployment goes wrong. Read this *before* you deploy, not during the
incident.

---

## Backup (do this first, every time)

The backup contains real user data — treat it like the production dump in
[09](09-migration-rehearsal.md): outside the repo, restrictive permissions, password
never on a command line.

```bash
umask 077                                        # anything created below is 0600
BACKUP=~/faithtribe-backup-$(date +%Y%m%d-%H%M).sql

# Read the URL from .env; hand it to the container via a trap-cleaned env-file so the
# password is in no argv (see 09 for the reasoning).
SRC=$(./venv/Scripts/python.exe -c "import os; from dotenv import load_dotenv; load_dotenv('.env', override=True); print(os.environ['DATABASE_URL'])")
ENVFILE=$(mktemp); chmod 600 "$ENVFILE"
trap 'rm -f -- "$ENVFILE"' EXIT HUP INT TERM
printf 'PGURL=%s\n' "$SRC" > "$ENVFILE"
docker run --rm --env-file "$ENVFILE" postgres:16-alpine \
  sh -c 'pg_dump --no-owner --no-privileges "$PGURL"' > "$BACKUP"
```

**Then restore-test it — a backup you have not restored is a hope, not a backup.**
`ls`/`head` only prove the file exists, not that it round-trips. Restore into a
scratch database and check the row counts:

```bash
docker compose -f docker-compose.test.yml up -d      # a scratch Postgres
docker exec -i faithtribe-test-db psql -U faithtribe -d postgres \
  -c "DROP DATABASE IF EXISTS backup_check;" -c "CREATE DATABASE backup_check;"
docker exec -i faithtribe-test-db psql -U faithtribe -d backup_check < "$BACKUP"
docker exec faithtribe-test-db psql -U faithtribe -d backup_check -tc \
  "SELECT 'users=' || count(*) FROM users_user UNION ALL
   SELECT 'registrations=' || count(*) FROM events_eventregistration;"
# Plausible, non-zero counts = the backup is real and restorable. Then:
docker exec -i faithtribe-test-db psql -U faithtribe -d postgres \
  -c "DROP DATABASE backup_check;"
```

The backup is what lets real users and registrations survive a bad migration — so it
is worth the two extra minutes to know it actually works before you need it.

---

## Before you reverse a migration or restore a backup: quiesce the app

Any rollback that changes the schema or replaces the data (Case 2 and Case 3 below)
must happen against a **still** database. If the web app is serving traffic or Celery
is running while you reverse a migration or restore, writes land mid-operation and
requests hit a schema that no longer matches the running code — you can finish the
rollback in a *worse* state than the bug you started with.

```bash
# 1. Put the web app in maintenance mode — scale web dynos/pods to 0, or serve a
#    maintenance page. (Platform-specific; do it however you take web offline.)

# 2. Stop Celery — the habit ladder, event reminders and the gap-alert all write to
#    the DB on a schedule. Stop BOTH the worker and beat.
#    (Stop the processes/containers running `celery -A backend worker` and `... beat`.)

# 3. Confirm nothing is still connected before you touch the schema:
DATABASE_URL=... ./venv/Scripts/python.exe manage.py dbshell -- -tc \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"
#    Expect a small number (just your own tooling). If app connections remain, they
#    are still writing — stop them before continuing.
```

Bring web and Celery back up **after** the rollback and `verify_deployment` are clean.
Case 1 (code-only rollback) does not need this — the schema and data are untouched.

## Capture a baseline before you touch anything

A rollback's success check is "did the data survive?", and that can only be answered
against the counts that were there *before* — a hard-coded number goes stale the
moment a new teen registers.

```bash
DATABASE_URL=... ./venv/Scripts/python.exe manage.py shell -c \
  "from django.contrib.auth import get_user_model; from events.models import EventRegistration; \
   print('BASELINE users=%d registrations=%d' % (get_user_model().objects.count(), EventRegistration.objects.count()))"
# Write these two numbers down. They are your post-rollback oracle.
```

## Choosing a rollback strategy

The right move depends on **what** went wrong. Diagnose before you act.

### Case 1 — code is bad, schema is fine (most common)

The new code has a bug, but the migrations applied cleanly and the data is intact.

**Redeploy the previous git SHA.** Do **not** roll migrations back. The migrations
in this release are additive (new apps, new nullable columns) — old code simply
ignores the new tables and columns, so a code-only rollback is clean and fast.

```bash
# Redeploy previous SHA via your platform. No database action needed.
python manage.py verify_deployment    # confirm the old code is happy
```

This is the fastest, safest recovery and it loses no data.

### Case 2 — a data migration did the wrong thing

The schema/data migration ran but produced wrong results (e.g. `events/0007`
widened event visibility unexpectedly — though the audit confirmed it is a no-op on
current production).

Migrations with a `backwards()` can be reversed:

```bash
python manage.py migrate events 0006      # reverse 0008 and 0007
```

`events/0007.backwards()` restores single-province events; it **cannot** perfectly
reconstruct a multi-province event that was widened to region (a single node cannot
re-become a list). If multi-province events were affected, **restore from backup**
instead — that is the only lossless path, and it is why the migration prints every
widened event by name.

### Case 3 — the database is corrupt or a migration failed partway

**Restore from backup.**

```bash
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

```bash
python manage.py verify_deployment
```

Then confirm the specific thing that broke is gone, and that the load-bearing data
survived — compared against the **baseline you captured before the rollback**, not a
hard-coded number:

```bash
DATABASE_URL=... ./venv/Scripts/python.exe manage.py shell -c \
  "from django.contrib.auth import get_user_model; from events.models import EventRegistration; \
   print('AFTER users=%d registrations=%d' % (get_user_model().objects.count(), EventRegistration.objects.count()))"
# These must match the BASELINE you recorded above. A restore from a slightly older
# backup may legitimately show FEWER registrations than the live baseline (anything
# that registered after the backup was taken) — decide whether that gap is acceptable
# or whether those registrations must be re-captured.
```

## Post-incident

- Record what broke, which case applied, and how long recovery took.
- If a migration was implicated, add a test that reproduces the failure before
  re-attempting the deploy.
- Re-verify the backup procedure actually produced a restorable file — the time to
  discover a bad backup is a drill, not an incident.
