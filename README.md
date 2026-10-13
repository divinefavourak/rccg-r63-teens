<p align="center">
  <img src="docs/assets/rccg-junior-church-global.png" alt="The Redeemed Christian Church of God, Junior Church Global" width="213" height="96">
  &nbsp;&nbsp;&nbsp;
  <img src="frontend/src/assets/site/logos/faith-tribe.webp" alt="Faith Tribe, Region 63 Junior Church" width="96" height="96">
</p>

<h1 align="center">Faith Tribe</h1>

Faith Tribe is a discipleship platform for teenagers in the Redeemed Christian Church of God. A teen opens it for the day's devotional and its verse, reads the Bible, registers and pays for camp, and keeps a ticket on their phone. Teachers and coordinators run their classes, events and content from the same system.

It is first deployed for **RCCG Region 63**, and this repository was called *RCCG R63 Teens* before the product had a name. Region 63 is a tenant, not the product: nothing in the code may name it.

| | Address |
|---|---|
| Website and Console | <https://www.thefaithtribe.live> |
| Web app (for iPhones) | <https://app.thefaithtribe.live> |
| API | <https://api.thefaithtribe.live/api/v1> |
| Android app | An `.apk` linked from the website. It is not in the Play Store yet. |

## Contents

- [What is in this repository](#what-is-in-this-repository)
- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Running it locally](#running-it-locally)
- [Environment variables](#environment-variables)
- [Tests and checks](#tests-and-checks)
- [The API](#the-api)
- [Roles and the church hierarchy](#roles-and-the-church-hierarchy)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

## What is in this repository

One API and three things that talk to it.

| Folder | What it is | Stack |
|---|---|---|
| [`backend/`](backend) | The API. Every client reads and writes through it. | Django 5.2, Django REST Framework, PostgreSQL, Redis, Celery |
| [`frontend/`](frontend) | The public website, event registration on the web, and the **Console** for leaders at `/admin`. | React 19, TypeScript, Vite 7, Tailwind |
| [`mobile/`](mobile) | The teen app, with teacher tools inside it. The same code builds the Android app and the web app that iPhone users add to their Home Screen. | Expo SDK 57, React Native 0.86, expo-router, NativeWind |
| [`docs/`](docs) | The product handbook, the design notes and the operations runbooks. | Markdown |

```
rccg-r63-teens/
├── backend/
│   ├── backend/          settings, URLs, Celery schedule
│   ├── users/            accounts, sign-up, log in, one-time codes
│   ├── identity/         roles, permissions, role assignments
│   ├── hierarchy/        the church tree: parish up to national
│   ├── profiles/         a teen's profile and saved items
│   ├── today/            the Today screen, in one call
│   ├── content/          devotionals, manuals, articles
│   ├── bible/            translations, text, search, highlights and notes
│   ├── progress/         streaks, grace days, reading history
│   ├── media/            podcasts, videos, series
│   ├── events/           events, registration, bedspaces, check-in
│   ├── payments/         Squad checkout, webhook, pay links
│   ├── notifications/    inbox, push, the reminder ladder
│   ├── tickets/          the older ticketing API the website still uses
│   ├── common/           shared models, mixins, the scheduler endpoint
│   └── templates/        email templates
├── frontend/
│   └── src/              pages, components, services, stores
├── mobile/
│   ├── app/              routes (expo-router)
│   └── src/              API client, state, theme, UI kit
└── docs/
    ├── 01 … 16           the product handbook
    ├── ops/              runbooks for deploying and maintaining
    ├── design/           backend design notes, by phase
    └── adr/              architecture decision records
```

## What it does

**For a teen**

- **Today.** One devotional a day (Teenage Open Heavens), its memory verse as the Verse of the Day, and a daily challenge taken from the devotional's Action Point.
- **Bible.** A built-in reader with several translations. A whole translation can be kept on the phone and read with no signal.
- **Library.** Articles, podcasts, videos and the weekly teaching manuals.
- **Events.** Register for a camp or conference, pay through Squad or send a parent a pay link, and hold a QR ticket.
- **Progress.** Streaks with grace days, and reminders that stop for the day once the devotional is read.

**For teachers and coordinators**

- **Teacher tools in the app.** This week's manual, the class list, and a ticket scanner for check-in that keeps working offline.
- **The Console** on the web. People, roles, the church hierarchy, events and bedspaces, registrations and exports, content review.

## Tech stack

| Layer | Technology |
|---|---|
| API | Django 5.2, Django REST Framework, drf-spectacular |
| Database | PostgreSQL 16 |
| Cache and queue | Redis, Celery |
| Sign-in | JWT (`djangorestframework-simplejwt`), one-time codes by email |
| Payments | Squad |
| File storage | Cloudflare R2, through `django-storages` |
| Email | Brevo |
| Push | Expo push (Android), Web Push (the web app) |
| Website and Console | React 19, TypeScript, Vite 7, Tailwind, Zustand, React Query, React Hook Form, Zod |
| App | Expo SDK 57, React Native 0.86, expo-router, NativeWind, Reanimated, React Query |
| Hosting | Render (API), Vercel (website and web app), Expo EAS (Android builds) |

## Running it locally

You need:

- **Python 3.12**
- **Node.js 20** or newer, with npm
- **Docker**, for the local PostgreSQL and Redis
- **Git**

```bash
git clone https://github.com/divinefavourak/rccg-r63-teens.git
cd rccg-r63-teens
```

### 1. The backend

Start PostgreSQL and Redis:

```bash
cd backend
docker compose up -d
```

This gives you Redis on port 6379 and an empty database on port 5434. Redis is not optional: without it every request waits several seconds on a refused connection.

Create the environment and install:

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

In `backend/.env`, set a `SECRET_KEY` and point the database at the container:

```
DATABASE_URL=postgres://faithtribe:faithtribe@localhost:5434/faithtribe
```

> **Never put the production `DATABASE_URL` in a local `.env`.** Anything you run would read and write real people's data, and with the Brevo keys set it would send them real email.

Then:

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

`0.0.0.0` lets a phone on the same Wi-Fi reach the API. Plain `runserver` only answers on the computer itself.

A new database has no church hierarchy, no Bible text and no devotionals, so the app will look empty. [`docs/ops/02-fresh-installation.md`](docs/ops/02-fresh-installation.md) walks through filling it. The short version:

```bash
python manage.py import_bible web.json        # Bible text
python manage.py scrape_devotional            # today's devotional
python manage.py verify_deployment            # says what is still missing, and the command that fixes it
```

### 2. The website and Console

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

It runs at <http://localhost:5173>. The Console is at `/admin`.

### 3. The app

```bash
cd mobile
npm install
npx expo start
```

Press `a` for an Android emulator, scan the QR code with Expo Go on a phone, or run `npx expo start --web` to open it in a browser. With `EXPO_PUBLIC_API_URL` unset, the app finds the API on the computer serving the bundle, port 8000, so a phone on the same Wi-Fi works with nothing to configure.

Push notifications, the check-in camera and release builds need more than Expo Go. All of that is in [`mobile/README.md`](mobile/README.md).

### Timed tasks

Daily reminders, the devotional scrape and event reminders run on a schedule. Locally, start a worker and beat from `backend/`:

```bash
celery -A backend worker --loglevel=info
celery -A backend beat --loglevel=info
```

Most work does not need them. Production has no worker at all; see [Deployment](#deployment).

## Environment variables

Each part has an `.env.example` to copy. These are the settings you are most likely to touch. The full list for the backend, with what breaks when each is wrong, is in [`docs/ops/07-production-secrets.md`](docs/ops/07-production-secrets.md).

### `backend/.env`

| Variable | What it is |
|---|---|
| `SECRET_KEY` | Django's signing key. No default. |
| `DEBUG` | `True` locally. Must be `False` in production. |
| `ALLOWED_HOSTS` | Comma-separated hostnames. |
| `DATABASE_URL` | PostgreSQL connection string. Left unset it falls back to SQLite, which some migrations cannot run on. |
| `REDIS_URL` | Defaults to `redis://localhost:6379/0`, which is the Docker container. |
| `TEST_DATABASE_URL` | Used only by `manage.py test`. |
| `SCRIPTURE_TIMEZONE` | The timezone that decides what "today" is. `Africa/Lagos`. |
| `CORS_ALLOWED_ORIGINS` | Every browser address allowed to call the API. |
| `FRONTEND_URL` | The website's address, used in email links. |
| `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`, `BREVO_API_KEY`, `DEFAULT_FROM_EMAIL` | Email. |
| `OTP_PROVIDER` | How one-time codes are sent. |
| `SQUAD_SECRET_KEY`, `PUBLIC_API_URL`, `PAY_LINK_BASE` | Payments. A key starting `sandbox_sk_` goes to Squad's sandbox. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` | File storage. |
| `SCHEDULER_SECRET`, `CELERY_TASK_ALWAYS_EAGER` | Timed tasks where there is no Celery worker. |

### `frontend/.env`

| Variable | What it is |
|---|---|
| `VITE_API_URL` | The API, for example `http://localhost:8000/api`. |
| `VITE_PUBLIC_AGENT_USERNAME`, `VITE_PUBLIC_AGENT_PASSWORD` | The account public event registrations are made under when nobody is signed in. |
| `VITE_ANDROID_APP_URL`, `VITE_WEB_APP_URL` | Where the landing page sends a teen for the app. Both have defaults. |

### `mobile/.env`

| Variable | What it is |
|---|---|
| `EXPO_PUBLIC_API_URL` | The API, ending in `/api/v1`. Leave it unset in development. |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | Web Push for the web app. Without it the web app works, with no notifications. |

## Tests and checks

**Backend.** The tests want a local database, because a remote one makes the suite take many minutes:

```bash
cd backend
docker compose -f docker-compose.test.yml up -d
python manage.py test
```

`TEST_DATABASE_URL` in `.env.example` already points at that container, on port 5433.

**Website**

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

**App**

```bash
cd mobile
npm run typecheck
npm run doctor
```

What has been tried on real phones, and the results, is in [`mobile/TESTING.md`](mobile/TESTING.md).

## The API

Everything current is under `/api/v1/`:

| Path | Covers |
|---|---|
| `/api/v1/auth/` | Sign-up, log in, one-time codes, token refresh |
| `/api/v1/identity/` | Roles, permissions, a teacher's class |
| `/api/v1/hierarchy/` | The church tree |
| `/api/v1/profiles/` | Profiles and saved items |
| `/api/v1/today/` | The Today screen and the daily challenge |
| `/api/v1/content/` | Devotionals, manuals, articles |
| `/api/v1/bible/` | Bible text, search, the personal layer |
| `/api/v1/progress/` | Streaks, grace days, history |
| `/api/v1/media/` | Podcasts, videos, series |
| `/api/v1/events/` | Events, registrations, check-in |
| `/api/v1/payments/` | Checkout, the Squad webhook, pay links |
| `/api/v1/notifications/` | Inbox, devices, push |

With the server running:

- **Swagger UI:** <http://localhost:8000/docs/>
- **ReDoc:** <http://localhost:8000/api/schema/redoc/>
- **Health check:** <http://localhost:8000/health/>

Unversioned paths under `/api/` still exist for older pages of the website. New code should use `/api/v1/`.

## Roles and the church hierarchy

The church is a tree: **Parish → Area → Zone → Province → Region → National**. A person belongs to a parish. A role is always held *at a place in the tree*, for example "coordinator of this province", and reaches everything beneath that place and nothing outside it.

Roles grant permissions such as publishing content, managing an event or checking people in. Code checks the permission, never the role's name. The server decides what someone may see or do; hiding a button in a client is for convenience only.

The design is in [`docs/design/phase1-hierarchy-rbac.md`](docs/design/phase1-hierarchy-rbac.md). Setting up the first roles and the tree is in [`docs/ops/04-rbac-bootstrap.md`](docs/ops/04-rbac-bootstrap.md) and [`05-hierarchy-bootstrap.md`](docs/ops/05-hierarchy-bootstrap.md).

## Deployment

| Part | Host | How it deploys |
|---|---|---|
| API | Render | Builds `main` and runs [`backend/build.sh`](backend/build.sh): install, collect static files, migrate, then a few safe-to-repeat repair commands. |
| Website and Console | Vercel, root `frontend` | Builds `main`. |
| Web app | Vercel, root `mobile` | A second Vercel project. It is the app exported for the web. |
| Android app | Expo EAS | Built on Expo, then copied into the R2 bucket with `npm run release`, so the download address never changes. Steps in [`mobile/README.md`](mobile/README.md#releasing-an-android-build). |

There is no Celery worker in production. An outside timer calls `POST /api/v1/scheduler/tick/` every five minutes and the API runs whatever is due. See [`docs/ops/10-scheduler-without-a-worker.md`](docs/ops/10-scheduler-without-a-worker.md).

After any deployment, run:

```bash
python manage.py verify_deployment
```

It checks migrations, settings, roles, the hierarchy, Bible text, today's devotional and push, and prints the command that fixes each thing it finds wrong. The runbooks for a first deployment, a fresh database, rollback and the rest are in [`docs/ops/`](docs/ops/README.md).

## Documentation

| Where | What |
|---|---|
| [`docs/README.md`](docs/README.md) | The product handbook: start here. Vision, personas, navigation, feature specs, the design system, and the rules that are not up for debate. |
| [`docs/15-technical-architecture.md`](docs/15-technical-architecture.md) | The architecture and the rules it binds the code to. |
| [`docs/ops/`](docs/ops/README.md) | Runbooks for deploying and maintaining the backend. |
| [`docs/design/`](docs/design) | Backend design notes, by phase. |
| [`docs/adr/`](docs/adr) | Architecture decision records. |
| [`docs/BACKEND-AUDIT.md`](docs/BACKEND-AUDIT.md) | The backend refactor plan and where it stands. |
| [`docs/PERF-CONCURRENCY-AUDIT.md`](docs/PERF-CONCURRENCY-AUDIT.md) | Performance and concurrency findings, with the status of each. |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | The history of major product decisions. |
| [`mobile/README.md`](mobile/README.md) | Everything about the app: layout, push, the web app, releases. |

When a change makes the code differ from what the handbook says, update the handbook in the same pull request.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. In short: branch from `main`, name the branch `feat/…`, `fix/…`, `chore/…` or `docs/…`, write commit messages as `type(scope): summary`, and open a pull request against `main`.

Never commit `.env` files, the Firebase service account key, or any other secret.

## Maintainer

**Divine-favour Solomon Akanbi**, project lead and full-stack developer.
