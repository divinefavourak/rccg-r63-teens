# 06 — Push notification setup

The notification service is complete and correct with one deliberate gap:
**delivery is behind a pluggable backend, and the default only logs.** This runbook
turns on real WebPush.

Until you do this, the product behaves correctly in every respect *except the
interruption itself* — preferences are honoured, the in-app inbox fills, dedupe
works, the habit ladder runs. No teen's phone ever buzzes. For a habit-formation
product that is a real gap, but it is a safe one: nothing breaks, it just stays
quiet.

`verify_deployment` reports this as a **FAILURE in production** (DEBUG off) and a
warning in development.

---

## What WebPush needs

1. **A VAPID key pair** — identifies your server to the browser push services.
   Generate once and keep the private key secret; you normally keep the same pair
   for the life of the deployment (see *Rotating the VAPID keys* below for when and
   how to change it).

   ```bash
   pip install pywebpush py-vapid
   vapid --gen        # writes private_key.pem / public_key.pem
   vapid --applicationServerKey   # the base64 public key the frontend needs
   ```

2. **`pywebpush` installed** in the backend environment (add to `requirements.txt`).

3. **The frontend service worker** subscribed with the public key and POSTing the
   subscription to `/api/v1/notifications/push/`. (Frontend work — out of scope
   here, but the backend endpoint is ready.)

---

## Configuration

Set these secrets (see [07 — Production secrets](07-production-secrets.md)):

```bash
NOTIFICATIONS_PUSH_BACKEND=notifications.push.WebPushBackend
VAPID_PRIVATE_KEY=<contents of private_key.pem>
VAPID_PUBLIC_KEY=<base64 application server key>
VAPID_ADMIN_EMAIL=ops@yourdomain.org
```

Leave `NOTIFICATIONS_PUSH_BACKEND` unset (or at `LoggingPushBackend`) in
development so local runs never try to hit real push services.

---

## Verify

```bash
python manage.py verify_deployment    # "notification backend configured"
```

It checks, in order: the backend is `WebPushBackend`, both VAPID keys are set, and
`pywebpush` imports. Each failure names the specific missing piece.

End-to-end (needs a real browser subscription):

1. Subscribe a browser (frontend, or a manual `POST /api/v1/notifications/push/`).
2. Trigger a send — e.g. publish today's devotional and wait for a ladder tick, or
   send a test event notification.
3. Confirm the push arrives **and** the inbox row exists
   (`GET /api/v1/notifications/inbox/`). Both, always — the inbox is the durable
   record; push is the interruption.

---

## Operational notes

- **Dead endpoints self-retire.** When a browser drops a subscription, the push
  service returns 404/410; `WebPushBackend` catches it and deactivates that row
  rather than retrying forever. No manual cleanup needed.
- **One dead device never blocks the others** — each subscription is delivered
  independently, and a failure on one is logged and skipped.
- **The scheduler must be running.** The habit ladder, event reminders, and the
  devotional-gap alert are Celery beat tasks (`backend/backend/celery.py`). Push
  works without beat, but the *habit loop* does not — confirm the worker and beat
  processes are up.
- **Quiet hours and the announcement cap are timezone-correct.** They bound the day
  in Africa/Lagos, not UTC, so a 00:30-Lagos send is filed on the right day.

---

## Rotating the VAPID keys

You keep the same key pair as long as it is uncompromised. **Rotate only when the
private key may have leaked** (exposed in a log, a repo, a shared screen). Rotation
is disruptive: the VAPID key is the identity every browser subscription is bound to,
so a new key **invalidates every existing subscription** — every teen's device must
re-subscribe before it can receive a push again. There is no in-place re-key.

1. Generate a fresh pair (`vapid --gen`), set `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY`
   to the new values, and ship the new public key to the frontend.
2. Old subscriptions now fail delivery with 404/410, and `WebPushBackend` retires
   each one automatically — but until a device re-subscribes under the new key, that
   teen is inbox-only, no push.
3. Prompt clients to re-subscribe: the service worker should notice its
   `applicationServerKey` changed, call `pushManager.subscribe` again, and re-POST to
   `/api/v1/notifications/push/` (which upserts on endpoint).
4. If the rotation was prompted by a *leak*, treat it as a security incident too — a
   leaked VAPID private key lets a third party send pushes that appear to come from
   you.

Plan rotation for a low-traffic window and expect a dip in push reach until devices
re-subscribe.
