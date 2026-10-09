# FaceOff — You Have a Voice

FaceOff is a social platform for live, unscripted, one-on-one ten-minute video debates — "the Fight Club for Ideas", where the fight is between arguments, never between people.

This repository is the production-oriented MVP:

| Workspace | What it is |
|---|---|
| `apps/web` | Next.js 16 (App Router, TypeScript, Tailwind 4) — public website, signed-in web app, admin console **and** the `/api/v1` REST API used by web and mobile |
| `apps/mobile` | Expo SDK 54 / React Native 0.81 app (iOS + Android) using the same API, validation and design tokens |
| `packages/shared` | Domain logic shared by both apps: debate state machine, ranking, validation schemas, constants, API types, design tokens |
| `db/migrations` | Version-controlled PostgreSQL migrations, including Row Level Security |
| `docs/` | Product, architecture, schema, API, security, testing, deployment, roadmap and cost documents |

## Status at a glance

See [docs/FEATURE_STATUS.md](docs/FEATURE_STATUS.md) for the full matrix (implemented / tested / configured / deployed). In short:

- **Working and tested locally**: accounts, onboarding, Walls, communities, motions, swipe-to-challenge, challenge lifecycle, server-authoritative debate state machine and 10-minute clock, audience comments/reactions/polls, notifications, sharing/OG images, reporting/blocking/muting, moderation + appeals, admin console, analytics dashboard.
- **Implemented, credentials configured, not yet verified end to end**: LiveKit live video (the build environment's network blocks LiveKit Cloud; tokens and grants are verified).
- **Implemented, not configured**: recording/replays (LiveKit Egress → S3), transactional email (Resend), S3 storage.
- **Not deployed yet**: no staging/production environment exists. See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md).

## Architecture in one paragraph

Both clients call one API (`apps/web/src/app/api/v1`). The API authenticates with an opaque session token (httpOnly cookie on web, `Authorization: Bearer` on mobile), validates input with shared Zod schemas, and talks to PostgreSQL through two doors: `asUser()` runs queries as the `authenticated`/`anon` role with Row Level Security enforcing per-user access, and `asService()` runs explicit, authorization-checked workflows (state transitions, moderation). Live video uses LiveKit (managed WebRTC SFU); the server mints short-lived, role-scoped room tokens and is the only authority on debate state and time. Details: [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md).

## Run it locally

Requirements: Node 22+, pnpm 10+, PostgreSQL 15+ (local install, Docker, or a cloud database).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local     # then edit DATABASE_URL / DATABASE_ADMIN_URL if needed
pnpm db:migrate        # creates the database, roles, schema and RLS policies
pnpm db:seed           # topics, starter communities, an admin, clearly labelled demo content
pnpm dev               # http://localhost:3000
```

- Admin sign-in: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env.local` (default `admin@faceoff.local` / `ChangeMe-Admin-2026` — change it).
- Emails (verification, password reset, notifications) are captured locally at **http://localhost:3000/dev/mailbox** while `EMAIL_DRIVER=dev`.
- Live video: set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Without them the debate room states that video isn't configured — it never fakes video.
- The scheduled sweeper (debate clock, no-shows, expiries, reminders, email) runs on every state read; in production Vercel Cron also calls `GET /api/cron/sweep` every minute.

### Mobile

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 pnpm start     # needs a development build
pnpm expo run:ios   # or run:android — builds a dev client with the native WebRTC module
```

Live video needs a development or store build (EAS or `expo run:*`); Expo Go doesn't include WebRTC. See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md#mobile-builds-eas).

## Tests

```bash
pnpm typecheck                                  # all workspaces
pnpm --filter @faceoff/web lint
pnpm --filter @faceoff/shared test              # state machine, ranking, validation (28)
pnpm --filter @faceoff/mobile test              # mobile API client & components (9)
pnpm --filter @faceoff/web test                 # RLS (23), design tokens/contrast (20), API integration (23) — needs a running server for API tests
pnpm --filter @faceoff/web test:e2e             # Playwright: core loop with 3 browsers, swipe, responsive, accessibility (29)
```

Latest recorded results are in [docs/TEST_PLAN.md](docs/TEST_PLAN.md#latest-results).

## Documents

| Document | |
|---|---|
| [Product requirements](docs/PRODUCT_REQUIREMENTS.md) | Vision, users, journeys, requirements, what's in/out of the MVP |
| [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md) | Stack, decisions (incl. deviations from the preferred stack), data flow, state machine |
| [Database schema](docs/DATABASE_SCHEMA.md) | Tables, constraints, RLS model |
| [UX and design system](docs/UX_AND_DESIGN_SYSTEM.md) | Brand, tokens, components, accessibility |
| [API specification](docs/API_SPECIFICATION.md) | Every `/api/v1` endpoint |
| [Security and privacy](docs/SECURITY_AND_PRIVACY.md) | Threat model, controls, legal questions for counsel |
| [Test plan](docs/TEST_PLAN.md) | Strategy, suites and latest results |
| [Deployment guide](docs/DEPLOYMENT_GUIDE.md) | Environments, Vercel/Supabase/LiveKit/Resend/EAS steps, launch checklist |
| [Product roadmap](docs/PRODUCT_ROADMAP.md) | Launch-critical, post-launch, Phase 2 (Sansad, premium…) |
| [Operating costs](docs/OPERATING_COSTS.md) | Indicative infrastructure and video cost model |
| [Feature status](docs/FEATURE_STATUS.md) | Implemented / tested / configured / deployed matrix |
| [External accounts](docs/EXTERNAL_ACCOUNTS.md) | Accounts and credentials needed, and who owns them |
| [Decisions and limitations](docs/DECISIONS_AND_LIMITATIONS.md) | Unresolved decisions, known limitations, risks |
| [Progress log](docs/PROGRESS_LOG.md) | What was done in each stage |
