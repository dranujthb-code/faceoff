import "server-only";
import {
  INSTANT_CHALLENGE_TTL_SECONDS,
  oppositeSide,
  type ChallengeView,
  type CreateChallengeInput,
  type RespondChallengeInput,
  type Side,
} from "@faceoff/shared";
import { asService, asUser, type Tx } from "../db";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../errors";
import { track } from "../analytics";
import type { Viewer } from "../auth";
import { assertCanChallenge } from "./profiles";
import { notify } from "./notifications";
import { prefixedProfile, iso } from "./mappers";
import { syncSession } from "./debates";

const CHALLENGE_SELECT = `
  ch.*, cm.slug as community_slug, cm.name as community_name,
  s.id as session_id, s.status as session_status,
  pc.user_id as c_user_id, pc.username as c_username, pc.display_name as c_display_name, pc.avatar_key as c_avatar_key, pc.is_demo as c_is_demo, pc.account_status as c_account_status,
  pr.user_id as r_user_id, pr.username as r_username, pr.display_name as r_display_name, pr.avatar_key as r_avatar_key, pr.is_demo as r_is_demo, pr.account_status as r_account_status`;
const CHALLENGE_FROM = `
  faceoff.challenges ch
  join faceoff.profiles pc on pc.user_id = ch.challenger_id
  join faceoff.profiles pr on pr.user_id = ch.recipient_id
  left join faceoff.communities cm on cm.id = ch.community_id
  left join faceoff.debate_sessions s on s.challenge_id = ch.id`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toView(r: any, viewerId: string): ChallengeView {
  const actions: ChallengeView["actions"] = [];
  const isParty = viewerId === r.challenger_id || viewerId === r.recipient_id;
  if (isParty && r.status === "pending") {
    if (r.last_proposed_by !== viewerId) actions.push("accept", "decline", "propose_time");
    else if (r.challenger_id === viewerId) actions.push("cancel", "propose_time");
    else actions.push("propose_time");
  }
  if (isParty && r.status === "accepted" && r.session_id) actions.push("open_room");
  return {
    id: r.id,
    status: r.status,
    kind: r.kind,
    proposition: r.proposition,
    context: r.context,
    groundRules: r.ground_rules,
    challengerSide: r.challenger_side,
    proposedStart: iso(r.proposed_start),
    lastProposedBy: r.last_proposed_by,
    recordingEnabled: r.recording_enabled,
    visibility: r.visibility,
    expiresAt: r.expires_at.toISOString(),
    createdAt: r.created_at.toISOString(),
    challenger: prefixedProfile(r, "c_"),
    recipient: prefixedProfile(r, "r_"),
    community: r.community_slug ? { slug: r.community_slug, name: r.community_name } : null,
    sessionId: r.session_id ?? null,
    actions,
  };
}

export async function createChallenge(viewer: Viewer, input: CreateChallengeInput): Promise<ChallengeView> {
  const id = await asService(async (tx) => {
    await assertCanChallenge(tx, viewer.userId, input.recipientId);
    let communityId = input.communityId ?? null;
    if (input.motionId) {
      const [m] = await tx`select id, community_id, status, moderation_state from faceoff.motions where id = ${input.motionId}`;
      if (!m || m.moderation_state !== "visible" || m.status === "archived") throw badRequest("That motion is no longer open");
      communityId = communityId ?? m.community_id;
    }
    if (communityId) {
      const [c] = await tx`select 1 from faceoff.communities where id = ${communityId} and status = 'active'`;
      if (!c) throw badRequest("That community is not available");
    }
    const expiresAt = input.kind === "instant" ? new Date(Date.now() + INSTANT_CHALLENGE_TTL_SECONDS * 1000) : new Date(input.proposedStart!);
    try {
      const [row] = await tx<{ id: string }[]>`
        insert into faceoff.challenges (challenger_id, recipient_id, proposition, context, ground_rules, challenger_side,
          motion_id, community_id, kind, proposed_start, last_proposed_by, recording_enabled, visibility, expires_at)
        values (${viewer.userId}, ${input.recipientId}, ${input.proposition}, ${input.context ?? null}, ${input.groundRules ?? null},
          ${input.challengerSide}, ${input.motionId ?? null}, ${communityId}, ${input.kind},
          ${input.kind === "scheduled" ? new Date(input.proposedStart!) : null}, ${viewer.userId}, ${input.recordingEnabled},
          ${input.visibility}, ${expiresAt})
        returning id`;
      const cid = row!.id;
      await notify(tx, {
        userId: input.recipientId,
        kind: "challenge_received",
        actorId: viewer.userId,
        entity: { type: "challenge", id: cid },
        title: `${viewer.displayName ?? "Someone"} challenged you to a FaceOff`,
        body: `“${input.proposition}” — they argue ${input.challengerSide.toUpperCase()}, you'd argue ${oppositeSide(input.challengerSide).toUpperCase()}.${input.kind === "instant" ? " Instant debate — respond within 15 minutes." : ""}`,
        href: `/activity?tab=challenges&focus=${cid}`,
        dedupeKey: `challenge:${cid}`,
      });
      return cid;
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw conflict("You already have an active challenge with this person. Finish or cancel it first.");
      throw e;
    }
  });
  await track("challenge_sent", viewer.userId, { kind: input.kind, from_motion: Boolean(input.motionId) }, { isDemo: viewer.isDemo });
  const view = await getChallenge(id, viewer.userId);
  return view!;
}

export async function getChallenge(id: string, viewerId: string): Promise<ChallengeView | null> {
  return asUser(viewerId, async (tx) => {
    const [r] = await tx`select ${tx.unsafe(CHALLENGE_SELECT)} from ${tx.unsafe(CHALLENGE_FROM)} where ch.id = ${id}`;
    return r ? toView(r, viewerId) : null;
  });
}

export async function listChallenges(viewerId: string): Promise<{
  incoming: ChallengeView[];
  outgoing: ChallengeView[];
  upcoming: ChallengeView[];
  past: ChallengeView[];
}> {
  await expireChallenges();
  return asUser(viewerId, async (tx) => {
    const rows = await tx`
      select ${tx.unsafe(CHALLENGE_SELECT)} from ${tx.unsafe(CHALLENGE_FROM)}
      where (ch.challenger_id = ${viewerId} or ch.recipient_id = ${viewerId})
        and (ch.status in ('pending','accepted') or ch.updated_at > now() - interval '30 days')
      order by coalesce(ch.proposed_start, ch.created_at) asc
      limit 200`;
    const views = rows.map((r) => toView(r, viewerId));
    const terminalSession = (r: ChallengeView, raw: { session_status: string | null }) =>
      raw.session_status && ["completed", "cancelled", "failed", "interrupted"].includes(raw.session_status);
    return {
      incoming: views.filter((v) => v.status === "pending" && v.lastProposedBy !== viewerId),
      outgoing: views.filter((v) => v.status === "pending" && v.lastProposedBy === viewerId),
      upcoming: views.filter((v, i) => v.status === "accepted" && !terminalSession(v, rows[i] as never)),
      past: views.filter((v) => !["pending", "accepted"].includes(v.status)).reverse().slice(0, 30),
    };
  });
}

async function lockChallenge(tx: Tx, id: string) {
  const [c] = await tx`select * from faceoff.challenges where id = ${id} for update`;
  return c;
}

export async function respondToChallenge(viewer: Viewer, id: string, input: RespondChallengeInput): Promise<{ challenge: ChallengeView; sessionId: string | null }> {
  let sessionId: string | null = null;
  let tracked: "challenge_accepted" | "challenge_declined" | null = null;
  await asService(async (tx) => {
    const c = await lockChallenge(tx, id);
    if (!c) throw notFound("Challenge not found");
    const isParty = c.challenger_id === viewer.userId || c.recipient_id === viewer.userId;
    if (!isParty) throw notFound("Challenge not found");
    if (c.status !== "pending") throw new ApiError(409, "invalid_state", `This challenge is already ${c.status}`);
    const otherId: string = c.challenger_id === viewer.userId ? c.recipient_id : c.challenger_id;
    const [me] = await tx`select display_name from faceoff.profiles where user_id = ${viewer.userId}`;
    const myName = me?.display_name ?? "Your opponent";

    if (c.expires_at.getTime() < Date.now()) {
      await tx`update faceoff.challenges set status = 'expired' where id = ${id}`;
      throw new ApiError(409, "expired", "This challenge has expired");
    }

    if (input.action === "cancel") {
      if (c.challenger_id !== viewer.userId) throw forbidden("Only the challenger can withdraw a challenge — decline it instead");
      await tx`update faceoff.challenges set status = 'cancelled', responded_at = now() where id = ${id}`;
      await notify(tx, { userId: otherId, kind: "challenge_cancelled", actorId: viewer.userId, entity: { type: "challenge", id }, title: `${myName} withdrew their challenge`, body: `“${c.proposition}”`, href: "/activity?tab=challenges", dedupeKey: `challenge_cancelled:${id}` });
      return;
    }
    if (c.last_proposed_by === viewer.userId) throw forbidden("Waiting for the other person to respond");

    if (input.action === "decline") {
      await tx`update faceoff.challenges set status = 'declined', decline_reason = ${input.reason ?? null}, responded_at = now() where id = ${id}`;
      await notify(tx, { userId: otherId, kind: "challenge_declined", actorId: viewer.userId, entity: { type: "challenge", id }, title: `${myName} declined your challenge`, body: `“${c.proposition}”${input.reason ? ` — “${input.reason}”` : ""}`, href: "/activity?tab=challenges", dedupeKey: `challenge_declined:${id}` });
      tracked = "challenge_declined";
      return;
    }

    if (input.action === "propose_time") {
      const t = Date.parse(input.proposedStart);
      if (t < Date.now() + 5 * 60_000) throw badRequest("Propose a time at least 5 minutes from now", { proposedStart: "Too soon" });
      if (t > Date.now() + 60 * 86_400_000) throw badRequest("Propose a time within the next 60 days", { proposedStart: "Too far ahead" });
      await tx`update faceoff.challenges set kind = 'scheduled', proposed_start = ${new Date(t)}, last_proposed_by = ${viewer.userId},
               expires_at = ${new Date(t)}, responded_at = now() where id = ${id}`;
      await notify(tx, { userId: otherId, kind: "challenge_rescheduled", actorId: viewer.userId, entity: { type: "challenge", id }, title: `${myName} proposed a new time`, body: `“${c.proposition}” — ${new Date(t).toUTCString()}`, href: `/activity?tab=challenges&focus=${id}`, dedupeKey: `challenge_time:${id}:${t}` });
      return;
    }

    // accept
    const active = await tx`select count(*)::int as n from faceoff.users where id in (${c.challenger_id}, ${c.recipient_id}) and status = 'active'`;
    if (active[0]?.n !== 2) throw badRequest("One of the debaters is no longer available");
    const blocked = await tx`select 1 from faceoff.blocks where (blocker_id = ${c.challenger_id} and blocked_id = ${c.recipient_id}) or (blocker_id = ${c.recipient_id} and blocked_id = ${c.challenger_id})`;
    if (blocked.length) throw badRequest("This challenge can't be accepted");
    await tx`update faceoff.challenges set status = 'accepted', responded_at = now() where id = ${id}`;
    const scheduled = c.kind === "scheduled" && c.proposed_start;
    const [s] = await tx<{ id: string }[]>`
      insert into faceoff.debate_sessions (challenge_id, host_id, proposition, context, ground_rules, motion_id, community_id, status,
        visibility, recording_enabled, scheduled_start, ready_opened_at, video_room, is_demo)
      values (${id}, ${c.challenger_id}, ${c.proposition}, ${c.context}, ${c.ground_rules}, ${c.motion_id}, ${c.community_id},
        ${scheduled ? "scheduled" : "ready"}, ${c.visibility}, ${c.recording_enabled}, ${scheduled ? c.proposed_start : null},
        ${scheduled ? null : new Date()}, ${"fo_" + id.replace(/-/g, "")}, ${c.is_demo})
      returning id`;
    sessionId = s!.id;
    const challengerSide = c.challenger_side as Side;
    await tx`insert into faceoff.session_participants (session_id, user_id, side) values
      (${sessionId}, ${c.challenger_id}, ${challengerSide}), (${sessionId}, ${c.recipient_id}, ${oppositeSide(challengerSide)})`;
    await notify(tx, {
      userId: otherId,
      kind: "challenge_accepted",
      actorId: viewer.userId,
      entity: { type: "session", id: sessionId },
      title: `${myName} accepted your challenge`,
      body: scheduled ? `“${c.proposition}” — scheduled for ${c.proposed_start.toUTCString()}` : `“${c.proposition}” — the room is open now. Join within 10 minutes.`,
      href: `/d/${sessionId}`,
      dedupeKey: `challenge_accepted:${id}`,
    });
    // Let the challenger's community know a debate is coming.
    if (c.community_id && scheduled) {
      const members = await tx<{ user_id: string }[]>`
        select m.user_id from faceoff.community_memberships m
        where m.community_id = ${c.community_id} and m.user_id not in (${c.challenger_id}, ${c.recipient_id}) limit 500`;
      for (const m of members) {
        await notify(tx, { userId: m.user_id, kind: "community_debate", entity: { type: "session", id: sessionId }, title: "New FaceOff scheduled in your community", body: `“${c.proposition}”`, href: `/d/${sessionId}`, dedupeKey: `community_debate:${sessionId}` });
      }
    }
    tracked = "challenge_accepted";
  });
  if (tracked) await track(tracked, viewer.userId, {}, { sessionId: sessionId ?? undefined, isDemo: viewer.isDemo });
  if (sessionId) await syncSession(sessionId);
  const challenge = await getChallenge(id, viewer.userId);
  return { challenge: challenge!, sessionId };
}

/** Marks overdue pending challenges as expired and tells the challenger. */
export async function expireChallenges(): Promise<number> {
  return asService(async (tx) => {
    const rows = await tx<{ id: string; challenger_id: string; proposition: string }[]>`
      update faceoff.challenges set status = 'expired' where status = 'pending' and expires_at < now()
      returning id, challenger_id, proposition`;
    for (const r of rows) {
      await notify(tx, { userId: r.challenger_id, kind: "challenge_expired", entity: { type: "challenge", id: r.id }, title: "Your challenge expired", body: `“${r.proposition}” wasn't answered in time.`, href: "/activity?tab=challenges", dedupeKey: `challenge_expired:${r.id}` });
    }
    return rows.length;
  });
}

/** Sends a reminder to both debaters ~15 minutes before a scheduled FaceOff. */
export async function sendReminders(): Promise<number> {
  return asService(async (tx) => {
    const rows = await tx<{ id: string; proposition: string; scheduled_start: Date }[]>`
      update faceoff.debate_sessions set reminder_sent_at = now()
      where status in ('scheduled', 'ready') and reminder_sent_at is null and scheduled_start is not null
        and scheduled_start <= now() + interval '15 minutes' and scheduled_start > now() - interval '5 minutes'
      returning id, proposition, scheduled_start`;
    for (const s of rows) {
      const ps = await tx<{ user_id: string }[]>`select user_id from faceoff.session_participants where session_id = ${s.id}`;
      for (const p of ps) {
        await notify(tx, { userId: p.user_id, kind: "debate_reminder", entity: { type: "session", id: s.id }, title: "Your FaceOff starts soon", body: `“${s.proposition}” — the green room is open. Get ready.`, href: `/d/${s.id}`, dedupeKey: `reminder:${s.id}` });
      }
    }
    return rows.length;
  });
}
