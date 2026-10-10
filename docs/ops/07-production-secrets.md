# 07 — Production secrets

Every environment variable the backend reads, grouped by how much damage a wrong
value does. Extracted from `backend/backend/settings.py`; if that file gains a
variable and this table does not, this table is wrong.

Never commit secret values. Set them in the deployment platform's secret store.

---

## Load-bearing — wrong or unset means insecure or broken

| Variable | Notes |
|---|---|
| `SECRET_KEY` | Django signing key. Unset ⇒ sessions, password-reset tokens, and signed cookies all break. **No default — must be set.** |
| `DEBUG` | Must be `False` in production. `True` leaks tracebacks and settings. Default is `False`; `verify_deployment` fails if it is on. |
| `ALLOWED_HOSTS` | Comma-separated real hostnames. **Defaults to `*`**, which defeats Host-header validation — the single most likely thing to be wrong on launch day. `verify_deployment` fails on `*`. |
| `DATABASE_URL` | Postgres connection string. Unset ⇒ falls back to local SQLite, which several migrations cannot run on. |
| `REDIS_URL` | Cache + Celery broker. Backs DRF throttling (fails open if Redis blips) and every scheduled task. |

## Payments — required before events with paid tickets

| Variable | Notes |
|---|---|
| `SQUAD_SECRET_KEY` | Squad's secret key, from **Profile → API & Webhook** on its dashboard. Required for payment processing and webhooks. A sandbox key starts `sandbox_sk_` and is sent to `sandbox-api-d.squadco.com`; any other key is sent to live, `api-d.squadco.com`. It also signs the webhook, so a sandbox key and a live key are not interchangeable. Setting it switches on the release of unpaid places (see below). |
| `PUBLIC_API_URL` | The API's own address from outside, e.g. `https://api.faithtribe.app`, with no path. Squad sends each payer back to `<this>/api/v1/payments/return/<reference>/`. Unset ⇒ the address of the request is used, which behind the host's proxy comes out as `http://`. |
| `UNPAID_REGISTRATION_HOLD_HOURS` | How long an unpaid place on a paid event is held. Default `24`. `0` never releases one. |
| `MOBILE_APP_SCHEME` | The phone app's link scheme, default `faithtribe` (`mobile/app.json`). The page after payment links back to the app only at an address with this scheme, or at an origin in `CORS_ALLOWED_ORIGINS` or `FRONTEND_URL`. |

In the Squad dashboard, under **Profile → API & Webhook**, set the webhook URL
to `https://<api host>/api/v1/payments/webhook` (no trailing slash). The
sandbox (`sandbox.squadco.com`) and live (`dashboard.squadco.com`) are separate
accounts, each with its own key and its own webhook URL field. Leave the
dashboard's redirect URL empty: the server names the page to come back to on
every checkout. Squad sends webhooks from `18.133.63.109`, and only for a
charge that succeeded; each carries `x-squad-encrypted-body`, an HMAC-SHA512
of the body keyed with the secret key, which the server checks.

Going live needs a live Squad account with its KYC completed.

**Before the keys go in on a database that already has registrations:** the
task that releases unpaid places starts working the moment
`SQUAD_SECRET_KEY` is set, and it counts 24 hours from when a registration
was made. Any pending, unpaid registration on a paid event that is already
older than that is cancelled on the first run, within 15 minutes. Count them
first, and either confirm the ones that should stay or set
`UNPAID_REGISTRATION_HOLD_HOURS=0` until they are dealt with.

## Email (Brevo/SMTP) — transactional mail

| Variable | Notes |
|---|---|
| `BREVO_SMTP_KEY` | SMTP key. Unset ⇒ email (receipts, tickets, verification) silently does not send. |
| `BREVO_SMTP_USER` | SMTP user. |
| `DEFAULT_FROM_EMAIL` | From address on outbound mail. |

## Push notifications — required for the habit loop

| Variable | Notes |
|---|---|
| `NOTIFICATIONS_PUSH_BACKEND` | Set to `notifications.push.WebPushBackend` for real delivery. Defaults to the logging backend. See [06](06-push-notifications.md). |
| `VAPID_PRIVATE_KEY` | Keep secret. Rotating it invalidates every existing push subscription. |
| `VAPID_PUBLIC_KEY` | The application server key the frontend subscribes with. |
| `VAPID_ADMIN_EMAIL` | Contact address in the VAPID claim. |

## Frontend / branding

| Variable | Notes |
|---|---|
| `FRONTEND_URL` | Base URL for deep links (verse shares, notification targets, email links). Unset ⇒ share links are relative and break off-app. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins. DEBUG-aware and env-driven. |
| `APP_NAME` | Product name in shared verse cards. Defaults to `Faith Tribe`. |

## Auth / OTP tuning (safe defaults; override only intentionally)

| Variable | Default | Notes |
|---|---|---|
| `OTP_PROVIDER` | `users.otp_providers.ConsoleOTPProvider` | **A no-op/console backend.** In production with DEBUG off, OTP requests fail or drop. Point at a real SMS backend (Termii / Africa's Talking) before enabling phone auth. Django's system check already warns on this. |
| `OTP_CODE_LENGTH` / `OTP_TTL_SECONDS` / `OTP_MAX_ATTEMPTS` | 6 / 600 / 5 | OTP behaviour. |
| `ENFORCE_EMAIL_VERIFICATION` | `False` | Turn on once the verification flow is live. |
| `AUTH_COOKIE_ACCESS` / `_REFRESH` | token names | JWT cookie names. |
| `AUTH_COOKIE_SECURE` | `not DEBUG` | Cookies over HTTPS only in production. |
| `AUTH_COOKIE_SAMESITE` | `Lax` | `None` requires Secure + a CSRF double-submit flow (not yet implemented); settings force Secure if you set `None`. |
| `AUTH_COOKIE_DOMAIN` | unset | Cookie domain, if scoping across subdomains. |

## App timezone

| Variable | Default | Notes |
|---|---|---|
| `SCRIPTURE_TIMEZONE` | `Africa/Lagos` | Defines the calendar-day boundary for daily content, streaks, quiet hours, and the announcement cap. Changing it moves when "today" rolls over for every teen. |

## Test-only

| Variable | Notes |
|---|---|
| `TEST_DATABASE_URL` | Points the test suite at a local Postgres. Never affects `runserver` or `migrate` — guarded on the `test` subcommand. |

---

## Minimum viable production set

```bash
SECRET_KEY=...
DEBUG=False
ALLOWED_HOSTS=faithtribe.app,api.faithtribe.app
DATABASE_URL=postgres://...
REDIS_URL=redis://...
FRONTEND_URL=https://faithtribe.app
SQUAD_SECRET_KEY=...           # if paid events at launch
PUBLIC_API_URL=https://api.faithtribe.app
BREVO_SMTP_KEY=...             # if email at launch
BREVO_SMTP_USER=...
```

Add the VAPID / push block when enabling notifications, and the OTP provider when
enabling phone auth. Confirm the whole set with `verify_deployment` — its "critical
settings" check reads several of these directly.
