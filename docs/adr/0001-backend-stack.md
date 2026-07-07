# ADR 0001 — Backend stack: Django + Django REST Framework

- **Status:** Accepted
- **Date:** 2026-07-07
- **Context doc:** `docs/15-technical-architecture.md`

## Context

`15-technical-architecture.md` sanctions two stacks — **Django + DRF** or **NestJS + Prisma** — and instructs: "Pick one, document the decision as an ADR, and stop debating."

The existing Faith Tribe backend is already Django 5.2 + DRF, with a substantial, working events/payments/content implementation, a custom `users.User` model, JWT auth, Celery + Redis, and S3/R2 storage wired. The team's stated fluency (RCCG platform experience) matches Django.

## Decision

**Adopt Django + Django REST Framework as the backend stack.** We refactor the existing codebase rather than rebuild it (per the project charter: "prefer refactoring over rebuilding").

## Consequences

- **Positive:** No rewrite; retains the strong events/payments/check-in work; matches team fluency; batteries-included (ORM migrations, admin, auth) suit a small team shipping V1.
- **Binding invariants carried forward** (from `15-technical-architecture.md`): versioned REST API (`/api/v1/…`), modular-monolith module boundaries, row-level hierarchy scoping enforced server-side, API-first (same API serves PWA now and native apps in V3), no region hard-coding.
- **Follow-ups** tracked in `docs/BACKEND-AUDIT.md`: hierarchy tree + scoped RBAC (Phase 1), Progress event stream (Phase 2), Bible foundation (Phase 3), auth hardening incl. HTTP-only cookies + OTP (Phase 4).

## Alternatives considered

- **NestJS + Prisma** — sanctioned by the docs, but would discard a working Django codebase and mismatch the team's current fluency. Rejected on cost/benefit.
