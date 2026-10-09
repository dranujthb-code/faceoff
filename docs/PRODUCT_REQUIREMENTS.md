# FaceOff — Product Requirements (MVP)

Sources: *FaceOff Concept Note (rebranded) PDF/DOCX*, *Concept Note (detailed)*, *BRD v1.1 (DebateMe)*, *BRD v2.0/3.0 (People's Voice)*, the four Strategic House slides and the UI mockups. Where those documents disagree, this document records the decision.

## 1. Vision

Democratize public discourse: give anyone a digital stage to challenge an idea, defend a position and be heard — live, one-on-one, unscripted. Tagline **"You Have a Voice."** Positioning **"the Fight Club for Ideas"** — intellectual confrontation, never physical or personal.

**Core loop** (every design decision should reinforce it):
DISCOVER A TOPIC → FIND AN OPPONENT → SEND A CHALLENGE → GO LIVE → ATTRACT AN AUDIENCE → DEBATE → AUDIENCE REACTS → PUBLISH A REPLAY → SHARE → ATTRACT THE NEXT PARTICIPANT.

**North Star metric:** weekly completed FaceOff debates. Supporting: challenge acceptance rate, challenge-to-live conversion, participant retention, audience watch time.

## 2. Problem

TV debates are scripted and elitist; social media is passive text with no direct verbal exchange. Text debate platforms (Kialo, Reddit) lack live confrontation; video platforms lack structure, matchmaking and fairness (equal time, clear propositions, separate audience judgement).

## 3. Users

| Persona | Need |
|---|---|
| **Debater** — students, activists, professionals, opinionated generalists | A fair stage, a worthy opponent, a record of their arguments (their Wall) |
| **Viewer** | Watch real people argue live, react, judge the arguments, share clips/links |
| **Community organiser** — university societies, civic groups | A home for their topic, motions to debate, scheduled events |
| **Trust & Safety moderator / admin** | Fast triage of reports, proportionate enforcement, audit trail, metrics |

All users are 18+ (BRD v2/v3).

## 4. Decisions where the sources differ

| Topic | Sources | MVP decision |
|---|---|---|
| Name | DebateMe / People's Voice / FaceOff | **FaceOff** (latest rebranded concept note) |
| "Unmoderated" | Concept: no moderators; BRD v3: post-reporting only | **No live moderator in the room**; reporting, blocking, muting, account controls and post-hoc enforcement with appeals are mandatory platform safeguards |
| Matchmaking | BRD v2/v3: AI persona & AI matchmaking | **Transparent rules-based ranking** (shared topics/communities, availability, open motions, activity) with "why you're seeing this". AI-assisted matching is Phase 2 and must stay explainable |
| Social login | BRD: Instagram/Facebook/Twitter | **Email + password** first; Google/Apple/phone sign-in planned (architecture ready) |
| Simulcast to YouTube/Instagram/X/TikTok | Concept & BRDs | **FaceOff-native first.** External streaming is a separate capability added platform by platform after eligibility/API checks (Phase 2) |
| "Comrades" (friends) | BRD v1 | **Follow** model (asymmetric). Mutual follows act as comrades; challenge eligibility can be limited to "people I follow" |
| Topic proposals need 20% support | BRD | **Implemented**: community motions list at 20% of members (min 3 supporters) |
| Debate House (many-to-many), Sansad | BRDs | **Phase 2** (data model has `format` and `access_tier` hooks) |
| Age, gender, phone, locality at sign-up | BRD | **Date of birth only** (18+ gate) + optional region/location. Collect less personal data; gender/phone are not needed for the core loop |
| Voting | Concept: "upvote participants" | **Two separate polls**: "Who argued more persuasively?" and "Which position do you support?" Never presented as factual truth |
| Monetisation | Concept: ads, IAP, subscriptions, Sansad | **None in MVP.** Entitlements table + `access_tier` field prepared; no payments until model, providers and store rules are evaluated |

## 5. Functional requirements (MVP)

### 5.1 Accounts and onboarding
- Email + password sign-up with 18+ date-of-birth gate and recorded acceptance of Terms/Guidelines (consent ledger).
- Email verification (required to send challenges or post motions), password reset (no account enumeration), change password (signs out other sessions), sign out, delete account.
- Onboarding: display name, unique username, region → topics (multi-select) → communities (optional) → bio/avatar (optional).
- Avatar upload: re-encoded to 512×512 WebP, metadata (incl. GPS) stripped.

### 5.2 FaceOff Walls
- Public profile with bio, region, topics, communities, follower/following counts, completed debates, motions; upcoming, live and past debates; follow, send-a-challenge, share, mute, block, report.
- Owner controls: Wall visibility (everyone / followers), challenge eligibility (everyone / people I follow / nobody), blocked list.
- Stable URLs `/u/{username}` with Open Graph images.

### 5.3 Topics, communities, motions, discovery
- Admin-configurable topics (categories) and communities; join/leave; member counts.
- Community page: ongoing, planned and past debates; listed and proposed motions; propose a motion (members), support motions.
- Motions on Walls ("I'll defend this") are listed immediately; community motions list at 20% support.
- Discover: live / upcoming / replays, topic filter, search across debates, people and communities. Trending motions ranked by recent challenges, debates and support.
- Home feed ranked by a published formula (recency, your topics/communities, people you follow, real participation). Controversy and report counts are **not** ranking signals.

### 5.4 Swipe-to-challenge and the challenge lifecycle
- Deck of potential opponents (people who would accept a challenge from you), filters (topic, available now), reasons shown on each card. Swipe right = challenge, left = skip for 7 days. Keyboard (←/→) and button alternatives; screen-reader actions on mobile.
- "Available now" status (up to 3 h) for instant FaceOffs.
- Challenge = challenger, recipient, proposition, optional context and ground rules, sides (locked when challenging someone's motion), instant or scheduled time, recording request, public/unlisted.
- Status: pending → accepted / declined / cancelled / expired → completed. Recipient can accept, decline (optional reason) or propose another time (then the challenger must respond). Instant challenges expire after 15 minutes; scheduled ones at the proposed time.
- One active challenge per pair; blocked users and eligibility settings respected server-side; rate-limited.

### 5.5 Live debate
- Server-authoritative state machine: CREATED → SCHEDULED → READY (green room, opens 15 min before) → LIVE → COMPLETED, plus CANCELLED, FAILED (no-show after 10 min) and INTERRUPTED (a debater gone > 90 s).
- Green room: debate rules, recording disclosure and consent (either debater can veto recording), device check. The 10-minute clock starts when both are ready; ends are enforced by the server (lazy evaluation on every read + per-minute sweeper); clients render the server clock with RTT-corrected offset.
- Room: two video tiles (For/Against), mute/camera, connection and reconnecting states, timer, viewer count, host can end early, either debater can leave (grace period) or cancel before start.
- Video via LiveKit with server-minted, role-scoped tokens. When video isn't configured the room says so; it never simulates video.

### 5.6 Audience
- Watch (signed out allowed), comment (signed in), react (live only), vote in two clearly defined polls (one vote per person per poll, changeable while open; debaters can't vote on their own persuasion poll; polls stay open 24 h after the debate), share, save, report.
- Viewer counts are approximate (30-second presence).

### 5.7 Replays
- Recording only with both debaters' consent; LiveKit Egress room composite to S3-compatible storage; replay shown only after the provider confirms success (webhook). Results page shows end reason, poll results and replay or an honest "no replay" message.

### 5.8 Notifications and sharing
- In-app notification centre: challenges (received/accepted/declined/rescheduled/cancelled/expired), reminders, debate results, followers, community debates, motion listed, replay ready, moderation notices. Per-category preferences, de-duplication, email copies for key events (Resend). Push: planned (Expo Notifications plugin included).
- Share links with Open Graph images for debates and Walls; sitemap and robots.

### 5.9 Trust & Safety
- Report user, debate, comment, motion with reasons; urgent reasons (threats, child safety, self-harm, doxxing) prioritised.
- Block (hides Wall, prevents challenges, follows and comments; cancels pending challenges), mute (hides comments).
- Moderation actions: warn, hide/restore comment/debate/motion, stop a live debate, suspend (time-limited), lift, ban (admin only). Each records a reason, notifies the subject and can be appealed; a different moderator decides appeals. Append-only audit log.
- Suspended users can read, report and block but can't debate, comment, vote or post.

### 5.10 Admin console
- Overview metrics, reports queue, appeals, debates and live sessions (stop/hide/restore), users (search, roles, warn/suspend/ban), communities and topics editor (featured flags, ordering, archive), support inbox, audit log (admins only).

### 5.11 Analytics
- Privacy-conscious events (no IPs, no user agents, no free text). Dashboard: North Star series, sign-ups, email confirmation and onboarding completion, active and returning users, community joins, challenges sent/accepted/declined/expired, acceptance rate, challenge→live conversion, debates started/completed/interrupted/no-show, average watch time, comments/votes/reactions, replay views/shares, reports and enforcement rates, weekly cohort retention. Demo content excluded by default.

## 6. Non-functional requirements

| Area | Requirement (MVP) |
|---|---|
| Security | RLS on every table; privileged keys server-only; hashed session tokens; scrypt passwords; CSRF origin checks; rate limits; security headers |
| Privacy | Minimal data collection; private emails/DOB/votes; data deletion; consent ledger |
| Accessibility | WCAG 2.1 AA (automated axe checks pass on key screens), keyboard alternatives for swipe, screen-reader labels |
| Performance | Server-rendered pages; 2.5 s polling during live sessions plus LiveKit data pushes; pooled Postgres connections |
| Reliability | Idempotent, row-locked state transitions; graceful video/network degradation; time-based transitions survive client crashes |
| Platforms | Responsive web (phone to desktop); iOS and Android via Expo |

## 7. Out of scope for the MVP

Payments and paywalls, Sansad and many-to-many Debate Houses, celebrity/Prime Time programming, external simulcast, AI matchmaking/moderation/sentiment scoring, social and phone sign-in, push notifications delivery, in-app wall posts/vlogs/galleries (BRD v1 "Facebook-like" wall media), Google Calendar integration.
