# Operations runbooks

Operational procedures for deploying and maintaining the Faith Tribe backend.
Product specs live in `../` (`01`–`16`); this directory is about running the
thing, not building it.

## The one thing to know first

As of the production-readiness audit (2026-07-14), the **production database was
several phases behind the code**: migrations for Bible, Progress, and Notifications
had never been applied, the hierarchy tree had **zero nodes**, and **nobody held
any role assignment** — the RBAC registry was seeded but inert. A deploy that only
runs `migrate` will start, serve requests, and quietly do nothing a leader can use.

Everything here exists to close that gap and make closing it repeatable.

## The verification command is the source of truth

```
python manage.py verify_deployment          # report; non-zero exit if not ready
python manage.py verify_deployment --strict  # warnings count as failures too
```

Run it after every deployment. It checks migrations, critical settings, RBAC,
hierarchy, memberships, role assignments, Bible text, today's devotional, the push
backend, the progress engine, and event scoping — and for each failure it prints
the exact command that fixes it. If a runbook and `verify_deployment` ever
disagree, trust `verify_deployment`: it reads the live database, the runbook is a
description of it.

## Runbooks

| # | Runbook | When |
|---|---|---|
| [01](01-first-deployment.md) | First production deployment | Bringing the current stale production DB up to date — **read this first** |
| [02](02-fresh-installation.md) | Fresh installation | A brand-new empty database (staging, a new region) |
| [03](03-bible-import.md) | Bible text import | Installing or updating a translation's text |
| [04](04-rbac-bootstrap.md) | RBAC bootstrap | Seeding roles and granting the first assignments |
| [05](05-hierarchy-bootstrap.md) | Hierarchy bootstrap | Building the church tree |
| [06](06-push-notifications.md) | Push notification setup | Turning on real WebPush delivery |
| [07](07-production-secrets.md) | Production secrets | Every environment variable, and which are load-bearing |
| [08](08-rollback.md) | Rollback | When a deployment goes wrong |

## The commands, at a glance

| Command | Idempotent? | What it does |
|---|---|---|
| `migrate` | yes | Apply schema changes. Always first. |
| `seed_rbac` | yes | Reconcile permissions + roles to the code registry. |
| `derive_hierarchy` | yes | Build the tree + memberships + legacy role assignments from user data. |
| `grant_role <user> <role> <node>` | yes | Grant one role assignment (the bootstrap escape hatch). |
| `import_bible <file.json>` | yes | Import a translation's text. |
| `rebuild_bible_search` | yes | Rebuild the Scripture full-text index. |
| `bootstrap_production` | yes | `seed_rbac` + `derive_hierarchy` + `verify_deployment`, in order. |
| `verify_deployment` | read-only | Report readiness; non-zero exit on failure. |

Every one is safe to re-run. The realistic failure in the field is not "a command
broke", it is "someone ran half the sequence and is not sure where they stopped" —
so re-running the whole thing is always a valid recovery.
