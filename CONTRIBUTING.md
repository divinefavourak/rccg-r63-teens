# Contributing to RCCG R63 Teens

Thank you for your interest in contributing! This document explains how to get involved, the workflow we follow, and the standards we expect.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Branching Strategy](#branching-strategy)
- [Making Changes](#making-changes)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

This project is part of a Christian youth ministry. All contributors are expected to:

- Be respectful and constructive in all communication
- Welcome newcomers and beginners
- Focus on what is best for the community and the project

Unacceptable behavior should be reported to the project lead.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/rccg-r63-teens.git
   cd rccg-r63-teens
   ```
3. Set the upstream remote so you can keep in sync:
   ```bash
   git remote add upstream https://github.com/divinefavourak/rccg-r63-teens.git
   ```
4. Follow the [README](./README.md) to set up both the frontend and backend locally

---

## Branching Strategy

We use the following branch naming conventions:

| Branch | Purpose |
|---|---|
| `main` | Production-ready code — do **not** push directly |
| `dev` | Integration branch for ongoing development |
| `feature/<short-description>` | New feature work |
| `fix/<short-description>` | Bug fixes |
| `chore/<short-description>` | Maintenance tasks, refactors, dependency updates |
| `docs/<short-description>` | Documentation-only changes |

**Always branch off `dev`**, not `main`:

```bash
git checkout dev
git pull upstream dev
git checkout -b feature/your-feature-name
```

---

## Making Changes

1. Make your changes in your feature branch
2. Write or update tests where applicable
3. Run the linter and make sure there are no errors:

   **Frontend:**
   ```bash
   cd frontend
   npm run lint
   ```

   **Backend:**
   ```bash
   cd backend
   python manage.py check
   ```

4. Test your changes locally before committing:

   - Run `python manage.py runserver` for the backend
   - Run `npm run dev` for the frontend
   - Confirm nothing is broken end-to-end

---

## Commit Message Guidelines

Use clear, descriptive commit messages following this format:

```
<type>: <short summary>

[optional body — explain why, not what]
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `chore` | Refactor, dependency update, tooling |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `test` | Adding or updating tests |

**Examples:**

```
feat: add QR code download button to ticket preview
fix: resolve coordinator dashboard pagination error
docs: update README with backend environment variables
chore: upgrade Vite to v7
```

---

## Pull Request Process

1. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a Pull Request against the `dev` branch of the upstream repository

3. Fill in the PR template:
   - **What does this PR do?** — short description
   - **How to test it** — steps for the reviewer
   - **Screenshots** — if there are UI changes

4. Request a review from at least one team member

5. Address any review comments before merging

6. Once approved, a maintainer will merge the PR

> **Do not merge your own PRs** without a review unless it is a trivial documentation fix.

---

## Code Style

### Frontend (TypeScript / React)

- Use **functional components** with hooks — no class components
- Use **Zod** for all form validation schemas
- Store global state in **Zustand** stores
- Keep components small and single-purpose
- Use Tailwind utility classes; avoid custom CSS unless necessary
- File naming: `PascalCase` for components, `camelCase` for utilities/hooks

### Backend (Python / Django)

- Follow **PEP 8** — 4-space indentation, max line length 119
- Use **class-based views** and DRF `ModelViewSet` where appropriate
- Keep business logic in `services.py` files, not views
- All new models must include `TimestampMixin` and `UUIDMixin` from `common`
- Add DRF Spectacular schema decorators to new API endpoints
- Use environment variables for all secrets — never hardcode credentials

---

## Reporting Bugs

Before opening an issue, check if the bug has already been reported.

When filing a bug, include:

1. A clear title describing the problem
2. Steps to reproduce the issue
3. Expected behavior vs actual behavior
4. Screenshots or error logs if available
5. Your environment (OS, browser, Python/Node version)

---

## Suggesting Features

Open a GitHub Issue with the label `enhancement` and include:

1. A description of the feature and why it is needed
2. How it fits the project's goals
3. Any design ideas or mockups (optional)

Large features should be discussed in an issue before a PR is opened.

---

Thank you for contributing to RCCG R63 Teens!
