# RCCG R63 Teens

A comprehensive youth ministry web platform for the **Redeemed Christian Church of God, Region 63**. It powers event registration, daily devotionals, media content, and administrative management for teens, coordinators, and admins.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup (Django)](#2-backend-setup-django)
  - [3. Frontend Setup (React + Vite)](#3-frontend-setup-react--vite)
- [Environment Variables](#environment-variables)
  - [Backend .env](#backend-env)
  - [Frontend .env](#frontend-env)
- [Running the Project](#running-the-project)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Key Features](#key-features)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Contributors](#contributors)

---

## Project Overview

RCCG R63 Teens serves as:

- **Event Registration System** — teens register for church events (campouts, conferences, etc.), receive QR-code tickets, and pay via Paystack
- **Daily Devotional Platform** — Teenage Open Heaven daily Bible readings with reading streaks and engagement tracking
- **Content Hub** — manuals (weekly teaching materials), podcasts, videos, and media series
- **Administrative Hub** — admin and coordinator dashboards with analytics, bulk operations, and content management

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| State Management | Zustand, React Hook Form, Zod |
| Backend | Django 5, Django REST Framework |
| Database | PostgreSQL |
| Cache | Redis |
| Task Queue | Celery + AMQP |
| Authentication | JWT (djangorestframework-simplejwt) |
| Payments | Paystack |
| File Storage | Cloudflare R2 (via django-storages) |
| Email | Brevo (SMTP) |
| API Docs | drf-spectacular (Swagger / ReDoc) |

---

## Prerequisites

Make sure the following are installed on your machine:

- **Python** 3.11 or higher
- **Node.js** 18 or higher + **npm**
- **PostgreSQL** (running locally or via a connection URL)
- **Redis** (running locally, default port 6379)
- **Git**

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/divinefavourak/rccg-r63-teens.git
cd rccg-r63-teens
```

---

### 2. Backend Setup (Django)

```bash
# Navigate into the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Copy the example env file and fill in your values
cp .env.example .env
# Edit .env with your actual credentials (see Environment Variables section)

# Apply database migrations
python manage.py migrate

# (Optional) Create a superuser for the admin panel
python manage.py createsuperuser

# (Optional) Seed devotional content from the scraper
python manage.py scrape_devotional

# (Optional) Create provincial coordinator accounts
python manage.py create_provincial_users

# Start the development server
python manage.py runserver
```

The backend API will be available at `http://localhost:8000`.

---

### 3. Frontend Setup (React + Vite)

Open a new terminal tab/window:

```bash
# Navigate into the frontend directory
cd frontend

# Install Node dependencies
npm install

# Copy the example env file and fill in your values
cp .env.example .env
# Edit .env with your actual API URL

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## Environment Variables

### Backend `.env`

Located at `backend/.env`. Copy from `backend/.env.example`.

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | Django secret key | `your-secret-key-here` |
| `DEBUG` | Enable debug mode | `True` |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts | `localhost,127.0.0.1` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgres://user:pass@localhost:5432/dbname` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` |
| `BREVO_SMTP_USER` | Brevo SMTP username/email | `your@email.com` |
| `BREVO_SMTP_KEY` | Brevo SMTP API key | `your-brevo-key` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key | `sk_test_...` |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key | `pk_test_...` |
| `FRONTEND_URL` | Frontend base URL for email links | `http://localhost:3000` |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | — |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key | — |
| `R2_ACCOUNT_ID` | Cloudflare account ID | — |
| `R2_BUCKET_NAME` | R2 bucket name | `rccg-r63-media` |

### Frontend `.env`

Located at `frontend/.env`. Copy from `frontend/.env.example`.

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api` |
| `VITE_PUBLIC_AGENT_USERNAME` | Agent account username | — |
| `VITE_PUBLIC_AGENT_PASSWORD` | Agent account password | — |

---

## Running the Project

To run the full application you need three services running simultaneously:

| Service | Command | URL |
|---|---|---|
| Django backend | `python manage.py runserver` | http://localhost:8000 |
| React frontend | `npm run dev` | http://localhost:5173 |
| Redis | `redis-server` | localhost:6379 |

Optionally, start Celery for background tasks (email sending, etc.):

```bash
# From the backend/ directory, with venv activated
celery -A backend worker --loglevel=info
```

---

## Available Scripts

### Backend

| Command | Description |
|---|---|
| `python manage.py runserver` | Start development server |
| `python manage.py migrate` | Apply database migrations |
| `python manage.py makemigrations` | Create new migrations |
| `python manage.py createsuperuser` | Create an admin user |
| `python manage.py scrape_devotional` | Scrape and import devotionals |
| `python manage.py create_provincial_users` | Seed coordinator accounts |
| `python manage.py test_emails` | Test email configuration |

### Frontend

| Command | Description |
|---|---|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

---

## Project Structure

```
rccg-r63-teens/
├── frontend/                  # React + TypeScript + Vite SPA
│   ├── src/
│   │   ├── pages/             # Route-level page components
│   │   ├── components/        # Shared UI components
│   │   ├── context/           # React Context (Auth, Notifications)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # Axios API service modules
│   │   ├── store/             # Zustand state stores
│   │   ├── types/             # TypeScript type definitions
│   │   ├── utils/             # Helper utilities
│   │   └── schemas/           # Zod validation schemas
│   ├── public/                # Static assets
│   └── package.json
│
└── backend/                   # Django + DRF API
    ├── backend/               # Django project settings & URLs
    ├── users/                 # User auth and role management
    ├── profiles/              # Teen profile data
    ├── content/               # Devotionals app
    ├── media/                 # Podcasts and media series
    ├── events/                # Event management
    ├── tickets/               # Ticketing (legacy)
    ├── payments/              # Paystack payment processing
    ├── common/                # Shared models and mixins
    ├── templates/             # Email HTML templates
    └── requirements.txt
```

---

## User Roles

| Role | Access |
|---|---|
| **Teen** | Register for events, view devotionals, consume content, track reading streaks |
| **Coordinator** | Manage registrations for their province, view provincial stats |
| **Admin** | Full system access — user management, content CRUD, analytics, bulk operations |
| **Individual** | Limited access for non-teen registered users |

---

## Key Features

- Multi-role authentication with JWT
- Event registration with QR-code PDF tickets
- Paystack payment integration with proof-of-payment upload
- Daily Teenage Open Heaven devotionals with reading streaks
- Weekly teaching manuals and podcast/media series
- Bulk user registration and email dispatch
- Admin dashboard with charts and statistics (Recharts)
- Dark mode support
- Responsive design (mobile-first)
- Swagger / ReDoc API documentation

---

## API Documentation

Once the backend server is running, interactive API docs are available at:

- **Swagger UI**: http://localhost:8000/docs/
- **ReDoc**: http://localhost:8000/redoc/

The API is versioned under `/api/v1/`.

---

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

---

## Contributors

| Name | Role |
|---|---|
| **Divine-favour Solomon Akanbi** | Project Lead / Full-Stack Developer |
| **Koded0214h** | Frontend Developer |
| **savebiz** | Backend Developer |
