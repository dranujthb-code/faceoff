import "server-only";
import {
  MOTION_LISTING_MIN_VOTES,
  MOTION_LISTING_THRESHOLD_PCT,
  motionReachesThreshold,
  trendingScore,
  type CommunitySummary,
  type MotionView,
  type Side,
  type TopicSummary,
} from "@faceoff/shared";
import { asService, asUser } from "../db";
import { badRequest, notFound } from "../errors";
import { track } from "../analytics";
import type { Viewer } from "../auth";
import { prefixedProfile } from "./mappers";
import { notify } from "./notifications";

export async function listTopics(): Promise<Array<TopicSummary & { description: string | null; isFeatured: boolean }>> {
  const rows = await asUser(null, (tx) => tx`select id, slug, name, description, is_featured from faceoff.topics where is_active order by sort_order, name`);
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, description: r.description, isFeatured: r.is_featured }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCommunity(r: any): CommunitySummary {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    topic: r.topic_id ? { id: r.topic_id, slug: r.topic_slug, name: r.topic_name } : null,
    memberCount: r.member_count,
    isDemo: r.is_demo,
    isMember: r.is_member ?? undefined,
  };
}

export async function listCommunities(viewerId: string | null, opts: { topicSlug?: string; q?: string; mine?: boolean; featured?: boolean; limit?: number } = {}): Promise<CommunitySummary[]> {
  return asUser(viewerId, async (tx) => {
    const conds = [tx`c.status = 'active'`];
    if (opts.topicSlug) conds.push(tx`t.slug = ${opts.topicSlug}`);
    if (opts.featured) conds.push(tx`c.is_featured`);
    if (opts.mine && viewerId) conds.push(tx`exists (select 1 from faceoff.community_memberships m where m.community_id = c.id and m.user_id = ${viewerId})`);
    if (opts.q && opts.q.trim().length >= 2) {
      const like = `%${opts.q.trim().slice(0, 50).replace(/[%_\\]/g, (ch) => "\\" + ch)}%`;
      conds.push(tx`(c.name ilike ${like} or c.description ilike ${like} or ${opts.q.trim().toLowerCase()} = any(c.tags))`);
    }
    const where = conds.reduce((a, c) => tx`${a} and ${c}`);
    const rows = await tx`
      select c.*, t.slug as topic_slug, t.name as topic_name,
        ${viewerId ? tx`exists (select 1 from faceoff.community_memberships m where m.community_id = c.id and m.user_id = ${viewerId})` : tx`null`} as is_member
      from faceoff.communities c left join faceoff.topics t on t.id = c.topic_id
      where ${where}
      order by c.is_featured desc, c.member_count desc, c.name limit ${opts.limit ?? 60}`;
    return rows.map(toCommunity);
  });
}

export async function getCommunity(slug: string, viewerId: string | null) {
  return asUser(viewerId, async (tx) => {
    const [r] = await tx`
      select c.*, t.slug as topic_slug, t.name as topic_name,
        ${viewerId ? tx`exists (select 1 from faceoff.community_memberships m where m.community_id = c.id and m.user_id = ${viewerId})` : tx`null`} as is_member
      from faceoff.communities c left join faceoff.topics t on t.id = c.topic_id where c.slug = ${slug}`;
    if (!r) return null;
    return { ...toCommunity(r), tags: r.tags as string[], region: r.region as string | null };
  });
}

export async function joinCommunity(viewer: Viewer, communityId: string) {
  const inserted = await asUser(viewer.userId, async (tx) => {
    const r = await tx`insert into faceoff.community_memberships (community_id, user_id) values (${communityId}, ${viewer.userId}) on conflict do nothing`;
    return r.count > 0;
  });
  if (inserted) await track("community_joined", viewer.userId, { source: "community_page" }, { isDemo: viewer.isDemo });
}

export async function leaveCommunity(viewer: Viewer, communityId: string) {
  await asUser(viewer.userId, (tx) => tx`delete from faceoff.community_memberships where community_id = ${communityId} and user_id = ${viewer.userId}`);
}

// ───────────────────────────── Motions ─────────────────────────────

const MOTION_SELECT = `
  m.id, m.title, m.context, m.status, m.author_side, m.created_at, m.is_demo, m.community_id,
  c.slug as community_slug, c.name as community_name, c.member_count,
  p.user_id as a_user_id, p.username as a_username, p.display_name as a_display_name, p.avatar_key as a_avatar_key,
  p.is_demo as a_is_demo, p.account_status as a_account_status,
  (select count(*)::int from faceoff.motion_votes v where v.motion_id = m.id) as support_votes`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMotion(r: any): MotionView {
  return {
    id: r.id,
    title: r.title,
    context: r.context,
    status: r.status,
    authorSide: r.author_side,
    author: prefixedProfile(r, "a_"),
    community: r.community_id ? { id: r.community_id, slug: r.community_slug, name: r.community_name } : null,
    supportVotes: r.support_votes,
    viewerSupported: Boolean(r.viewer_supported),
    createdAt: r.created_at.toISOString(),
    isDemo: r.is_demo,
  };
}

export async function listMotions(viewerId: string | null, opts: { communityId?: string; authorId?: string; status?: "proposed" | "listed"; limit?: number; trending?: boolean }): Promise<MotionView[]> {
  return asUser(viewerId, async (tx) => {
    const conds = [tx`m.moderation_state = 'visible'`, tx`m.status in ('proposed','listed')`];
    if (opts.communityId) conds.push(tx`m.community_id = ${opts.communityId}`);
    if (opts.authorId) conds.push(tx`m.author_id = ${opts.authorId}`);
    if (opts.status) conds.push(tx`m.status = ${opts.status}`);
    const where = conds.reduce((a, c) => tx`${a} and ${c}`);
    const rows = await tx`
      select ${tx.unsafe(MOTION_SELECT)},
        ${viewerId ? tx`exists (select 1 from faceoff.motion_votes v where v.motion_id = m.id and v.user_id = ${viewerId})` : tx`false`} as viewer_supported,
        act.recent_challenges, act.recent_debates, act.last_activity
      from faceoff.motions m
      join faceoff.profiles p on p.user_id = m.author_id
      left join faceoff.communities c on c.id = m.community_id
      left join lateral app.motion_activity(m.id) act on true
      where ${where}
      order by m.created_at desc limit ${Math.min(opts.limit ?? 30, 100)}`;
    let list = [...rows];
    if (opts.trending) {
      const now = new Date();
      list = [...rows].sort(
        (a, b) =>
          trendingScore({ challenges: b.recent_challenges, debates: b.recent_debates, supportVotes: b.support_votes, viewers: 0, lastActivityAt: b.last_activity }, now) -
          trendingScore({ challenges: a.recent_challenges, debates: a.recent_debates, supportVotes: a.support_votes, viewers: 0, lastActivityAt: a.last_activity }, now),
      );
    }
    return list.map(toMotion);
  });
}

export async function getMotion(id: string, viewerId: string | null): Promise<MotionView | null> {
  return asUser(viewerId, async (tx) => {
    const [r] = await tx`
      select ${tx.unsafe(MOTION_SELECT)},
        ${viewerId ? tx`exists (select 1 from faceoff.motion_votes v where v.motion_id = m.id and v.user_id = ${viewerId})` : tx`false`} as viewer_supported
      from faceoff.motions m join faceoff.profiles p on p.user_id = m.author_id left join faceoff.communities c on c.id = m.community_id
      where m.id = ${id}`;
    return r ? toMotion(r) : null;
  });
}

export async function createMotion(viewer: Viewer, input: { title: string; context?: string; communityId?: string; authorSide?: Side }): Promise<MotionView> {
  const id = await asUser(viewer.userId, async (tx) => {
    if (input.communityId) {
      const member = await tx`select 1 from faceoff.community_memberships where community_id = ${input.communityId} and user_id = ${viewer.userId}`;
      if (!member.length) throw badRequest("Join the community before proposing a motion there");
    }
    const [r] = await tx<{ id: string }[]>`
      insert into faceoff.motions (author_id, community_id, title, context, author_side)
      values (${viewer.userId}, ${input.communityId ?? null}, ${input.title}, ${input.context ?? null}, ${input.authorSide ?? null})
      returning id`;
    // the author supports their own motion
    await tx`insert into faceoff.motion_votes (motion_id, user_id) values (${r!.id}, ${viewer.userId})`;
    return r!.id;
  });
  if (!input.communityId) {
    // Wall motions ("I'll defend this") are listed immediately; community motions need 20% support.
    await asService((tx) => tx`update faceoff.motions set status = 'listed', listed_at = now() where id = ${id}`);
  } else {
    await maybeList(id);
  }
  return (await getMotion(id, viewer.userId))!;
}

async function maybeList(motionId: string) {
  await asService(async (tx) => {
    const [m] = await tx`
      select m.id, m.status, m.author_id, m.title, m.community_id, c.member_count, c.slug,
        (select count(*)::int from faceoff.motion_votes v where v.motion_id = m.id) as votes
      from faceoff.motions m join faceoff.communities c on c.id = m.community_id where m.id = ${motionId} for update of m`;
    if (!m || m.status !== "proposed") return;
    if (motionReachesThreshold(m.votes, m.member_count, MOTION_LISTING_THRESHOLD_PCT, MOTION_LISTING_MIN_VOTES)) {
      await tx`update faceoff.motions set status = 'listed', listed_at = now() where id = ${motionId}`;
      await notify(tx, { userId: m.author_id, kind: "motion_listed", entity: { type: "motion", id: motionId }, title: "Your motion is now listed", body: `“${m.title}” reached ${MOTION_LISTING_THRESHOLD_PCT}% community support.`, href: `/c/${m.slug}`, dedupeKey: `motion_listed:${motionId}` });
    }
  });
}

export async function supportMotion(viewer: Viewer, motionId: string, on: boolean) {
  await asUser(viewer.userId, async (tx) => {
    const [m] = await tx`select id from faceoff.motions where id = ${motionId}`;
    if (!m) throw notFound("Motion not found");
    if (on) await tx`insert into faceoff.motion_votes (motion_id, user_id) values (${motionId}, ${viewer.userId}) on conflict do nothing`;
    else await tx`delete from faceoff.motion_votes where motion_id = ${motionId} and user_id = ${viewer.userId}`;
  });
  if (on) await maybeList(motionId);
}

export async function archiveMotion(viewer: Viewer, motionId: string) {
  const r = await asUser(viewer.userId, (tx) => tx`update faceoff.motions set status = 'archived' where id = ${motionId} and author_id = ${viewer.userId}`);
  if (r.count === 0) throw notFound("Motion not found");
}
