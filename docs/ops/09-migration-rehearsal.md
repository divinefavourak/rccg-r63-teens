# 09 — Migration rehearsal

Before the 18 migrations touch the live database, run them against a **throwaway
copy of it** on your own machine. This is the cheapest possible way to discover that
a migration breaks on real data — and the only way to discover it *before* it
breaks on the 443 people's registrations rather than after.

The whole thing is disposable: a local Postgres in a container, loaded from a dump,
thrown away when you are done. Nothing here can touch production — it only *reads*
it, once, with `pg_dump`.

---

## What this proves

- All 18 migrations apply cleanly against **real production data**, not fixtures.
- `events/0007` (the `target_provinces` → `scope_node` data migration) does what the
  audit predicted on the actual rows — a genuine no-op, or, if not, exactly which
  events it touches.
- `bootstrap_production` builds a sane tree from the **real 34 users'** province and
  parish fields, and `derive_hierarchy` reports how many it cannot resolve.
- `verify_deployment` goes green against a fully-migrated, bootstrapped copy — so
  you know the real deploy's finish line before you start.

## Prerequisites

- Docker running (you already have `backend/docker-compose.test.yml`).
- The production `DATABASE_URL` (in `backend/.env`).
- ~10 minutes.

**You do not need a local `psql` or `pg_dump`.** This project's dev machines don't
have the Postgres client on PATH, so every Postgres command here runs *inside* the
Docker container (`docker run` / `docker exec`), and every "which database am I on?"
check uses the Django ORM. If a step ever asks you for host `psql`, that step is
wrong — tell us.

---

## Procedure

All commands from `backend/`.

### 1. Start the local Postgres

```
docker compose -f docker-compose.test.yml up -d
```

This is the same container the test suite uses (port 5433, tuned for speed). The
test runner uses a separate `test_faithtribe` database, so the rehearsal copy in the
`faithtribe` database will not collide with running tests.

### 2. Dump production (read-only)

`pg_dump`/`psql` are not on the host PATH, so run them from the Postgres image.

```bash
# The dump. --no-owner/--no-privileges strips Neon's own roles (neondb_owner)
# which do not exist locally. Reads production; writes only the local file.
docker run --rm postgres:16-alpine \
  pg_dump --no-owner --no-privileges \
  "postgresql://neondb_owner:PASSWORD@ep-tiny-moon-a4bkgmyt-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  > prod-copy.sql
```

Replace `PASSWORD` (from `.env`). If Neon reports a server version newer than 16,
bump the image tag (`postgres:17-alpine`) so `pg_dump` is not older than the server.

Sanity-check the dump before trusting it:

```bash
ls -lh prod-copy.sql          # non-trivial size
grep -c "CREATE TABLE" prod-copy.sql   # a couple of dozen tables
```

### 3. Load it into the local Postgres

```bash
# Drop and recreate the target so the rehearsal always starts clean.
docker exec -i faithtribe-test-db psql -U faithtribe -d postgres \
  -c "DROP DATABASE IF EXISTS faithtribe;" -c "CREATE DATABASE faithtribe;"

docker exec -i faithtribe-test-db psql -U faithtribe -d faithtribe < prod-copy.sql
```

Some `GRANT`/`OWNER` notices are normal (Neon's roles are absent) — the `--no-owner`
dump keeps them harmless.

### 4. Point the app at the copy

```bash
export REHEARSAL_DB="postgres://faithtribe:faithtribe@localhost:5433/faithtribe"
```

For every command below, prefix `DATABASE_URL=$REHEARSAL_DB` so nothing you run
touches production. Confirm you are aimed at the copy first:

```bash
DATABASE_URL=$REHEARSAL_DB ./venv/Scripts/python.exe manage.py shell -c \
  "from django.db import connection; d = connection.settings_dict; print(d['HOST'], d['PORT'], d['NAME'])"
# -> must print:  localhost 5433 faithtribe
# If you see anything with neon.tech, STOP — you are aimed at production.
```

(This uses the Django ORM rather than `manage.py dbshell`, which would shell out to
a host `psql` you do not have installed — all Postgres tooling in this runbook runs
inside the Docker container instead.)

### 5. Verify the *starting* state matches production

```bash
DATABASE_URL=$REHEARSAL_DB ./venv/Scripts/python.exe manage.py verify_deployment
```

You should see the same wall of failures the real production DB shows — 18 unapplied
migrations, empty tree, zero assignments. That confirms the copy is faithful.

### 6. Rehearse the migration

**Run these three commands one at a time, in order — not as one paste.** The
province count *must* run before `migrate`, because `migrate` drops the column it
reads.

```bash
# 6a. Preview the data migration (read-only).
DATABASE_URL=$REHEARSAL_DB ./venv/Scripts/python.exe manage.py migrate events 0007 --plan
```

```bash
# 6b. Count province-targeted events, via RAW SQL. Two reasons it must be raw SQL run
# before migrating: the current code's Event model has already dropped the
# target_provinces field (so the ORM raises FieldError), and migration 0008 drops the
# column itself (so after `migrate` the column is gone and this errors with
# "column does not exist" — which simply means you already migrated; read 6c's output
# instead).
DATABASE_URL=$REHEARSAL_DB ./venv/Scripts/python.exe manage.py shell -c \
  "from django.db import connection; cur=connection.cursor(); cur.execute(\"SELECT count(*) FROM events_event WHERE target_provinces IS NOT NULL AND target_provinces::text <> '[]'\"); print('province-targeted events:', cur.fetchone()[0])"
# expect 0 — if not, read events/migrations/0007's docstring before the real deploy.
```

```bash
# 6c. Apply everything. Watch events/0007: it prints one line per widened/unresolved
# event as it runs. Silence there = a clean no-op, which is the expected result.
DATABASE_URL=$REHEARSAL_DB ./venv/Scripts/python.exe manage.py migrate
```

The primary signal is 6c's output: `events/0007` reports every event it touches, so
even if you skip 6b, a no-op migration is visible as `Applying events.0007… OK` with
no lines in between.

Watch for any migration that errors or runs suspiciously long. This is the moment
the rehearsal exists for.

### 7. Rehearse the bootstrap

```bash
DATABASE_URL=$REHEARSAL_DB ./venv/Scripts/python.exe manage.py bootstrap_production --dry-run
DATABASE_URL=$REHEARSAL_DB ./venv/Scripts/python.exe manage.py bootstrap_production
```

Read the `derive_hierarchy` summary: node/membership counts, and especially the
`unresolved:` list — those are the real users who will need a manual `grant_role`.
You now know that list *before* deployment day.

### 8. Confirm the finish line

```bash
DATABASE_URL=$REHEARSAL_DB ./venv/Scripts/python.exe manage.py verify_deployment
```

Everything green except the Bible (no text imported in the rehearsal unless you also
run `import_bible`) and possibly push (no VAPID keys locally). Those two are known
and covered by their own runbooks — every *other* check going green is your
assurance the real deploy will too.

Confirm the load-bearing data survived the migration:

```bash
DATABASE_URL=$REHEARSAL_DB ./venv/Scripts/python.exe manage.py shell -c \
  "from events.models import Event; print(Event.objects.get(title__startswith='December').registrations.count())"
# expect 443
```

### 9. Tear down

```bash
docker compose -f docker-compose.test.yml down
rm prod-copy.sql        # it contains real user data — do not leave it lying around
```

---

## What to do with the findings

- **A migration errored** → fix it, add a test that reproduces it on representative
  data, re-rehearse. Do not deploy until the rehearsal is clean.
- **`events/0007` was not a no-op** → a product decision (see PR #34 / migration
  `0007` docstring), not an ops one. Escalate before deploying.
- **A long `unresolved:` list** → prepare the `grant_role` commands in advance so
  deployment day is execution, not discovery.
- **Clean rehearsal** → you have as much certainty as it is possible to have before
  a first deployment. Proceed with [01 — First deployment](01-first-deployment.md).

## One caveat on faithfulness

The rehearsal copy is a point-in-time snapshot. If production keeps taking
registrations between the dump and the real deploy, the real migration runs against
slightly more data — same shape, more rows. That does not change whether the
migrations *work*; it only means the row counts in step 8 will be a little higher on
the day. Take the dump close to the deployment window to keep them aligned.
