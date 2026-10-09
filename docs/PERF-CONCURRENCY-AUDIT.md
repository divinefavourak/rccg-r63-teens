# Performance and Concurrency Audit

_Audit date: 2026-10-06 · Scope: mobile app and backend APIs · Branch: `feat/mobile-teacher-tools`_

## How to read this

Every finding was found by **reading code**. Nothing was run, nothing was
measured on a device or against production, and nothing has been fixed.

- **Confirmed** means the code path was read end to end. **Plausible** means the
  code supports it but a step was not traced, or the cost depends on something
  outside the repo.
- **Checked by** says who read it: `main` is the lead session, `agent` is one of
  four parallel audit agents whose report was not re-read line by line. Re-read
  the code before changing it.
- Millisecond figures assume ~184 ms per SQL round trip, which was measured from
  a dev machine to Neon (`backend/backend/settings.py:248`), not from the
  production host. The query counts hold either way.
- Tick the box when a finding is fixed and note the commit.

IDs: `BC` backend concurrency and write safety, `BS` backend speed, `MD` mobile
data layer and offline, `MR` mobile rendering, startup and bundle.

## Open questions

These decide priority or cannot be answered from the repo.

- [ ] **Gunicorn start command.** No Procfile, `render.yaml` or gunicorn config
  is in the repo. Worker class and count decide whether a slow client on
  `/bible/pack/` can pin a worker (BS-06).
- [ ] **Is the legacy tickets and Paystack flow still live?** Decides whether
  BC-01, BC-02, BC-07, BC-08 and BC-20 are urgent or cleanup.
- [ ] **Redis provider.** The Celery broker is forced to database `/1`
  (`backend/backend/settings.py:632`), which fails on single-database providers
  such as Upstash.
- [ ] **Database latency from the production host.** One timing decides how much
  of the BS section is worth doing.
- [ ] **Is `NOTIFICATIONS_DEVICE_PUSH_BACKEND` set to the Expo backend in
  production?** If not, BS-04 costs queries only, not HTTP time.
- [ ] **Does the server downscale avatars?** Decides MR-11.

## Status on 2026-10-07

Ticked items are fixed and committed on `fix/perf-concurrency-audit`. The
backend suite (494 tests across payments, events, users, notifications,
content, today, identity, tickets, profiles and progress) ran with two
failures, both in tests. Those were fixed and the two affected files pass (41
tests). **The full suite has not been run again since, nor since the review
fixes that followed.** Where a finding below says "backend tests pass", read it
with that limit. The mobile typecheck passes; **no mobile change has been tried
on a device.**

Not covered by any test: the background push thread, the permission-cache bump
after commit, the reminder close-out guard and the Redis timeouts.

Partly done, left unticked:

- **MD-05**: the ticket poll is 15 s instead of 5 s. It still fetches every
  registration; a per-ticket status endpoint is not built.
- **MD-07**: the devotional button no longer spins while a send is held
  offline. The Today challenge card is unchanged.
- **MD-09**: the cache is written 5 s after the last change instead of 1.5 s.
  It is still serialised whole, with no size cap.
- **MD-10**: filing a pack now yields every 10 chapters. The single
  `JSON.parse` and the lack of resume are unchanged.
- **BS-21**: see its entry.

Left open because they need something this pass could not supply:

| Needs | Findings |
|---|---|
| An answer to an open question above | BS-01, BS-06, BC-20, MR-11 |
| A new or changed API endpoint, on both server and app | BS-05, BS-17, BC-19, MD-06, MD-14, MD-15, MD-16, MD-20 |
| A database migration (index or column) | BS-14, BS-26 |
| A new native build to try | MR-03, MR-20 |
| A screen change that should be seen on a phone first | MR-04, MR-05, MR-06, MR-07, MR-08, MR-09, MR-10, MR-13 to MR-17, MR-21, MR-22 |
| A larger rewrite (bulk notification fan-out) | BC-11, BS-13 |
| The owner's call | MR-19 (the Metro stub is commented out on purpose) |
| Not started, small | BC-17, BC-18, BC-21, BC-22, BC-23, BS-03, BS-08 to BS-11, BS-16, BS-19, BS-20, BS-22 to BS-25, BS-27, MD-17, MD-19, MD-21 to MD-25 |

Known follow-ups from the fixes themselves:

- Event counters already in the database are not recounted; capacity no longer
  reads them, the admin list still shows them.
- A leader can still confirm a waitlisted or cancelled registration onto a full
  event.
- `max_waitlist` is not enforced.
- If the access token has expired at sign-out, the token blacklisted is the one
  from before the refresh that the logout request triggers.
- The class list lost its card shadow when it became a virtualised list.

## Suggested order

1. BC-01, BC-02 (payments)
2. BC-03, BC-04, BC-05, BC-06 (event capacity, counters, ids)
3. MD-01, BC-10 (sign-out on refresh failure, both ends)
4. MD-02, MD-03, MD-04 (lost scans, timeouts)
5. BS-04 (push out of the request)
6. BC-09 (permission cache)
7. Then by severity within each section.

---

## Backend: concurrency and write safety

### High

- [x] **BC-01. Paystack webhook never verifies the signature.** _Fixed 2026-10-07; backend tests pass. Correction to the
  finding: the old handler logged `ip_address='webhook'` into an inet column
  before doing anything, so on Postgres it most likely failed with a 500 before
  it could approve a ticket. The forgery was reachable in code but probably not
  in production, and genuine webhooks were probably failing too._
  `backend/payments/views.py:260-270`, `backend/payments/services.py:376`.
  Confirmed, main.
  The view only checks that `X-Paystack-Signature` is present; `handle_webhook`
  receives it and never uses it. The endpoint is unauthenticated, so anyone with
  a payment reference can post `charge.success` and get the ticket approved.
  Fix: HMAC-SHA512 the raw `request.body` with the Paystack secret and compare
  before doing anything.

- [x] **BC-02. A payment can be applied twice, and the amount is never checked.**
  _Fixed 2026-10-07 with BC-01; backend tests pass._
  `backend/payments/services.py:334-358`, `:396-415`. Confirmed, main.
  Neither client verify nor the webhook checks for an already successful
  payment, and neither takes a lock or transaction. A webhook retry, or verify
  and webhook together, approve and email again. The amount Paystack reports is
  not compared with `payment.amount`.
  Fix: `select_for_update` the payment inside `transaction.atomic`, return early
  if already successful, compare the amount, send the email in `on_commit`.

- [x] **BC-03. Event capacity is not enforced.** _Fixed 2026-10-07; backend tests pass._
  `backend/events/models.py:193-196`, `backend/events/serializers.py:410`,
  `:480`. Confirmed, main.
  `is_full` reads the stored `registration_count`, which only rises on
  `confirm()`. Pending registrations never count, so any number of teens can
  register for the last place, and `confirm()` never checks capacity. This needs
  no race.
  Fix: decide capacity inside a transaction that locks the event row, counting
  the statuses that hold a place.

- [x] **BC-04. `confirm()`, `cancel()` and `check_in()` have no status guard or
  lock.** _Fixed 2026-10-07; backend tests pass._ `backend/events/models.py:470-512`. Confirmed, main.
  `confirm()` adds one every time it is called. `cancel()` only subtracts when
  the status was `confirmed`, so cancelling a checked-in ticket never returns
  the place. `check_in()` adds one unconditionally. Callers:
  `backend/events/views.py:321-326`, `:360`, `backend/events/admin.py:277-285`.
  Fix: make each a guarded transition (lock the row, return if already in the
  target state, adjust counters from the previous status), as
  `backend/events/checkin.py:126` already does.

- [x] **BC-05. The old check-in route double-counts and skips every check.** _Fixed 2026-10-07; backend tests pass._
  `backend/events/views.py:353-377`. Confirmed, main.
  No status guard, row lock or transaction. Checking in the same ticket twice
  raises `checked_in_count` twice and writes two audit rows. It also checks in
  cancelled, waitlisted and unpaid tickets, which `checkin.scan` refuses.
  Fix: route it through `checkin.scan`, or remove it if nothing calls it.

- [x] **BC-06. `registration_id` is read-last-plus-one with no lock.** _Fixed 2026-10-07; backend tests pass._
  `backend/events/models.py:442-454`. Confirmed, main.
  Two registrations for the same prefix on the same day can pick the same
  number; the loser hits the unique constraint and the teen gets a 500.
  Fix: a database sequence or per-prefix counter row, or retry on
  `IntegrityError`. Also removes two queries per save (BS-21).

- [x] **BC-07. `Ticket.ticket_id` has the same collision.** _Fixed 2026-10-07; backend tests pass._
  `backend/tickets/models.py:145-161`. Confirmed, agent.
  The lock at `backend/tickets/views.py:823-825` covers only the last existing
  row and single creates do not take it. A collision fails the whole CSV batch
  at `backend/tickets/views.py:1046`.
  Fix: as BC-06.

### Medium

- [x] **BC-08. Legacy ticket check-in is an unlocked check-then-create.** _Fixed 2026-10-07; backend tests pass._
  `backend/tickets/views.py:586-610`, `backend/tickets/models.py:309-315`.
  Confirmed, agent.
  No lock, transaction or unique constraint on `CheckInRecord`; two doors
  scanning one ticket both succeed.
  Fix: lock the ticket row, or a unique constraint on (ticket, day).

- [x] **BC-09. Permission cache version is bumped before commit.** _Fixed 2026-10-07; backend tests pass._
  `backend/identity/signals.py:27-34`, `backend/identity/authorization.py:329-362`.
  Confirmed by reading, timing-dependent, agent.
  A request landing between the bump and the commit caches the old permissions
  under the new version for 15 minutes, so a revoked leader keeps access.
  Fix: `transaction.on_commit(bump_authz_version)`.

- [x] **BC-10. A lost refresh response leaves the phone with a blacklisted
  token.** _Fixed 2026-10-07 by turning `BLACKLIST_AFTER_ROTATION` off (owner decision); backend tests pass. Accepted cost: a rotated refresh token stays usable until it expires._ `backend/backend/settings.py:494-495`, `backend/users/views.py:636-657`.
  Plausible, agent.
  Refresh tokens rotate and the old one is blacklisted at once. See MD-01 for
  the client half.
  Fix: drop `BLACKLIST_AFTER_ROTATION`, or accept the previous token for a short
  grace window.

- [ ] **BC-11. A late reminder tick silently drops rungs.**
  `backend/notifications/ladder.py:192-203`, `:93-101`, `backend/backend/celery.py:39-43`.
  Plausible, agent.
  The 5-minute tick loops users serially with an inline push per user. If a tick
  starts late, rungs whose time fell in the gap match no window.
  Fix: derive the window from the last successful tick, or fan out per-user
  sends to tasks. Related: BS-13.

- [x] **BC-12. End-of-day close-out is not idempotent.** _Fixed 2026-10-07; backend tests pass._
  `backend/notifications/ladder.py:248-254`, `backend/notifications/services.py:293-294`.
  Confirmed, agent.
  A duplicated beat or manual rerun increments `consecutive_ignored_days` twice
  for one day, so a teen steps down in fewer than 7 days.
  Fix: store the last closed-out date on the preference and skip if done.

- [x] **BC-13. The daily scrape likely asks for yesterday.** _Fixed 2026-10-07; backend tests pass._
  `backend/content/tasks.py:111`, `backend/backend/celery.py:27`. Plausible, agent.
  It runs at 00:10 Lagos but uses `date.today()`, which is still the previous
  day in UTC. `backend/content/views.py:520` has the same pattern for the
  current manual. Note: the scraper had uncommitted changes on the audit date;
  check against the current file.
  Fix: `app_today()`.

- [x] **BC-14. Stored and live registration counts disagree.** _Fixed 2026-10-07; backend tests pass._
  `backend/events/views.py:59-65`, `backend/events/models.py:187-196`,
  `EventListSerializer.spots_remaining`. Confirmed, main.
  The list shows a live count (confirmed plus checked-in) while `is_full` and
  `spots_remaining` read the stored counter, so the app can show full while the
  server accepts registrations.
  Fix: one source of truth; falls out of BC-03 and BC-04.

### Low

- [x] **BC-15. Double-tap on "complete challenge" writes two actions.** _Fixed 2026-10-07; backend tests pass._
  `backend/today/services.py:113-122`, `backend/progress/models.py:60-65`.
  Confirmed, agent. Streak is safe; action counts inflate.
  Fix: partial unique constraint on (user, action_type, source_reference,
  occurred_on), or take the streak lock before the check.

- [x] **BC-16. `toggle_like` is check-then-act.** _Fixed 2026-10-07; backend tests pass._
  `backend/content/views.py:346-363`. Confirmed, agent.
  Two likes: the second raises `IntegrityError` (500). Two unlikes: both
  decrement the counter.
  Fix: `get_or_create`, and use the row count from `delete()`.

- [ ] **BC-17. Legacy `update_streak` can lose an increment and overwrite a
  profile edit.** `backend/profiles/models.py:133-164`. Plausible, agent.
  Fix: `F()` update with `update_fields`.

- [ ] **BC-18. Two endpoints both record a devotional completion.**
  `backend/profiles/views.py:118-139`, `backend/content/views.py:271-286`.
  Confirmed, agent. A client calling both gets two actions. Not checked whether
  any client does.

- [ ] **BC-19. `record_chapter_read` has no idempotency key.**
  `backend/bible/services.py:102-111`. Confirmed, agent.
  A retried request or replayed offline queue double-counts.
  Fix: accept a client-generated id and dedupe on it. Needed before MD-06.

- [ ] **BC-20. Double-click on pay creates two Paystack sessions.**
  `backend/payments/views.py:100-111`. Confirmed, agent.
  Fix: reuse an existing pending payment for the ticket.
  _Not fixed on this route. Paying for an event registration is a new route
  (`POST /payments/registrations/<id>/checkout/`) that does reuse the open
  checkout; the legacy ticket route above is unchanged._

- [ ] **BC-21. Login and OTP attempt caps can be exceeded by parallel guesses.**
  `backend/users/models.py:200-204`, `backend/users/otp.py:85-97`. Confirmed,
  agent. Bounded by the `auth` and `otp` throttles.

- [ ] **BC-22. `confirm_registrations` command inflates the counter.**
  `backend/events/management/commands/confirm_registrations.py:106-114`.
  Confirmed, agent. Operator-only; counts rows updated regardless of prior status.

- [ ] **BC-23. Announcement cap is check-then-send.**
  `backend/notifications/services.py:64-80`. Confirmed, main.
  Two announcements at the same moment can both push.

- [x] **BC-24. Logout may not blacklist anything.** _Confirmed and fixed 2026-10-07: the phone sent `{}`, so nothing was blacklisted; it now sends its refresh token._
  `mobile/src/state/auth.tsx:323`. Noted in passing by an agent, not traced on
  the server: `signOut` posts `{}` to `/auth/logout/` with no refresh token.

---

## Backend: speed

### SQL round trips per request

Authenticated teen, warm Redis. Every request starts with a `SELECT 1` health
check and the JWT user lookup; both are included. Counted by an agent.

| Endpoint | SQL round trips |
|---|---|
| GET `/today/` (shared cache hit) | 8 (9 with no ContinueReading row) |
| GET `/today/` shared cache miss, once per day per age group | about 11 more |
| GET `/auth/me/` | 3 |
| GET `/identity/me/` teen, no roles | 5 |
| GET `/identity/me/` with N role assignments | 5 + up to 5N |
| GET `/profiles/me/` | 4 |
| GET `/events/events/` | 7 |
| GET `/events/events/<id>/` | 6 (+1 on first view) |
| GET `/events/registrations/mine/` | 3 |
| GET `/progress/summary/` | 7 |
| GET `/notifications/inbox/` | 4 |
| GET `/notifications/inbox/unread_count/` | 3 |
| GET `/bible/lookup/` | 5 |
| GET `/content/devotionals/` | about 15 |
| GET `/content/devotionals/<id>/` | about 14–16 |
| POST `/content/devotionals/<id>/mark_read/` first time | about 25–28 |
| POST `/events/events/<id>/register/` | about 22, plus push HTTP |
| POST `/events/checkin/scan/` success | about 20, plus push HTTP |

### High

- [ ] **BS-01. Every request pays an extra `SELECT 1`.**
  `backend/backend/settings.py:235` (`conn_health_checks=True`). Confirmed, agent.
  Fix: keep only if Neon really drops idle connections; otherwise turn it off or
  use Neon's pooled endpoint.

- [x] **BS-02. Devotional list runs detail-only prefetches.** _Fixed 2026-10-07; backend tests pass._
  `backend/content/views.py:107-113`. Confirmed, agent.
  Up to 9 wasted round trips per library page, and again on `mark_read`,
  `toggle_like` and `record_share`.
  Fix: prefetch only for `retrieve`, `today`, `by_date`.

- [ ] **BS-03. Devotional detail is about 15 round trips and uncached.**
  `backend/content/views.py:134-138`, `backend/content/models.py:207-217`.
  Confirmed, agent.
  Fix: cache the serialised detail by (id, `updated_at`) as Today does; flatten
  the prefetch chain.

- [x] **BS-04. Push delivery runs inside the request.** _Fixed 2026-10-07 for the four request-path sends (registration received, confirmed, status changed, checked in), using a background thread so it does not depend on a Celery worker. Backend tests pass. The inbox write and its queries still run in the request._
  `backend/notifications/services.py:132-190`, `backend/notifications/push.py:173-189`;
  called from `backend/events/views.py:151`, `:284`, `:340-344`,
  `backend/events/checkin.py:180`. Confirmed by reading, main and agent.
  `send()` is about 9 round trips, plus one HTTP post per device with a 10 s
  timeout. The door scanner waits on the teen's push.
  Fix: write the inbox row inline, deliver through a Celery task.

- [ ] **BS-05. Three "who am I" endpoints cost 12 round trips at launch.**
  `backend/users/views.py:323-330`, `backend/identity/views.py:25-30`,
  `backend/profiles/views.py:80-91`. Confirmed, agent.
  Fix: one bootstrap endpoint, about 5 round trips.

- [ ] **BS-06. The Bible pack is re-gzipped per request with no resume.**
  `backend/bible/views.py:247-251`, `backend/bible/packs.py:42-56`,
  `backend/backend/settings.py:136`. Confirmed by reading, agent.
  No ETag, Last-Modified or Range, so a dropped download restarts from zero and
  the app cannot show real progress. A `COUNT` over 31k verses runs on every
  request. The file is rebuilt after every deploy. Whether a slow client pins a
  worker depends on the gunicorn config (open question).
  Fix: build at import time, upload pre-gzipped to R2, return a URL.

### Medium

- [x] **BS-07. `/identity/me/` N+1 per role assignment.** _Fixed 2026-10-07; backend tests pass._
  `backend/identity/serializers.py:109-111`, `backend/identity/authorization.py:35-39`.
  Confirmed, agent.
  Fix: the `select_related` and `prefetch_related` already used at
  `backend/identity/views.py:114-118`.

- [ ] **BS-08. Three round trips per request re-derive the caller's node and age
  group.** `backend/events/scoping.py:41-46`, `backend/content/views.py:63`, `:74`.
  Confirmed, agent.
  Fix: put node path and age group in the cached authority snapshot.

- [ ] **BS-09. Events list page query.** `backend/events/views.py:59-65`.
  Confirmed, agent. `Count(distinct=True)` over a join groups by every event
  column. Fine today, grows with registrations.
  Fix: correlated subquery count.

- [ ] **BS-10. `/today/` personal half: 8 can be 5.**
  `backend/today/views.py:66`, `backend/today/services.py:206-218`. Confirmed, agent.

- [ ] **BS-11. `/progress/summary/`: 7 can be 4.**
  `backend/progress/views.py:53-61`, `backend/bible/services.py:186-192`.
  Confirmed, agent.

- [x] **BS-12. Global pagination is fixed at 20 and ignores `page_size`.** _Fixed 2026-10-07; backend tests pass._
  `backend/backend/settings.py:443-444`. Confirmed, agent.
  Fix: a default pagination class with `page_size_query_param` and a max.
  Unblocks MD-11, MD-12, MD-13.

- [ ] **BS-13. Fan-out loops call `send()` per recipient, sequentially.**
  `backend/events/notifications.py:183`, `:202`, `:237`,
  `backend/notifications/ladder.py:192-203`. Confirmed, agent.
  1,000 teens at one rung is about 10,000 round trips, at the Celery task time
  limit.
  Fix: bulk-load, `bulk_create` inbox rows, batch Expo at 100 per request.

- [ ] **BS-14. Case-insensitive lookups cannot use their indexes.**
  `backend/events/views.py:255`, `backend/events/serializers.py:393-395`, `:461-463`,
  `backend/events/checkin.py:131`. Confirmed, agent.
  Fix: store emails lower-cased and match exact, or functional indexes;
  upper-case the scanned code.

- [x] **BS-15. Redis has no socket timeouts.** _Fixed 2026-10-07; backend tests pass._
  `backend/backend/settings.py:175-184`. Confirmed, agent.
  An unreachable Redis hangs each cache call instead of failing open.
  Fix: `SOCKET_CONNECT_TIMEOUT` and `SOCKET_TIMEOUT` at 1–2 s.

- [ ] **BS-16. `mark_read` is about 25 round trips.**
  `backend/content/views.py:261-297`. Confirmed by reading, count approximate, agent.
  Fix: BS-02 removes 9; drop the legacy dual-write when allowed.

### Low

- [ ] **BS-17. `/registrations/mine/` is unpaginated and returns full detail.**
  `backend/events/views.py:295-302`. Confirmed, agent. Related: MD-05.
- [x] **BS-18. `/profiles/me/` re-fetches the user; `age` has no null guard.** _Fixed 2026-10-07; backend tests pass._
  `backend/profiles/views.py:91`, `backend/profiles/models.py:124-131`.
  Confirmed by reading, agent. Whether the column allows null was not checked.
- [ ] **BS-19. Bible alias map rebuilt per lookup.**
  `backend/bible/references.py:102`. Confirmed, agent.
- [ ] **BS-20. QR code read from storage inside the request.**
  `backend/events/email_service.py:131-134`. Confirmed, agent.
- [ ] **BS-21. Registration `save()` runs 2 extra queries.** _Half done
  2026-10-07: the event title lookup is gone; the last-id scan remains, since
  BC-06 was fixed by retry and not by a sequence._
  `backend/events/models.py:435`, `:442-444`. Confirmed, agent. Fixed by BC-06.
- [ ] **BS-22. Email threads can lose mail.**
  `backend/events/email_service.py:32-59`. Confirmed, agent. Daemon thread, 30 s
  timeout, no retry. No connection leak.
- [ ] **BS-23. Check-in "today" is N+1 on counts.**
  `backend/events/checkin_views.py:51`. Confirmed, agent. N is 1–2 in practice.
- [ ] **BS-24. Anonymous requests pay 4 Redis ops for throttling.**
  `backend/backend/settings.py:468-472`. Confirmed, agent.
- [ ] **BS-25. Unrotated file log handler.**
  `backend/backend/settings.py:607-615`. Confirmed, agent.
- [ ] **BS-26. Redundant indexes.** `backend/profiles/models.py:92`,
  `backend/notifications/models.py:250`; `backend/progress/models.py:103`
  plausible. Agent.
- [ ] **BS-27. Token refresh is about 5 round trips.**
  `backend/backend/settings.py:494-496`. Plausible, not traced, agent.

---

## Mobile: data layer and offline

### High

- [x] **MD-01. Any refresh failure signs the teen out and wipes the saved
  cache.** _Fixed 2026-10-07; typecheck passes, not tried on a device._ `mobile/src/api/client.ts:193-201`, `mobile/src/state/auth.tsx:198-201`.
  Confirmed, agent.
  A dropped connection or 5xx on `/auth/refresh/` is treated like a refused
  token.
  Fix: clear the session only on 401 or 400; otherwise rethrow `ApiError(0)`.

- [x] **MD-02. Queued scans are dropped on 5xx, 429 or 401.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/src/state/checkinQueue.ts:110-119`. Confirmed, agent.
  Fix: keep the scan when the error is transient or 401/429.

- [x] **MD-03. A scan added during a flush is overwritten.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/src/state/checkinQueue.ts:95-122`, `:132-142`. Confirmed, agent.
  Fix: re-read the queue before writing, or serialise `add` and `flush`.

- [x] **MD-04. No request has a timeout.** _Fixed 2026-10-07; typecheck passes, not tried on a device._ `mobile/src/api/client.ts:149-154`.
  Confirmed that none is set; the hang is plausible. Agent.
  Blocks queries, the check-in flush, sign-out and the scanner.
  Fix: `AbortController` at about 15 s mapped to `ApiError(0)`; pass React
  Query's `signal` through.

- [ ] **MD-05. The ticket screen polls every 5 s for 10 minutes.**
  `mobile/app/ticket/[id].tsx:20-25`, `:67-79`. Confirmed, agent.
  Each poll returns every registration in full. 300 teens at a door is about 60
  requests a second.
  Fix: a small status endpoint for one ticket, 10–15 s with backoff, stop on
  `checked_in`.

### Medium

- [ ] **MD-06. Chapter read, devotional read and challenge are not durably
  reported offline.** `mobile/app/(tabs)/bible.tsx:117-133`,
  `mobile/src/api/queries.ts:897-907`, `:146`, `:124`. Confirmed, agent.
  Fix: a persisted queue carrying `occurred_on`; needs BC-19 and a server that
  accepts the date.

- [ ] **MD-07. Offline, "mark read" and the challenge spin for ever.**
  `mobile/app/devotional.tsx:232`, `mobile/app/(tabs)/index.tsx:351-359`.
  Confirmed from React Query v5 behaviour, agent.
  Fix: check `isPaused` and say it will send later.

- [x] **MD-08. An expired access token doubles the requests at launch.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/src/api/client.ts:160-202`. Confirmed, agent.
  Fix: decode `exp` and refresh first when near expiry.

- [ ] **MD-09. The whole cache is serialised and written synchronously.**
  `mobile/src/api/persist.ts:74-90`, `:110-116`. Confirmed; cost plausible. Agent.
  Runs after every successful fetch, no size cap.
  Fix: skip when data is identical, longer debounce plus on-background, write to
  a temp file then move.

- [ ] **MD-10. The Bible pack blocks the JS thread and cannot resume.**
  `mobile/src/data/bibleStore.ts:133-168`, `mobile/src/state/bibleDownload.ts:97-105`.
  Confirmed; timings plausible. Agent.
  One `JSON.parse` of about 4 MB, then about 4,700 synchronous native calls,
  yielding only between books. A killed run restarts from zero and leaves the
  download file behind.
  Fix: per-book packs from the server, or yield every ~10 chapters and skip
  chapters already on disk.

- [x] **MD-11. Favourites read only the first 20.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/src/api/queries.ts:321`. Confirmed, agent.
  Older saved items show as unsaved and tapping posts a duplicate.

- [ ] **MD-12. Bookmarks walk every page sequentially, after every tap.**
  `mobile/src/api/queries.ts:862-869`, `:886`. Confirmed, agent.
  Silently stops at 500.

- [x] **MD-13. The books list is 7 sequential requests.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/src/api/queries.ts:431-449`. Confirmed, agent.
  Fix: pass `translation_code`; larger pages after BS-12.

- [ ] **MD-14. Saved over-fetches and has an N+1.**
  `mobile/app/saved.tsx:52-81`. Confirmed, agent.
  Fix: have the favourites endpoint embed title and thumbnail.

- [ ] **MD-15. Me fires 7 requests on open.**
  `mobile/app/(tabs)/me.tsx:55-67`. Confirmed, agent.
  Fix: one summary endpoint with the counts.

- [ ] **MD-16. Console home is a waterfall and fetches the roster for a count.**
  `mobile/src/api/queries.ts:672-688`, `mobile/app/console/index.tsx:40-47`.
  Confirmed, agent.

- [ ] **MD-17. ETags live only in memory.** `mobile/src/api/client.ts:104`.
  Confirmed, agent. Every cold start downloads full bodies.

### Low

- [x] **MD-18. Launch signs out on any non-transient `/auth/me/` error.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/src/state/auth.tsx:178-183`. Confirmed, agent. Fix: only 401.
- [ ] **MD-19. Possible previous-user cache for a guest.**
  `mobile/src/state/auth.tsx:157-160`, `mobile/app/_layout.tsx:72-79`.
  Plausible, agent.
- [ ] **MD-20. Scan time is saved but never sent; queue flushes only on the
  check-in screen.** `mobile/src/state/checkinQueue.ts:22-28`, `:149-157`,
  `mobile/src/api/queries.ts:1000-1002`. Confirmed, agent.
- [ ] **MD-21. A failed keychain write after rotation is swallowed.**
  `mobile/src/api/tokens.ts:40-48`. Confirmed, agent. Rare.
- [ ] **MD-22. Push token is read on every launch before the weekly check.**
  `mobile/src/state/push.ts:123-125`. Network cost plausible, agent.
- [ ] **MD-23. Queries are not cancelled.** `mobile/src/api/queries.ts`
  (all but line 726). Confirmed, agent.
- [ ] **MD-24. Licence refusal detected by `'403'` in the error text.**
  `mobile/src/state/bibleDownload.ts:113`. Confirmed, agent.
- [ ] **MD-25. Lists show only the first 20 with no "load more".**
  `mobile/src/api/queries.ts:186`, `:214`, `:256`. Confirmed, agent.

---

## Mobile: rendering, startup and bundle

### High

- [x] **MR-01. Class list mounts every row at once.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/app/console/class/index.tsx:108-129`,
  `mobile/src/components/ClassPieces.tsx:51-77`. Confirmed, agent.
  Up to 300 rows, about 6,000 views and 300 image requests; search re-renders
  all on each keystroke.
  Fix: `FlatList` with `getItemLayout`, debounced search, plain `Pressable` rows.

- [x] **MR-02. Scanner tears down the camera on every scan.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/app/console/check-in.tsx:221-228`. Confirmed; cost plausible. Agent.
  Fix: keep the camera mounted and pause the preview under the result.

### Medium

- [ ] **MR-03. Nine fonts load at runtime and hold the splash.**
  `mobile/app/_layout.tsx:48-58`. Confirmed, agent. 2.26 MB.
  Fix: embed through the `expo-font` config plugin; subset Inter.

- [ ] **MR-04. First paint waits on six gates.** `mobile/app/_layout.tsx:131`.
  Confirmed, agent. One case waits on `/auth/me/` with no timeout (MD-04).
  Fix: one `multiGet`, cap the bootstrap wait, do not gate on cache restore.

- [ ] **MR-05. Book picker mounts up to 150 animated buttons.**
  `mobile/src/components/BibleNavigator.tsx:153-162`, `:189-210`. Confirmed, agent.

- [ ] **MR-06. Opening the picker unmounts the reader.**
  `mobile/app/(tabs)/bible.tsx:292-305`. Confirmed, agent.
  Fix: render the navigator as an overlay.

- [ ] **MR-07. Every chapter change re-renders the root navigator.**
  `mobile/app/_layout.tsx:117-157`, `mobile/src/state/reader.tsx:96-106`,
  `mobile/src/state/auth.tsx:334-351`. Confirmed, agent.
  Fix: move the readiness gate to a leaf, memoise `screenOptions`, split
  `pending`/`error` out of the session context.

- [ ] **MR-08. `Press` is too heavy as a list-row primitive.**
  `mobile/src/ui/Press.tsx:27`, `:67-80`. Confirmed; cost plausible. Agent.
  Common multiplier behind MR-01, MR-05, MR-09.

- [ ] **MR-09. Sign-up church list is unvirtualised.**
  `mobile/app/(auth)/sign-up.tsx:476-485`. Confirmed; size plausible. Agent.

- [ ] **MR-10. Scan-frame pulse shares a style with layout props.**
  `mobile/app/console/check-in.tsx:506-512`. Plausible, agent.

- [ ] **MR-11. Avatars upload at full resolution.**
  `mobile/src/state/photo.ts:39-44`. Plausible, agent. Server side not checked.

### Low

- [x] **MR-12. Barcode callback stays attached while locked.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/app/console/check-in.tsx:226`. Confirmed, agent.
- [ ] **MR-13. Heavy SVGs are rasterised on the phone.**
  `mobile/src/ui/art.tsx:32-45`. Confirmed; cost plausible. Agent.
- [ ] **MR-14. Country sheet mounts 76 rows.**
  `mobile/src/ui/PhoneField.tsx:94-134`. Confirmed, agent.
- [ ] **MR-15. Saved list is unbounded in a `ScrollView`.**
  `mobile/app/saved.tsx:177-210`. Confirmed, agent.
- [ ] **MR-16. Library search results are in a `ScrollView`.**
  `mobile/app/(tabs)/library.tsx:201`, `:287`. Confirmed, agent.
- [ ] **MR-17. Player progress re-renders the whole player; MiniPlayer ticks
  when covered.** `mobile/app/player.tsx:34`,
  `mobile/src/components/LibraryPieces.tsx:135`. Confirmed, agent.
- [x] **MR-18. Today header memo is defeated.** _Fixed 2026-10-07; typecheck passes, not tried on a device._
  `mobile/app/(tabs)/index.tsx:76`. Confirmed, agent.
- [ ] **MR-19. MaterialSymbols font (964 KB) still ships.**
  `mobile/metro.config.js:20-25`. Confirmed, agent.
- [ ] **MR-20. No release shrinking; preview builds a universal APK.**
  `mobile/app.json:49-88`, `mobile/eas.json:11-13`. Confirmed, agent.
- [ ] **MR-21. Keyboard avoidance jumps once per open on Android.**
  `mobile/src/ui/screen.tsx:63`, `:73-90`. Confirmed, agent.
- [ ] **MR-22. Each skeleton runs its own animation loop.**
  `mobile/src/ui/screen.tsx:338-345`. Confirmed, agent.

---

## Checked and found fine

- Concurrent 401s share one token refresh (`mobile/src/api/client.ts:52-90`).
- The three who-am-I calls are not a waterfall on the phone.
- Query defaults: 60 s stale time, no refetch on focus, no foreground storm.
- Bible reader list is a tuned, virtualised `FlatList`; no JS re-render on scroll.
- Check-in replay is idempotent on the server side (`already_checked_in`).
- `checkin.scan`, `progress.services` streak and grace logic, `mark_read`,
  view counters, OTP consume, sign-up races, memberships and role assignment
  are all backed by locks or unique constraints.
- `tickets/event_views.py` is dead code: its URL file is not mounted.
- Permission checks: 2 Redis reads and no SQL on a cache hit, memoised per request.
- GZip, WhiteNoise, persistent connections and the JSON-only renderer are set
  correctly.
- Duplicate URL mounts in `backend/backend/urls.py` are clutter, not cost.
- All animations are Reanimated; timers and intervals are cleared.
