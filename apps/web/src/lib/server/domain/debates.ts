import "server-only";
import { randomBytes } from "node:crypto";
import {
  CONSENT_VERSIONS,
  DEBATE_DURATION_SECONDS,
  POLL_DEFINITIONS,
  POLL_KINDS,
  PRESENCE_STALE_SECONDS,
  REACTIONS,
  evaluateTimedTransition,
  isTerminal,
  shouldGoLive,
  type DebateCard,
  type EndReason,
  type PollKind,
  type ReactionKind,
  type SessionState,
  type SessionStatus,
  type Side,
} from "@faceoff/shared";
import { asService, asUser, type Tx } from "../db";
import { ApiError, badRequest, forbidden, notFound } from "../errors";
import { env, features } from "../env";
import * as lk from "../livekit";
import { track } from "../analytics";
import { audit } from "../audit";
import type { Viewer } from "../auth";
import { prefixedProfile, iso } from "./mappers";
import { notify } from "./notifications";

// ───────────────────────────── Debate cards ─────────────────────────────

const CARD_SELECT = `
  s.id, s.proposition, s.status, s.visibility, s.scheduled_start, s.live_started_at, s.ends_at, s.ended_at,
  s.end_reason, s.host_id, s.recording_enabled, s.is_demo, s.created_at, s.community_id,
  c.slug as community_slug, c.name as community_name,
  pf.user_id as f_user_id, pf.username as f_username, pf.display_name as f_display_name, pf.avatar_key as f_avatar_key,
  pf.is_demo as f_is_demo, pf.account_status as f_account_status,
  pa.user_id as a_user_id, pa.username as a_username, pa.display_name as a_display_name, pa.avatar_key as a_avatar_key,
  pa.is_demo as a_is_demo, pa.account_status as a_account_status,
  r.status as recording_status,
  st.comments, st.votes, st.views`;

const CARD_FROM = `
  faceoff.debate_sessions s
  join faceoff.session_participants spf on spf.session_id = s.id and spf.side = 'for'
  join faceoff.profiles pf on pf.user_id = spf.user_id
  join faceoff.session_participants spa on spa.session_id = s.id and spa.side = 'against'
  join faceoff.profiles pa on pa.user_id = spa.user_id
  left join faceoff.communities c on c.id = s.community_id
  left join faceoff.recordings r on r.session_id = s.id
  left join lateral app.session_stats(s.id) st on true`;

function replayStatus(rec: string | null): DebateCard["replayStatus"] {
  if (!rec) return "none";
  if (rec === "ready") return "ready";
  if (rec === "failed") return "failed";
  return "processing";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toDebateCard(r: any): DebateCard {
  return {
    id: r.id,
    proposition: r.proposition,
    status: r.status,
    visibility: r.visibility,
    scheduledStart: iso(r.scheduled_start),
    liveStartedAt: iso(r.live_started_at),
    endsAt: iso(r.ends_at),
    endedAt: iso(r.ended_at),
    endReason: r.end_reason,
    community: r.community_slug ? { slug: r.community_slug, name: r.community_name } : null,
    forSide: prefixedProfile(r, "f_"),
    againstSide: prefixedProfile(r, "a_"),
    hostId: r.host_id,
    recordingEnabled: r.recording_enabled,
    replayStatus: replayStatus(r.recording_status),
    stats: { comments: r.comments ?? 0, votes: r.votes ?? 0, views: r.views ?? 0 },
    isDemo: r.is_demo,
  };
}

export type DebateFilter = "live" | "upcoming" | "replays" | "recent" | "all";

export interface ListDebatesOpts {
  filter: DebateFilter;
  communityId?: string;
  userId?: string; // a Wall: debates this user took part in
  q?: string;
  limit?: number;
  includeUnlisted?: boolean; // the user's own Wall
}

export async function listDebates(opts: ListDebatesOpts, viewerId: string | null): Promise<DebateCard[]> {
  return asUser(viewerId, async (tx) => {
    const limit = Math.min(opts.limit ?? 24, 60);
    const conds = [tx`s.moderation_state = 'visible'`];
    conds.push(opts.includeUnlisted ? tx`s.visibility in ('public','unlisted')` : tx`s.visibility = 'public'`);
    if (opts.filter === "live") conds.push(tx`s.status = 'live'`);
    if (opts.filter === "upcoming") conds.push(tx`s.status in ('scheduled','ready')`);
    if (opts.filter === "replays") conds.push(tx`s.status in ('completed','interrupted')`);
    if (opts.filter === "recent") conds.push(tx`s.status in ('live','scheduled','ready','completed','interrupted')`);
    if (opts.filter === "all") conds.push(tx`s.status not in ('created')`);
    if (opts.communityId) conds.push(tx`s.community_id = ${opts.communityId}`);
    if (opts.userId) conds.push(tx`exists (select 1 from faceoff.session_participants x where x.session_id = s.id and x.user_id = ${opts.userId})`);
    if (opts.q && opts.q.trim().length >= 2) {
      const like = `%${opts.q.trim().slice(0, 60).replace(/[%_\\]/g, (c) => "\\" + c)}%`;
      conds.push(tx`(s.proposition ilike ${like} or pf.display_name ilike ${like} or pa.display_name ilike ${like} or c.name ilike ${like})`);
    }
    const where = conds.reduce((acc, c) => tx`${acc} and ${c}`);
    const order =
      opts.filter === "upcoming"
        ? tx`order by s.scheduled_start asc nulls first`
        : opts.filter === "live"
          ? tx`order by s.live_started_at desc`
          : tx`order by (s.status = 'live') desc, coalesce(s.ended_at, s.live_started_at, s.scheduled_start, s.created_at) desc`;
    const rows = await tx`select ${tx.unsafe(CARD_SELECT)} from ${tx.unsafe(CARD_FROM)} where ${where} ${order} limit ${limit}`;
    return rows.map(toDebateCard);
  });
}

export async function getDebateCard(id: string, viewerId: string | null): Promise<DebateCard | null> {
  return asUser(viewerId, async (tx) => {
    const [r] = await tx`select ${tx.unsafe(CARD_SELECT)} from ${tx.unsafe(CARD_FROM)} where s.id = ${id}`;
    return r ? toDebateCard(r) : null;
  });
}

// ───────────────────────────── State machine application ─────────────────────────────

type Effect =
  | { kind: "ensure_room"; room: string }
  | { kind: "close_room"; room: string }
  | { kind: "start_recording"; room: string; sessionId: string }
  | { kind: "stop_recording"; egressId: string }
  | { kind: "track"; name: "debate_started" | "debate_completed" | "debate_interrupted" | "debate_failed"; sessionId: string; isDemo: boolean; props?: Record<string, string | number> };

interface LockedSession {
  id: string;
  status: SessionStatus;
  host_id: string;
  challenge_id: string | null;
  proposition: string;
  scheduled_start: Date | null;
  ready_opened_at: Date | null;
  live_started_at: Date | null;
  ends_at: Date | null;
  duration_seconds: number;
  recording_enabled: boolean;
  video_room: string;
  is_demo: boolean;
}

interface LockedParticipant {
  user_id: string;
  side: Side;
  consented_at: Date | null;
  recording_consent: boolean | null;
  ready_at: Date | null;
  last_seen_at: Date | null;
  left_at: Date | null;
  username: string;
  display_name: string;
}

async function lockSession(tx: Tx, id: string): Promise<{ s: LockedSession; ps: LockedParticipant[] } | null> {
  const [s] = await tx<LockedSession[]>`select * from faceoff.debate_sessions where id = ${id} for update`;
  if (!s) return null;
  const ps = await tx<LockedParticipant[]>`
    select sp.user_id, sp.side, sp.consented_at, sp.recording_consent, sp.ready_at, sp.last_seen_at, sp.left_at,
           p.username, p.display_name
    from faceoff.session_participants sp join faceoff.profiles p on p.user_id = sp.user_id
    where sp.session_id = ${id} order by sp.side`;
  return { s, ps };
}

async function finish(
  tx: Tx,
  s: LockedSession,
  ps: LockedParticipant[],
  to: "completed" | "interrupted" | "failed" | "cancelled",
  reason: EndReason,
  endedBy: string | null,
  effects: Effect[],
) {
  await tx`update faceoff.debate_sessions set status = ${to}, end_reason = ${reason}, ended_at = now(), ended_by = ${endedBy}
           where id = ${s.id}`;
  // Persuasion/position polls stay open for 24h after a completed debate so replay viewers can weigh in.
  if (to === "completed" || to === "interrupted") {
    await tx`update faceoff.polls set closes_at = now() + interval '24 hours' where session_id = ${s.id} and status = 'open'`;
  } else {
    await tx`update faceoff.polls set status = 'closed', closes_at = now() where session_id = ${s.id} and status = 'open'`;
  }
  if (s.challenge_id) {
    const cstatus = to === "completed" || to === "interrupted" ? "completed" : to === "failed" ? "expired" : "cancelled";
    await tx`update faceoff.challenges set status = ${cstatus} where id = ${s.challenge_id} and status = 'accepted'`;
  }
  const [rec] = await tx<{ id: string; provider_ref: string | null; status: string }[]>`
    select id, provider_ref, status from faceoff.recordings where session_id = ${s.id}`;
  if (rec?.provider_ref && (rec.status === "recording" || rec.status === "requested")) {
    effects.push({ kind: "stop_recording", egressId: rec.provider_ref });
    await tx`update faceoff.recordings set status = 'processing' where id = ${rec.id}`;
  }
  if (s.status === "live" || s.status === "ready") effects.push({ kind: "close_room", room: s.video_room });

  const titles: Record<typeof to, string> = {
    completed: "Your FaceOff is complete",
    interrupted: "Your FaceOff was interrupted",
    failed: "Your FaceOff didn't start",
    cancelled: "A FaceOff was cancelled",
  };
  for (const p of ps) {
    const other = ps.find((x) => x.user_id !== p.user_id);
    await notify(tx, {
      userId: p.user_id,
      kind: to === "cancelled" ? "challenge_cancelled" : "debate_completed",
      actorId: endedBy && endedBy !== p.user_id ? endedBy : null,
      entity: { type: "session", id: s.id },
      title: titles[to],
      body: `“${s.proposition}” vs ${other?.display_name ?? "your opponent"}`,
      href: `/d/${s.id}`,
      dedupeKey: `session_end:${s.id}`,
    });
  }
  if (to !== "cancelled") {
    effects.push({
      kind: "track",
      name: to === "completed" ? "debate_completed" : to === "interrupted" ? "debate_interrupted" : "debate_failed",
      sessionId: s.id,
      isDemo: s.is_demo,
      props: { reason },
    });
  }
}

async function goLive(tx: Tx, s: LockedSession, effects: Effect[]) {
  const [u] = await tx<{ live_started_at: Date; ends_at: Date }[]>`
    update faceoff.debate_sessions
    set status = 'live', live_started_at = now(), ends_at = now() + make_interval(secs => duration_seconds)
    where id = ${s.id} returning live_started_at, ends_at`;
  for (const kind of POLL_KINDS) {
    await tx`insert into faceoff.polls (session_id, kind, question) values (${s.id}, ${kind}, ${POLL_DEFINITIONS[kind].question})
             on conflict (session_id, kind) do nothing`;
  }
  if (s.recording_enabled && features.recording) {
    await tx`insert into faceoff.recordings (session_id, status) values (${s.id}, 'requested') on conflict (session_id) do nothing`;
    effects.push({ kind: "start_recording", room: s.video_room, sessionId: s.id });
  }
  effects.push({ kind: "track", name: "debate_started", sessionId: s.id, isDemo: s.is_demo });
  return u!;
}

/** Applies any time-driven transition. Must run inside a service transaction. */
async function advanceLocked(tx: Tx, s: LockedSession, ps: LockedParticipant[], effects: Effect[]): Promise<SessionStatus> {
  const now = new Date();
  // Loop: e.g. scheduled → ready → failed can cascade when nobody visited for a long time.
  let status = s.status;
  for (let i = 0; i < 3; i++) {
    const t = evaluateTimedTransition(
      { status, scheduledStart: s.scheduled_start, readyOpenedAt: s.ready_opened_at, liveStartedAt: s.live_started_at, endsAt: s.ends_at },
      ps.map((p) => ({ userId: p.user_id, readyAt: p.ready_at, lastSeenAt: p.last_seen_at, leftAt: p.left_at })),
      now,
    );
    if (!t) break;
    if (t.to === "ready") {
      await tx`update faceoff.debate_sessions set status = 'ready', ready_opened_at = now() where id = ${s.id}`;
      s.ready_opened_at = now;
      effects.push({ kind: "ensure_room", room: s.video_room });
      status = "ready";
      continue;
    }
    await finish(tx, { ...s, status }, ps, t.to as "completed" | "interrupted" | "failed", t.reason as EndReason, null, effects);
    status = t.to;
    break;
  }
  return status;
}

async function runEffects(effects: Effect[]) {
  for (const e of effects) {
    try {
      if (e.kind === "ensure_room") await lk.ensureRoom(e.room);
      else if (e.kind === "close_room") await lk.closeRoom(e.room);
      else if (e.kind === "stop_recording") await lk.stopRecording(e.egressId);
      else if (e.kind === "start_recording") {
        const res = await lk.startRecording(e.room, e.sessionId);
        await asService((tx) =>
          res
            ? tx`update faceoff.recordings set status = 'recording', provider_ref = ${res.egressId}, storage_key = ${res.key} where session_id = ${e.sessionId}`
            : tx`update faceoff.recordings set status = 'failed', error = 'recording not configured' where session_id = ${e.sessionId}`,
        );
      } else if (e.kind === "track") await track(e.name, null, e.props ?? {}, { sessionId: e.sessionId, isDemo: e.isDemo });
    } catch (err) {
      console.error("session effect failed", e.kind, (err as Error).message);
      if (e.kind === "start_recording") {
        await asService((tx) => tx`update faceoff.recordings set status = 'failed', error = ${(err as Error).message.slice(0, 300)} where session_id = ${e.sessionId}`);
      }
    }
  }
}

/** Brings a session up to date with the clock. Idempotent and safe under concurrency (row lock). */
export async function syncSession(id: string): Promise<SessionStatus | null> {
  const effects: Effect[] = [];
  const status = await asService(async (tx) => {
    const l = await lockSession(tx, id);
    if (!l) return null;
    if (isTerminal(l.s.status)) return l.s.status;
    return advanceLocked(tx, l.s, l.ps, effects);
  });
  await runEffects(effects);
  return status;
}

// ───────────────────────────── Participant actions ─────────────────────────────

function participantOf(ps: LockedParticipant[], userId: string) {
  const p = ps.find((x) => x.user_id === userId);
  if (!p) throw forbidden("Only the two debaters can do that");
  return p;
}

const RULES_DISCLOSURE =
  "I agree to the FaceOff debate rules: 10 minutes, one-on-one, unscripted. No threats, harassment, hate against protected groups, " +
  "sharing private information, or impersonation. The debate is public and the audience may comment and vote.";
const RECORDING_DISCLOSURE =
  "This debate will be recorded (audio and video) and the replay published according to the debate's visibility setting. " +
  "Recording only happens if both debaters consent.";

export async function consentAndReady(
  sessionId: string,
  viewer: Viewer,
  input: { acceptRules: true; acceptRecording: boolean },
  userAgent: string | null,
) {
  // Outside development, a debate may only go live when real video is available.
  if (!features.video && env.APP_ENV !== "development" && env.APP_ENV !== "test") {
    throw new ApiError(503, "video_unavailable", "Live video isn't available right now, so debates can't start. Please try again later.");
  }
  await syncSession(sessionId);
  const effects: Effect[] = [];
  const result = await asService(async (tx) => {
    const l = await lockSession(tx, sessionId);
    if (!l) throw notFound("Debate not found");
    const { s, ps } = l;
    const me = participantOf(ps, viewer.userId);
    if (s.status === "scheduled") throw badRequest("The green room opens 15 minutes before the scheduled start");
    if (s.status !== "ready" && s.status !== "live") throw new ApiError(409, "invalid_state", `This debate is ${s.status}`);
    const ua = userAgent?.slice(0, 300) ?? null;
    await tx`insert into faceoff.consents (user_id, session_id, kind, granted, version, disclosure, user_agent)
             values (${me.user_id}, ${s.id}, 'rules', true, ${CONSENT_VERSIONS.rules}, ${RULES_DISCLOSURE}, ${ua})`;
    if (s.recording_enabled) {
      await tx`insert into faceoff.consents (user_id, session_id, kind, granted, version, disclosure, user_agent)
               values (${me.user_id}, ${s.id}, 'recording', ${input.acceptRecording}, ${CONSENT_VERSIONS.recording}, ${RECORDING_DISCLOSURE}, ${ua})`;
      if (!input.acceptRecording) {
        // Either debater can veto recording. It is switched off for the whole session.
        await tx`update faceoff.debate_sessions set recording_enabled = false where id = ${s.id}`;
        s.recording_enabled = false;
      }
    }
    await tx`update faceoff.session_participants
             set consented_at = coalesce(consented_at, now()), recording_consent = ${s.recording_enabled ? input.acceptRecording : null},
                 ready_at = coalesce(ready_at, now()), joined_at = coalesce(joined_at, now()), last_seen_at = now(), left_at = null
             where session_id = ${s.id} and user_id = ${me.user_id}`;
    me.ready_at = me.ready_at ?? new Date();
    if (s.status === "live") return "live" as const;
    const snapshot = { status: s.status, scheduledStart: s.scheduled_start, readyOpenedAt: s.ready_opened_at, liveStartedAt: null, endsAt: null };
    const parts = ps.map((p) => ({ userId: p.user_id, readyAt: p.ready_at, lastSeenAt: p.last_seen_at, leftAt: p.left_at }));
    if (shouldGoLive(snapshot, parts)) {
      await goLive(tx, s, effects);
      return "live" as const;
    }
    effects.push({ kind: "ensure_room", room: s.video_room });
    return "ready" as const;
  });
  await runEffects(effects);
  return { status: result };
}

/** Presence heartbeat. Debaters: keeps them "present"; audience: counts toward viewers. */
export async function heartbeat(sessionId: string, viewer: Viewer | null, viewerKey: string | null) {
  await asService(async (tx) => {
    const [s] = await tx<{ status: string; visibility: string; moderation_state: string; viewer_peak: number }[]>`
      select status, visibility, moderation_state, viewer_peak from faceoff.debate_sessions where id = ${sessionId}`;
    if (!s) throw notFound("Debate not found");
    if (viewer) {
      const r = await tx`update faceoff.session_participants set last_seen_at = now(), left_at = null
                         where session_id = ${sessionId} and user_id = ${viewer.userId} and ready_at is not null`;
      if (r.count > 0) return;
    }
    if (s.moderation_state !== "visible") return;
    const key = viewer ? `u:${viewer.userId}` : viewerKey && /^[A-Za-z0-9_-]{8,64}$/.test(viewerKey) ? `a:${viewerKey}` : null;
    if (!key) return;
    await tx`insert into faceoff.session_viewers (session_id, viewer_key, user_id) values (${sessionId}, ${key}, ${viewer?.userId ?? null})
             on conflict (session_id, viewer_key) do update set last_seen_at = now()`;
    if (viewer) {
      await tx`insert into faceoff.view_history (user_id, session_id, watched_seconds) values (${viewer.userId}, ${sessionId}, 0)
               on conflict (user_id, session_id) do update set
                 watched_seconds = faceoff.view_history.watched_seconds +
                   least(30, greatest(0, extract(epoch from (now() - faceoff.view_history.last_viewed_at))::int)),
                 last_viewed_at = now()`;
    }
    if (s.status === "live") {
      await tx`update faceoff.debate_sessions set viewer_peak = greatest(viewer_peak, app.viewers_now(${sessionId}, 30)) where id = ${sessionId}`;
    }
  });
}

export async function leaveSession(sessionId: string, viewer: Viewer) {
  await asService(async (tx) => {
    const l = await lockSession(tx, sessionId);
    if (!l) throw notFound();
    participantOf(l.ps, viewer.userId);
    await tx`update faceoff.session_participants set left_at = now() where session_id = ${sessionId} and user_id = ${viewer.userId}`;
  });
}

/** Host ends a live debate early → completed; either debater may cancel before it starts. */
export async function endSession(sessionId: string, viewer: Viewer, mode: "end" | "cancel") {
  const effects: Effect[] = [];
  await asService(async (tx) => {
    const l = await lockSession(tx, sessionId);
    if (!l) throw notFound();
    const { s, ps } = l;
    participantOf(ps, viewer.userId);
    if (mode === "end") {
      if (s.status !== "live") throw new ApiError(409, "invalid_state", "The debate isn't live");
      if (s.host_id !== viewer.userId) throw forbidden("Only the host (the challenger) can end the debate early");
      await finish(tx, s, ps, "completed", "host_ended", viewer.userId, effects);
    } else {
      if (!["created", "scheduled", "ready"].includes(s.status)) throw new ApiError(409, "invalid_state", "This debate can no longer be cancelled");
      await finish(tx, s, ps, "cancelled", "cancelled", viewer.userId, effects);
    }
  });
  await runEffects(effects);
}

export async function adminTerminate(sessionId: string, actorId: string, reason: string) {
  const effects: Effect[] = [];
  await asService(async (tx) => {
    const l = await lockSession(tx, sessionId);
    if (!l) throw notFound();
    if (isTerminal(l.s.status)) throw new ApiError(409, "invalid_state", "Debate already ended");
    const to = l.s.status === "live" ? "interrupted" : "cancelled";
    await finish(tx, l.s, l.ps, to, "admin_terminated", actorId, effects);
    await audit(tx, actorId, "session.terminate", { type: "session", id: sessionId }, { reason, from: l.s.status });
  });
  await runEffects(effects);
}

// ───────────────────────────── Video tokens ─────────────────────────────

export async function videoToken(sessionId: string, viewer: Viewer | null, anonKey: string | null) {
  if (!features.video) throw new ApiError(503, "video_unavailable", "Live video is not configured on this server yet.");
  await syncSession(sessionId);
  const s = await asUser(viewer?.userId ?? null, async (tx) => {
    const [row] = await tx`select id, status, video_room, ends_at, duration_seconds from faceoff.debate_sessions where id = ${sessionId}`;
    return row;
  });
  if (!s) throw notFound("Debate not found");
  const [me] = viewer
    ? await asService((tx) => tx`
        select sp.side, sp.ready_at, p.display_name from faceoff.session_participants sp join faceoff.profiles p on p.user_id = sp.user_id
        where sp.session_id = ${sessionId} and sp.user_id = ${viewer.userId}`)
    : [];
  const remaining = s.ends_at ? Math.ceil((s.ends_at.getTime() - Date.now()) / 1000) : s.duration_seconds + 15 * 60;
  const ttl = Math.max(120, remaining + 120);
  if (me) {
    if (!["ready", "live"].includes(s.status)) throw new ApiError(409, "invalid_state", "The room isn't open");
    if (!me.ready_at) throw badRequest("Accept the debate rules first");
    const token = await lk.mintToken({ roomName: s.video_room, identity: `debater:${viewer!.userId}`, name: me.display_name, role: "debater", ttlSeconds: ttl, metadata: { side: me.side } });
    return { token, url: lk.videoConfig().url, role: "debater" as const };
  }
  if (s.status !== "live") throw new ApiError(409, "invalid_state", "The debate isn't live");
  const identity = viewer ? `viewer:${viewer.userId}` : `anon:${anonKey ?? randomBytes(6).toString("hex")}`;
  const token = await lk.mintToken({ roomName: s.video_room, identity, name: viewer?.displayName ?? "Viewer", role: "audience", ttlSeconds: ttl });
  return { token, url: lk.videoConfig().url, role: "audience" as const };
}

// ───────────────────────────── Aggregate state for clients ─────────────────────────────

export async function getSessionState(sessionId: string, viewer: Viewer | null): Promise<SessionState | null> {
  await syncSession(sessionId);
  const uid = viewer?.userId ?? null;
  return asUser(uid, async (tx) => {
    const [r] = await tx`select ${tx.unsafe(CARD_SELECT)}, s.duration_seconds, s.ready_opened_at from ${tx.unsafe(CARD_FROM)} where s.id = ${sessionId}`;
    if (!r) return null;
    const card = toDebateCard(r);
    const parts = await tx`
      select sp.user_id, sp.side, sp.consented_at, sp.recording_consent, sp.ready_at, sp.last_seen_at, sp.left_at,
             p.user_id as p_user_id, p.username as p_username, p.display_name as p_display_name, p.avatar_key as p_avatar_key,
             p.is_demo as p_is_demo, p.account_status as p_account_status
      from faceoff.session_participants sp join faceoff.profiles p on p.user_id = sp.user_id
      where sp.session_id = ${sessionId} order by sp.side desc`;
    const tallies = await tx<{ kind: PollKind; status: "open" | "closed"; choice: string | null; votes: string }[]>`select * from app.poll_tallies(${sessionId})`;
    const reactions = await tx<{ kind: ReactionKind; total: string }[]>`select * from app.reaction_counts(${sessionId})`;
    const [vn] = await tx<{ n: number }[]>`select app.viewers_now(${sessionId}, 30) as n`;
    const [rec] = await tx`select status, playback_url from faceoff.recordings where session_id = ${sessionId}`;
    const myVotes = uid
      ? await tx<{ kind: PollKind; choice: string }[]>`select pl.kind, v.choice from faceoff.poll_votes v join faceoff.polls pl on pl.id = v.poll_id where pl.session_id = ${sessionId} and v.user_id = ${uid}`
      : [];
    const me = parts.find((p) => p.user_id === uid);
    const blocked = uid ? (await tx`select app.blocked_between(${uid}::uuid, ${card.forSide.userId}::uuid) or app.blocked_between(${uid}::uuid, ${card.againstSide.userId}::uuid) as b`)[0]?.b : false;

    const polls = {} as SessionState["polls"];
    for (const k of POLL_KINDS) {
      const rows = tallies.filter((t) => t.kind === k);
      const t: Record<string, number> = {};
      for (const c of POLL_DEFINITIONS[k].choices) t[c] = 0;
      let total = 0;
      for (const row of rows) if (row.choice) { t[row.choice] = Number(row.votes); total += Number(row.votes); }
      polls[k] = { status: rows[0]?.status ?? "closed", tallies: t, total };
    }
    const react = {} as Record<ReactionKind, number>;
    for (const k of REACTIONS) react[k] = Number(reactions.find((x) => x.kind === k)?.total ?? 0);
    const now = Date.now();
    const canEngage = !!viewer && viewer.status === "active" && viewer.onboarded && !blocked && ["ready", "live", "completed", "interrupted"].includes(card.status);

    return {
      serverNow: new Date().toISOString(),
      session: { ...card, durationSeconds: r.duration_seconds ?? DEBATE_DURATION_SECONDS, readyOpenedAt: iso(r.ready_opened_at), hostId: card.hostId },
      participants: parts.map((p) => ({
        userId: p.user_id,
        side: p.side,
        consentedAt: iso(p.consented_at),
        recordingConsent: p.recording_consent,
        readyAt: iso(p.ready_at),
        present: !!p.ready_at && !p.left_at && !!p.last_seen_at && now - p.last_seen_at.getTime() < PRESENCE_STALE_SECONDS * 1000,
        profile: prefixedProfile(p, "p_"),
      })),
      viewer: {
        role: me ? "debater" : viewer ? "audience" : "anonymous",
        side: me?.side ?? null,
        canComment: canEngage,
        canVote: canEngage && ["live", "completed", "interrupted"].includes(card.status),
        votes: Object.fromEntries(myVotes.map((v) => [v.kind, v.choice])),
      },
      polls,
      reactions: react,
      viewersNow: vn?.n ?? 0,
      video: lk.videoConfig(),
      recording: { status: (rec?.status as SessionState["recording"]["status"]) ?? "none", playbackUrl: rec?.status === "ready" ? rec.playback_url : null },
    };
  });
}

// ───────────────────────────── Sweeper (cron) ─────────────────────────────

/** Advances every non-terminal session whose clock may have run out; closes expired polls. */
export async function sweepSessions(): Promise<{ advanced: number }> {
  const ids = await asService(
    (tx) => tx<{ id: string }[]>`
      select id from faceoff.debate_sessions
      where status in ('scheduled', 'ready', 'live')
        and (
          (status = 'live') or
          (status = 'ready') or
          (status = 'scheduled' and scheduled_start < now() + interval '15 minutes')
        )
      limit 500`,
  );
  let advanced = 0;
  for (const { id } of ids) {
    const before = await asService((tx) => tx<{ status: string }[]>`select status from faceoff.debate_sessions where id = ${id}`);
    const after = await syncSession(id);
    if (before[0]?.status !== after) advanced++;
  }
  await asService((tx) => tx`update faceoff.polls set status = 'closed' where status = 'open' and closes_at is not null and closes_at < now()`);
  return { advanced };
}

export { RULES_DISCLOSURE, RECORDING_DISCLOSURE };
