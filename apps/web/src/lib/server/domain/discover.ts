import "server-only";
import { feedScore, opponentScore, type DebateCard, type MotionView, type OpponentCard } from "@faceoff/shared";
import { asUser } from "../db";
import { publicUrl } from "../storage";
import { listDebates } from "./debates";
import { listMotions, listCommunities } from "./communities";

/**
 * Swipe-to-challenge deck: people you could debate right now, ranked transparently
 * (shared topics/communities, availability, open motions, recent activity — see ranking.ts).
 */
export async function opponentDeck(viewerId: string, opts: { topicSlug?: string; communityId?: string; availableOnly?: boolean; limit?: number } = {}): Promise<OpponentCard[]> {
  return asUser(viewerId, async (tx) => {
    const [me] = await tx`select region from faceoff.profiles where user_id = ${viewerId}`;
    const rows = await tx`
      with my_topics as (select topic_id from faceoff.user_interests where user_id = ${viewerId}),
           my_comms as (select community_id from faceoff.community_memberships where user_id = ${viewerId})
      select p.user_id, p.username, p.display_name, p.avatar_key, p.is_demo, p.bio, p.region, p.available_until, p.account_status,
             u_last.last_active_at,
             (select count(*)::int from faceoff.user_interests ui where ui.user_id = p.user_id and ui.topic_id in (select topic_id from my_topics)) as shared_topics,
             (select count(*)::int from faceoff.community_memberships cm where cm.user_id = p.user_id and cm.community_id in (select community_id from my_comms)) as shared_communities,
             (select count(*)::int from faceoff.session_participants sp join faceoff.debate_sessions s on s.id = sp.session_id
                where sp.user_id = p.user_id and s.status = 'completed') as completed,
             mo.id as motion_id, mo.title as motion_title, mo.author_side as motion_side, mc.slug as motion_community_slug, mc.name as motion_community_name
      from faceoff.profiles p
      left join lateral (select max(created_at) as last_active_at from faceoff.session_participants x where x.user_id = p.user_id) u_last on true
      left join lateral (
        select m.id, m.title, m.author_side, m.community_id from faceoff.motions m
        where m.author_id = p.user_id and m.status = 'listed' and m.moderation_state = 'visible'
        order by m.created_at desc limit 1) mo on true
      left join faceoff.communities mc on mc.id = mo.community_id
      where p.user_id <> ${viewerId}
        and p.onboarded_at is not null and p.account_status = 'active'
        and p.challenge_eligibility <> 'nobody'
        and (p.challenge_eligibility = 'everyone'
             or exists (select 1 from faceoff.follows f where f.follower_id = p.user_id and f.followee_id = ${viewerId}))
        and not app.blocked_between(p.user_id, ${viewerId})
        and not exists (select 1 from faceoff.discovery_skips d where d.user_id = ${viewerId} and d.skipped_id = p.user_id and d.created_at > now() - interval '7 days')
        and not exists (select 1 from faceoff.challenges ch where ch.status in ('pending','accepted')
                        and ((ch.challenger_id = ${viewerId} and ch.recipient_id = p.user_id) or (ch.recipient_id = ${viewerId} and ch.challenger_id = p.user_id)))
        ${opts.topicSlug ? tx`and exists (select 1 from faceoff.user_interests ui join faceoff.topics t on t.id = ui.topic_id where ui.user_id = p.user_id and t.slug = ${opts.topicSlug})` : tx``}
        ${opts.communityId ? tx`and exists (select 1 from faceoff.community_memberships cm where cm.user_id = p.user_id and cm.community_id = ${opts.communityId})` : tx``}
        ${opts.availableOnly ? tx`and p.available_until > now()` : tx``}
      limit 300`;
    const topicRows = rows.length
      ? await tx`select ui.user_id, t.id, t.slug, t.name from faceoff.user_interests ui join faceoff.topics t on t.id = ui.topic_id where ui.user_id = any(${rows.map((r) => r.user_id)})`
      : [];
    const now = new Date();
    const cards: OpponentCard[] = rows.map((r) => {
      const availableNow = !!r.available_until && r.available_until > now;
      const lastActive = r.last_active_at as Date | null;
      const score = opponentScore(
        { sharedTopics: r.shared_topics, sharedCommunities: r.shared_communities, availableNow, hasOpenMotion: !!r.motion_id, lastActiveAt: lastActive, completedDebates: r.completed, sameRegion: !!me?.region && me.region === r.region },
        now,
      );
      const reasons: string[] = [];
      if (availableNow) reasons.push("Available now");
      if (r.motion_id) reasons.push("Has an open motion");
      if (r.shared_topics) reasons.push(`${r.shared_topics} shared topic${r.shared_topics > 1 ? "s" : ""}`);
      if (r.shared_communities) reasons.push(`${r.shared_communities} shared communit${r.shared_communities > 1 ? "ies" : "y"}`);
      return {
        profile: {
          userId: r.user_id,
          username: r.username,
          displayName: r.display_name,
          avatarUrl: publicUrl(r.avatar_key),
          isDemo: r.is_demo,
          availableNow,
          bio: r.bio,
          region: r.region,
        },
        topics: topicRows.filter((t) => t.user_id === r.user_id).map((t) => ({ id: t.id, slug: t.slug, name: t.name })),
        sharedTopics: r.shared_topics,
        sharedCommunities: r.shared_communities,
        debatesCompleted: r.completed,
        availableNow,
        motion: r.motion_id
          ? { id: r.motion_id, title: r.motion_title, authorSide: r.motion_side, community: r.motion_community_slug ? { slug: r.motion_community_slug, name: r.motion_community_name } : null }
          : null,
        score,
        reasons,
      };
    });
    // Real people before demo accounts at equal relevance; then by score.
    cards.sort((a, b) => Number(a.profile.isDemo) - Number(b.profile.isDemo) || b.score - a.score);
    return cards.slice(0, opts.limit ?? 30);
  });
}

export async function skipOpponent(viewerId: string, targetId: string) {
  await asUser(viewerId, (tx) =>
    tx`insert into faceoff.discovery_skips (user_id, skipped_id) values (${viewerId}, ${targetId})
       on conflict (user_id, skipped_id) do update set created_at = now()`,
  );
}

export interface HomeFeed {
  live: DebateCard[];
  forYou: Array<DebateCard & { score: number }>;
  motions: MotionView[];
  suggestedCommunities: Awaited<ReturnType<typeof listCommunities>>;
}

export async function homeFeed(viewerId: string): Promise<HomeFeed> {
  const [all, ctx] = await Promise.all([
    listDebates({ filter: "recent", limit: 60 }, viewerId),
    asUser(viewerId, async (tx) => ({
      topics: (await tx`select c.id from faceoff.communities c join faceoff.user_interests ui on ui.topic_id = c.topic_id where ui.user_id = ${viewerId}`).map((r) => r.id as string),
      communities: (await tx`select community_id from faceoff.community_memberships where user_id = ${viewerId}`).map((r) => r.community_id as string),
      follows: (await tx`select followee_id from faceoff.follows where follower_id = ${viewerId}`).map((r) => r.followee_id as string),
    })),
  ]);
  const cards = all.length
    ? await asUser(viewerId, (tx) => tx<{ id: string; community_id: string | null }[]>`select id, community_id from faceoff.debate_sessions where id = any(${all.map((d) => d.id)})`)
    : [];
  const communityOf = new Map(cards.map((c) => [c.id, c.community_id]));
  const now = new Date();
  const scored = all.map((d) => {
    const cid = communityOf.get(d.id) ?? null;
    const at = new Date(d.status === "live" ? d.liveStartedAt! : d.endedAt ?? d.scheduledStart ?? d.liveStartedAt ?? now.toISOString());
    const score = feedScore(
      {
        status: d.status,
        at,
        topicMatch: !!cid && ctx.topics.includes(cid),
        communityMatch: !!cid && ctx.communities.includes(cid),
        followsParticipant: ctx.follows.includes(d.forSide.userId) || ctx.follows.includes(d.againstSide.userId),
        votes: d.stats.votes,
        comments: d.stats.comments,
        views: d.stats.views,
        hasReplay: d.replayStatus === "ready",
      },
      now,
    );
    return { ...d, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const motions = (await listMotions(viewerId, { status: "listed", limit: 40, trending: true }))
    .filter((m) => m.author.userId !== viewerId)
    .slice(0, 6);
  const suggestedCommunities = ctx.communities.length < 3 ? (await listCommunities(viewerId, { limit: 8 })).filter((c) => !c.isMember).slice(0, 4) : [];
  return {
    live: scored.filter((d) => d.status === "live"),
    forYou: scored.filter((d) => d.status !== "live").slice(0, 30),
    motions,
    suggestedCommunities,
  };
}
