# 02 — Fresh installation

A brand-new empty database: a staging environment, a demo, or (in V2) a new
region. No legacy user data, so nothing to derive a hierarchy *from* — you build it
explicitly.

For upgrading the existing production database, use
[01 — First deployment](01-first-deployment.md) instead.

---

## Procedure

### 1. Environment

Set the secrets in [07 — Production secrets](07-production-secrets.md). At minimum:
`SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS` (not `*`), `DEBUG=False`,
`REDIS_URL`.

### 2. Schema

```
python manage.py migrate
```

On a fresh database this also runs the seed data migrations
(`identity/0003_seed_rbac`, `0004_seed_bible_permission`), so RBAC is populated
before you touch it.

### 3. A first administrator

There is no one to log in as yet, and RBAC assignments require a node that does not
exist. Create a superuser from the shell — the one account that bypasses the
hierarchy:

```
python manage.py createsuperuser
```

### 4. Build the hierarchy

With no legacy users, `derive_hierarchy` has nothing to read. Build the tree
explicitly instead — see [05 — Hierarchy bootstrap](05-hierarchy-bootstrap.md) for
building nodes from a shell or CSV. At minimum you need one national root and one
region, or nothing can be scoped.

### 5. Grant the first real roles

```
python manage.py grant_role <username> regional_coordinator "Region 63"
```

See [04 — RBAC bootstrap](04-rbac-bootstrap.md). Escalation is not enforced for
this command (it is an operator tool), so the superuser can appoint the first
coordinator, who then appoints others through the console under the normal
escalation rules.

### 6. Bible text

```
python manage.py import_bible web.json
```

See [03 — Bible import](03-bible-import.md).

### 7. Seed content

A fresh install has no devotionals, so `verify_deployment` will flag today as a
gap. Publish at least today's, and ideally a buffer — the roadmap asks for 60 days
before a real launch.

### 8. Verify

```
python manage.py verify_deployment --strict
```

---

## Fresh vs. first-deployment: the difference that matters

| | Fresh install (this doc) | First deployment ([01](01-first-deployment.md)) |
|---|---|---|
| Legacy users | none | 34 real users |
| Hierarchy source | you build it explicitly | `derive_hierarchy` reads user data |
| First admin | `createsuperuser` | already exists |
| Risk | low — nothing to lose | **real data; back up first** |
