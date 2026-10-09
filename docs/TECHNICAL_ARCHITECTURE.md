# Technical Architecture

## 1. System overview

```
 ┌────────────── Clients ──────────────┐
 │ Web (Next.js React, SSR + client)   │        ┌──────────── LiveKit Cloud ────────────┐
 │ iOS / Android (Expo React Native)   │◀──WebRTC media (SFU)──▶ rooms fo_<challengeId> │
 └───────────────┬─────────────────────┘        │ Egress → S3 (recordings)              │
                 │ HTTPS /api/v1 (cookie or      └───────┬───────────────▲──────────────┘
                 │ Bearer token)                         │ webhooks       │ RoomService / Egress API
 ┌───────────────▼──────────────────────────────────────▼────────────────┴──────────────┐
 │ Next.js server (Vercel Functions)                                                      │
 │  route handlers → handler() wrapper (auth, CSRF, zod, errors) → domain modules         │
 │  domain: accounts, profiles, communities, challenges, debates (state machine),         │
 │          audience, discover/feed, notifications, moderation, admin                      │
 │  asUser(uid) → SET LOCAL ROLE authenticated/anon + app.user_id  (RLS enforced)         │
 │  asService()  → SET LOCAL ROLE service_role (explicitly authorized workflows only)     │
 │  cron /api/cron/sweep (every minute): clock, no-shows, expiries, reminders, email     │
 └───────────────┬─────────────────────────────┬────────────────────────┬────────────────┘
                 │                             │                        │
        PostgreSQL 15+ (Supabase/Neon/RDS)   S3-compatible storage   Resend (email)
        schema faceoff + app (RLS)           avatars, replays
```

## 2. Stack and decisions

| Layer | Choice | Notes |
|---|---|---|
| Web | **Next.js 16** (App Router, React 19.2, TypeScript 5.9, Tailwind 4) | Preferred stack. Server components for pages; client components for interaction |
| Mobile | **Expo SDK 54** (React Native 0.81, expo-router 6) | Preferred stack. SDK 54 chosen over 57 because the LiveKit React Native SDK line used here is proven on it |
| Shared | `@faceoff/shared` TypeScript package | State machine, ranking, Zod schemas, constants, API types, design tokens — imported by both apps |
| API | Next.js route handlers under `/api/v1` | One API for web and mobile. JSON envelope `{ ok, data | error }` |
| Database | **PostgreSQL** with Row Level Security; plain SQL migrations; `postgres` (postgres.js) client | See decision D1 |
| Auth | **Own session auth** (scrypt, opaque hashed tokens, httpOnly cookie / Bearer) | See decision D1 |
| Video | **LiveKit** (Cloud) — `livekit-server-sdk`, `livekit-client`, `@livekit/react-native` | Preferred option; no custom media infrastructure |
| Recording | LiveKit **Egress** room composite → S3 | Webhook confirms success before a replay appears |
| Storage | S3-compatible (Supabase Storage S3, AWS S3, Cloudflare R2) via `aws4fetch`; local disk in development | Avatars re-encoded with `sharp` |
| Email | **Resend** HTTP API; dev outbox in development | |
| Hosting | **Vercel** (web/API + cron), managed Postgres (**Supabase** recommended), LiveKit Cloud, **EAS** for mobile builds | |
| Tests | Vitest, Jest (jest-expo) + React Native Testing Library, Playwright (+ axe-core) | |

### D1 — Supabase Auth replaced by in-app session auth; Supabase remains the recommended database/storage host

**Context.** The preferred stack was Supabase for Postgres, auth, storage and realtime. The build environment blocks Docker Hub, so the Supabase local stack could not run, which would have made auth, RLS and every core flow untestable during development.

**Decision.** Use plain PostgreSQL with Supabase-compatible roles (`anon`, `authenticated`, `service_role`) and RLS, and implement sessions in the API. Every migration runs unchanged on Supabase Postgres.

**Advantages.** Fully testable (23 RLS tests and 23 API tests run against real Postgres); one auth model for web cookies and mobile bearer tokens; no vendor lock-in for identity; server-authoritative logic stays in one place; the `faceoff` schema is not exposed through Supabase's auto-generated REST API, so the only door is the FaceOff API.

**Costs and limitations.** We own password storage, session revocation, verification and reset flows (implemented and tested). Social/phone sign-in must be added ourselves (or via an OAuth library) instead of toggled in Supabase. No Supabase Realtime: live updates use 2.5 s polling plus LiveKit data messages inside debate rooms.

**Migration path.** To adopt Supabase Auth later: map `faceoff.users.id` to `auth.users.id`, change `app.uid()` to read `auth.uid()`, issue Supabase JWTs from the client, and keep the same policies. Estimated 3–5 days plus testing.

### D2 — Realtime via polling + LiveKit data channel
Polling (`POST /debates/:id/presence` every 2.5 s while live) doubles as heartbeat and viewer counting, works on serverless hosting and survives reconnects. When video is connected, the server pushes small `comment` / `vote` / `reaction` events through LiveKit `sendData` so clients refresh immediately. Clients cannot publish data themselves (`canPublishData: false`), so all chat goes through the moderated, rate-limited API.

### D3 — Server-authoritative time
`debate_sessions.ends_at` is set by the database (`now() + duration`) when the second debater is ready. Every read of a session runs `syncSession()`, which locks the row (`SELECT … FOR UPDATE`), evaluates `evaluateTimedTransition()` from the shared state machine and applies transitions (completion, interruption, no-show) with their side effects (close the LiveKit room, stop egress, close polls, notify, analytics). The cron sweeper does the same for sessions nobody is watching. The client clock is display-only and is corrected with a round-trip-time offset.

### D4 — Presence and disconnects
Debaters send heartbeats with each poll; LiveKit `participant_joined/left` webhooks update the same fields. A debater gone for 90 s (no heartbeat or explicit leave) → `interrupted`. The 10-minute clock keeps running through a reconnect (fair to both sides, simple to explain).

### D5 — Monorepo with hoisted node_modules
`pnpm` workspaces with `node-linker=hoisted` (React Native tooling expects hoisted dependencies). The web app pins React 19.2 locally; mobile uses React 19.1 from the root.

## 3. Request lifecycle

1. `handler()` (src/lib/server/api.ts) checks CSRF for cookie-authenticated mutations (Origin must match, or the first-party `x-faceoff-client` header), loads the viewer from the session token, enforces auth mode (`none`/`optional`/`required`/`staff`/`admin`), active-account, email-verified and onboarded requirements, and parses the body with a shared Zod schema.
2. The domain function runs in `asUser()` (RLS) or `asService()` (explicit checks) — each a single transaction with `SET LOCAL`, safe with transaction-mode poolers (`prepare: false`).
3. Errors map to typed JSON (`validation_error` with field messages, `forbidden`, `rate_limited`, …); RLS rejections (`42501`) become 403 without leaking details.
4. Side effects that call external services (LiveKit, email) run after commit.

## 4. Debate state machine

```
CREATED ─▶ SCHEDULED ─▶ READY ─▶ LIVE ─▶ COMPLETED
   │           │          │        └──▶ INTERRUPTED (debater gone > 90 s)
   │           │          └──▶ FAILED (no-show 10 min after start / room opening)
   └───────────┴──────────┴──▶ CANCELLED (either debater, before LIVE)
```

| Trigger | Transition |
|---|---|
| Challenge accepted (instant) | → READY (green room open) |
| Challenge accepted (scheduled) | → SCHEDULED; READY at start − 15 min |
| Both debaters consent + ready | READY → LIVE; `ends_at = now() + 600 s`; polls opened; egress started if both consented |
| `now ≥ ends_at` | LIVE → COMPLETED (`time_elapsed`) |
| Host ends early | LIVE → COMPLETED (`host_ended`) |
| Debater absent ≥ 90 s | LIVE → INTERRUPTED (`participant_left`) |
| Not ready 10 min after start | READY/SCHEDULED → FAILED (`no_show`) |
| Trust & Safety stops it | LIVE → INTERRUPTED / earlier → CANCELLED (`admin_terminated`) |

Transitions are pure functions in `packages/shared/src/debate-state.ts` (unit-tested) applied in `apps/web/src/lib/server/domain/debates.ts` (API-tested).

## 5. LiveKit integration

| Concern | Implementation |
|---|---|
| Room | `fo_<challenge-id>`; created on demand (LiveKit also auto-creates on first join); deleted when the debate ends, which disconnects everyone |
| Debater token | `canPublish`, `canSubscribe`, no data publishing, identity `debater:<userId>`, TTL until end + 2 min; only after rules consent and only while READY/LIVE |
| Audience token | subscribe-only, `hidden`, identity `viewer:<userId>` or `anon:<tab key>`; only while LIVE |
| Recording | `startRoomCompositeEgress` (speaker layout, MP4) to S3 when both consented; `stopEgress` at the end; `egress_ended` webhook marks the replay ready or failed |
| Webhooks | `/api/webhooks/livekit`, verified with the API secret; participant join/leave feed presence |
| Fallback | Without credentials the API returns 503 `video_unavailable`, the UI says so, and production refuses to go live without video |

## 6. Mobile

Expo Router app with the same API (Bearer token in SecureStore), Zod schemas and design tokens. Screens: sign in/up/forgot, onboarding, tabs (Home, Discover, FaceOff deck, Activity, Profile), Walls, challenge composer, debate room (LiveKit via `@livekit/react-native`, loaded only when the native WebRTC module exists), settings. Requires a development/store build for video. Push notification plugin is configured; delivery is a launch follow-up.

## 7. Environments

| Env | Web | Database | Video | Email | Storage |
|---|---|---|---|---|---|
| development | `next dev` | local Postgres | optional LiveKit project | dev outbox | local disk |
| staging | Vercel preview/staging project | separate Supabase project | separate LiveKit project | Resend (test domain) | separate bucket |
| production | Vercel production | Supabase (Pro) | LiveKit (Ship) | Resend (verified domain) | bucket + CDN |

Production refuses to boot with `EMAIL_DRIVER=dev`, a weak `CRON_SECRET` or local storage, and refuses to start debates without video.
