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
| `PAYSTACK_SECRET_KEY` | Server-side Paystack key. Required for payment processing and webhooks. |
| `PAYSTACK_PUBLIC_KEY` | Client-side key. |

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

```
SECRET_KEY=...
DEBUG=False
ALLOWED_HOSTS=faithtribe.app,api.faithtribe.app
DATABASE_URL=postgres://...
REDIS_URL=redis://...
FRONTEND_URL=https://faithtribe.app
PAYSTACK_SECRET_KEY=...        # if paid events at launch
PAYSTACK_PUBLIC_KEY=...
BREVO_SMTP_KEY=...             # if email at launch
BREVO_SMTP_USER=...
```

Add the VAPID / push block when enabling notifications, and the OTP provider when
enabling phone auth. Confirm the whole set with `verify_deployment` — its "critical
settings" check reads several of these directly.
