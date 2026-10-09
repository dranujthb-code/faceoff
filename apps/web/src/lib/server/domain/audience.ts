import "server-only";
import { POLL_DEFINITIONS, type CommentView, type PollKind, type ReactionKind, type Side } from "@faceoff/shared";
import { asService, asUser } from "../db";
import { ApiError, badRequest, forbidden, notFound } from "../errors";
import { track } from "../analytics";
import { broadcast } from "../livekit";
import type { Viewer } from "../auth";
import { prefixedProfile } from "./mappers";

async function roomOf(sessionId: string): Promise<string | null> {
  const [r] = await asService((tx) => tx<{ video_room: string }[]>`select video_room from faceoff.debate_sessions where id = ${sessionId}`);
  return r?.video_room ?? null;
}

/** Comments for a session, oldest→newest; `after` returns only newer ones (for polling). Hides muted authors. */
export async function listComments(sessionId: string, viewerId: string | null, after?: string, limit = 100): Promise<CommentView[]> {
  return asUser(viewerId, async (tx) => {
    const afterDate = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : null;
    const rows = await tx`
      select * from (
        select c.id, c.body, c.status, c.created_at,
               p.user_id as a_user_id, p.username as a_username, p.display_name as a_display_name, p.avatar_key as a_avatar_key,
               p.is_demo as a_is_demo, p.account_status as a_account_status
        from faceoff.comments c join faceoff.profiles p on p.user_id = c.author_id
        where c.session_id = ${sessionId}
          ${afterDate ? tx`and c.created_at > ${afterDate}` : tx``}
          ${viewerId ? tx`and not exists (select 1 from faceoff.mutes m where m.muter_id = ${viewerId} and m.muted_id = c.author_id)
                          and not exists (select 1 from faceoff.blocks b where b.blocker_id = ${viewerId} and b.blocked_id = c.author_id)` : tx``}
        order by c.created_at desc limit ${limit}
      ) t order by created_at asc`;
    return rows.map((r) => ({ id: r.id, body: r.status === "visible" ? r.body : "", status: r.status, createdAt: r.created_at.toISOString(), author: prefixedProfile(r, "a_") }));
  });
}

export async function postComment(viewer: Viewer, sessionId: string, body: string): Promise<CommentView> {
  const row = await asUser(viewer.userId, async (tx) => {
    const [r] = await tx`insert into faceoff.comments (session_id, author_id, body) values (${sessionId}, ${viewer.userId}, ${body})
                         returning id, body, status, created_at`;
    return r;
  }).catch((e) => {
    if ((e as { code?: string }).code === "42501") throw forbidden("You can't comment on this debate");
    throw e;
  });
  const view: CommentView = {
    id: row!.id,
    body: row!.body,
    status: row!.status,
    createdAt: row!.created_at.toISOString(),
    author: { userId: viewer.userId, username: viewer.username ?? "", displayName: viewer.displayName ?? "", avatarUrl: null, isDemo: viewer.isDemo },
  };
  await track("comment_posted", viewer.userId, {}, { sessionId, isDemo: viewer.isDemo });
  const room = await roomOf(sessionId);
  if (room) await broadcast(room, "comment", { id: view.id });
  return view;
}

/** Authors may remove their own comment (soft delete keeps moderation evidence). */
export async function removeOwnComment(viewer: Viewer, commentId: string) {
  await asService(async (tx) => {
    const [c] = await tx`select author_id from faceoff.comments where id = ${commentId}`;
    if (!c) throw notFound();
    if (c.author_id !== viewer.userId) throw forbidden();
    await tx`update faceoff.comments set status = 'removed' where id = ${commentId}`;
  });
}

export async function react(viewer: Viewer, sessionId: string, kind: ReactionKind, side?: Side) {
  await asUser(viewer.userId, (tx) =>
    tx`insert into faceoff.reactions (session_id, user_id, kind, side) values (${sessionId}, ${viewer.userId}, ${kind}, ${side ?? null})`,
  ).catch((e) => {
    if ((e as { code?: string }).code === "42501") throw forbidden("Reactions are open while the debate is live");
    throw e;
  });
  await track("reaction_sent", viewer.userId, { kind }, { sessionId, isDemo: viewer.isDemo });
  const room = await roomOf(sessionId);
  if (room) await broadcast(room, "reaction", { kind, side: side ?? null });
}

export async function vote(viewer: Viewer, sessionId: string, poll: PollKind, choice: string) {
  if (!POLL_DEFINITIONS[poll].choices.includes(choice)) throw badRequest("Invalid choice");
  const [pl] = await asUser(viewer.userId, (tx) => tx<{ id: string; status: string }[]>`select id, status from faceoff.polls where session_id = ${sessionId} and kind = ${poll}`);
  if (!pl) throw new ApiError(409, "poll_unavailable", "Voting opens when the debate goes live");
  if (pl.status !== "open") throw new ApiError(409, "poll_closed", "Voting has closed for this debate");
  await asUser(viewer.userId, (tx) =>
    tx`insert into faceoff.poll_votes (poll_id, user_id, choice) values (${pl.id}, ${viewer.userId}, ${choice})
       on conflict (poll_id, user_id) do update set choice = excluded.choice`,
  ).catch((e) => {
    if ((e as { code?: string }).code === "42501") {
      throw forbidden(poll === "persuasion" ? "Debaters can't vote on who argued more persuasively in their own debate" : "You can't vote on this debate");
    }
    throw e;
  });
  await track("vote_cast", viewer.userId, { poll }, { sessionId, isDemo: viewer.isDemo });
  const room = await roomOf(sessionId);
  if (room) await broadcast(room, "vote", { poll });
}

export async function setSaved(viewer: Viewer, sessionId: string, saved: boolean) {
  await asUser(viewer.userId, (tx) =>
    saved
      ? tx`insert into faceoff.saved_debates (user_id, session_id) values (${viewer.userId}, ${sessionId}) on conflict do nothing`
      : tx`delete from faceoff.saved_debates where user_id = ${viewer.userId} and session_id = ${sessionId}`,
  );
}

export async function isSaved(viewerId: string, sessionId: string): Promise<boolean> {
  const r = await asUser(viewerId, (tx) => tx`select 1 from faceoff.saved_debates where user_id = ${viewerId} and session_id = ${sessionId}`);
  return r.length > 0;
}
