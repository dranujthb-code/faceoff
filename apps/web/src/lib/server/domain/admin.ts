import "server-only";
import { asService, asUser } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import { audit } from "../audit";
import type { Viewer } from "../auth";

/**
 * Admin metrics. Computed live from production tables; demo content (is_demo) is excluded unless
 * explicitly requested, so seeded data never inflates reporting.
 */
export async function metrics(staffId: string, includeDemo = false) {
  return asService(async (tx) => {
    const demo = includeDemo ? tx`true` : tx`not is_demo`;
    const sDemo = includeDemo ? tx`true` : tx`not s.is_demo`;
    const uDemo = includeDemo ? tx`true` : tx`not u.is_demo`;

    const weekly = await tx<{ week: Date; completed: number }[]>`
      select date_trunc('week', gs) as week, coalesce(x.n, 0)::int as completed
      from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') gs
      left join (select date_trunc('week', ended_at) as w, count(*) as n from faceoff.debate_sessions
                 where status = 'completed' and ${demo} group by 1) x on x.w = date_trunc('week', gs)
      order by 1`;

    const [users] = await tx<{ signups_7d: number; signups_30d: number; verified_30d: number; onboarded_30d: number; active_7d: number; returning_7d: number; total: number }[]>`
      select
        count(*) filter (where u.created_at > now() - interval '7 days')::int as signups_7d,
        count(*) filter (where u.created_at > now() - interval '30 days')::int as signups_30d,
        count(*) filter (where u.created_at > now() - interval '30 days' and u.email_verified_at is not null)::int as verified_30d,
        count(p.onboarded_at) filter (where u.created_at > now() - interval '30 days')::int as onboarded_30d,
        count(*) filter (where u.last_active_at > now() - interval '7 days')::int as active_7d,
        count(*) filter (where u.last_active_at > now() - interval '7 days' and u.created_at < now() - interval '7 days')::int as returning_7d,
        count(*)::int as total
      from faceoff.users u left join faceoff.profiles p on p.user_id = u.id
      where u.status <> 'deleted' and ${uDemo}`;

    const [ch] = await tx<{ sent_7d: number; accepted_7d: number; declined_7d: number; expired_7d: number }[]>`
      select
        count(*) filter (where created_at > now() - interval '7 days')::int as sent_7d,
        count(*) filter (where created_at > now() - interval '7 days' and status in ('accepted','completed'))::int as accepted_7d,
        count(*) filter (where created_at > now() - interval '7 days' and status = 'declined')::int as declined_7d,
        count(*) filter (where created_at > now() - interval '7 days' and status = 'expired')::int as expired_7d
      from faceoff.challenges where ${demo}`;

    const [conv] = await tx<{ accepted: number; went_live: number }[]>`
      select count(*)::int as accepted,
             count(*) filter (where s.live_started_at is not null)::int as went_live
      from faceoff.challenges c join faceoff.debate_sessions s on s.challenge_id = c.id
      where c.responded_at > now() - interval '30 days' and ${sDemo}`;

    const [deb] = await tx<{ started_7d: number; completed_7d: number; interrupted_7d: number; failed_7d: number; live_now: number; upcoming: number }[]>`
      select
        count(*) filter (where s.live_started_at > now() - interval '7 days')::int as started_7d,
        count(*) filter (where s.status = 'completed' and s.ended_at > now() - interval '7 days')::int as completed_7d,
        count(*) filter (where s.status = 'interrupted' and s.ended_at > now() - interval '7 days')::int as interrupted_7d,
        count(*) filter (where s.status = 'failed' and s.ended_at > now() - interval '7 days')::int as failed_7d,
        count(*) filter (where s.status = 'live')::int as live_now,
        count(*) filter (where s.status in ('scheduled','ready'))::int as upcoming
      from faceoff.debate_sessions s where ${sDemo}`;

    const [watch] = await tx<{ avg_watch_seconds: number; unique_viewers_30d: number }[]>`
      select coalesce(avg(v.watched_seconds) filter (where v.watched_seconds > 0), 0)::int as avg_watch_seconds,
             count(distinct v.user_id)::int as unique_viewers_30d
      from faceoff.view_history v join faceoff.debate_sessions s on s.id = v.session_id
      where v.last_viewed_at > now() - interval '30 days' and ${sDemo}`;

    const [aud] = await tx<{ comments_7d: number; votes_7d: number; reactions_7d: number }[]>`
      select
        (select count(*)::int from faceoff.comments c join faceoff.debate_sessions s on s.id = c.session_id where c.created_at > now() - interval '7 days' and ${sDemo}) as comments_7d,
        (select count(*)::int from faceoff.poll_votes v join faceoff.polls pl on pl.id = v.poll_id join faceoff.debate_sessions s on s.id = pl.session_id where v.created_at > now() - interval '7 days' and ${sDemo}) as votes_7d,
        (select count(*)::int from faceoff.reactions r join faceoff.debate_sessions s on s.id = r.session_id where r.created_at > now() - interval '7 days' and ${sDemo}) as reactions_7d`;

    const events = await tx<{ name: string; n: number }[]>`
      select name, count(*)::int as n from faceoff.analytics_events
      where created_at > now() - interval '7 days' and ${demo} and name in ('replay_viewed','share_clicked','community_joined','report_filed','enforcement_action')
      group by name`;
    const ev = Object.fromEntries(events.map((e) => [e.name, e.n])) as Record<string, number>;

    const [safety] = await tx<{ reports_7d: number; open_reports: number; urgent_open: number }[]>`
      select count(*) filter (where created_at > now() - interval '7 days')::int as reports_7d,
             count(*) filter (where status in ('open','in_review'))::int as open_reports,
             count(*) filter (where status in ('open','in_review') and priority = 1)::int as urgent_open
      from faceoff.reports`;
    const [actions] = await tx<{ n: number }[]>`select count(*)::int as n from faceoff.moderation_actions where created_at > now() - interval '7 days' and action <> 'dismiss_report'`;

    // Weekly signup cohorts × share of the cohort active in each following week.
    const cohorts = await tx<{ cohort: Date; size: number; week_offset: number; active: number }[]>`
      with c as (
        select u.id, date_trunc('week', u.created_at) as cohort from faceoff.users u
        where u.created_at > date_trunc('week', now()) - interval '6 weeks' and u.status <> 'deleted' and ${uDemo}
      ), act as (
        select distinct user_id, date_trunc('week', created_at) as wk from faceoff.analytics_events
        where created_at > date_trunc('week', now()) - interval '6 weeks' and user_id is not null
      )
      select c.cohort, (select count(*)::int from c c2 where c2.cohort = c.cohort) as size,
             ((extract(epoch from (act.wk - c.cohort)) / 604800)::int) as week_offset,
             count(distinct c.id)::int as active
      from c join act on act.user_id = c.id and act.wk >= c.cohort
      group by c.cohort, act.wk order by c.cohort, week_offset`;

    void staffId;
    return {
      northStar: { label: "Weekly completed FaceOff debates", series: weekly.map((w) => ({ week: w.week.toISOString().slice(0, 10), value: w.completed })) },
      users,
      challenges: { ...ch!, acceptanceRate: ch!.sent_7d ? ch!.accepted_7d / ch!.sent_7d : null },
      conversion: { ...conv!, challengeToLive: conv!.accepted ? conv!.went_live / conv!.accepted : null },
      debates: deb,
      watch,
      audience: aud,
      events: { replayViews: ev.replay_viewed ?? 0, shares: ev.share_clicked ?? 0, communityJoins: ev.community_joined ?? 0, reportsFiled: ev.report_filed ?? 0 },
      safety: { ...safety!, actions7d: actions!.n, reportsPer100Debates: deb!.completed_7d ? (safety!.reports_7d / deb!.completed_7d) * 100 : null },
      cohorts: cohorts.map((c) => ({ cohort: c.cohort.toISOString().slice(0, 10), size: c.size, weekOffset: c.week_offset, active: c.active })),
      includeDemo,
      generatedAt: new Date().toISOString(),
    };
  });
}

export async function searchUsers(staffId: string, q: string, limit = 50) {
  return asUser(staffId, async (tx) => {
    const like = `%${q.trim().slice(0, 60).replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    return tx`
      select u.id, u.email, u.role, u.status, u.suspended_until, u.email_verified_at, u.created_at, u.last_active_at, u.is_demo,
             p.username, p.display_name,
             (select count(*)::int from faceoff.reports r where r.target_user_id = u.id) as reports_against,
             (select count(*)::int from faceoff.moderation_actions a where a.subject_user_id = u.id) as actions_against
      from faceoff.users u left join faceoff.profiles p on p.user_id = u.id
      ${q.trim() ? tx`where u.email ilike ${like} or p.username ilike ${like} or p.display_name ilike ${like}` : tx``}
      order by u.created_at desc limit ${limit}`;
  });
}

export async function setRole(actor: Viewer, userId: string, role: "user" | "moderator" | "admin") {
  if (actor.role !== "admin") throw forbidden("Only administrators can change roles");
  if (actor.userId === userId) throw badRequest("You can't change your own role");
  await asService(async (tx) => {
    const [u] = await tx`update faceoff.users set role = ${role} where id = ${userId} returning id`;
    if (!u) throw notFound("User not found");
    await audit(tx, actor.userId, "user.set_role", { type: "user", id: userId }, { role });
  });
}

export async function upsertTopic(actor: Viewer, input: { id?: string; slug: string; name: string; description?: string; isFeatured?: boolean; isActive?: boolean; sortOrder?: number }) {
  return asService(async (tx) => {
    const [t] = input.id
      ? await tx`update faceoff.topics set slug = ${input.slug}, name = ${input.name}, description = ${input.description ?? null},
                 is_featured = ${input.isFeatured ?? false}, is_active = ${input.isActive ?? true}, sort_order = ${input.sortOrder ?? 100}
                 where id = ${input.id} returning id`
      : await tx`insert into faceoff.topics (slug, name, description, is_featured, is_active, sort_order)
                 values (${input.slug}, ${input.name}, ${input.description ?? null}, ${input.isFeatured ?? false}, ${input.isActive ?? true}, ${input.sortOrder ?? 100})
                 returning id`;
    if (!t) throw notFound("Topic not found");
    await audit(tx, actor.userId, input.id ? "topic.update" : "topic.create", { type: "topic", id: t.id }, { slug: input.slug, featured: input.isFeatured ?? false });
    return t.id as string;
  });
}

export async function upsertCommunity(
  actor: Viewer,
  input: { id?: string; slug: string; name: string; description?: string; topicId?: string | null; tags?: string[]; isFeatured?: boolean; status?: "active" | "archived" },
) {
  return asService(async (tx) => {
    const [c] = input.id
      ? await tx`update faceoff.communities set slug = ${input.slug}, name = ${input.name}, description = ${input.description ?? null},
                 topic_id = ${input.topicId ?? null}, tags = ${input.tags ?? []}, is_featured = ${input.isFeatured ?? false}, status = ${input.status ?? "active"}
                 where id = ${input.id} returning id`
      : await tx`insert into faceoff.communities (slug, name, description, topic_id, tags, is_featured, status, created_by)
                 values (${input.slug}, ${input.name}, ${input.description ?? null}, ${input.topicId ?? null}, ${input.tags ?? []},
                         ${input.isFeatured ?? false}, ${input.status ?? "active"}, ${actor.userId})
                 returning id`;
    if (!c) throw notFound("Community not found");
    await audit(tx, actor.userId, input.id ? "community.update" : "community.create", { type: "community", id: c.id }, { slug: input.slug, status: input.status ?? "active" });
    return c.id as string;
  });
}

export async function adminDebates(staffId: string, status: string | null, limit = 100) {
  return asUser(staffId, (tx) => tx`
    select s.id, s.proposition, s.status, s.visibility, s.moderation_state, s.scheduled_start, s.live_started_at, s.ends_at, s.ended_at,
           s.end_reason, s.recording_enabled, s.viewer_peak, s.is_demo, s.created_at,
           (select string_agg(p.username || ' (' || sp.side || ')', ' vs ' order by sp.side desc)
              from faceoff.session_participants sp join faceoff.profiles p on p.user_id = sp.user_id where sp.session_id = s.id) as debaters,
           r.status as recording_status,
           (select count(*)::int from faceoff.reports rp where rp.target_type = 'session' and rp.target_id = s.id) as reports
    from faceoff.debate_sessions s left join faceoff.recordings r on r.session_id = s.id
    ${status ? tx`where s.status = ${status}` : tx``}
    order by (s.status = 'live') desc, coalesce(s.live_started_at, s.scheduled_start, s.created_at) desc limit ${limit}`);
}

export async function auditLog(adminId: string, limit = 200) {
  return asUser(adminId, (tx) => tx`
    select l.*, p.username as actor_username from faceoff.audit_logs l left join faceoff.profiles p on p.user_id = l.actor_id
    order by l.created_at desc limit ${limit}`);
}

export async function adminTopicsAndCommunities() {
  return asService(async (tx) => ({
    topics: await tx`select * from faceoff.topics order by sort_order, name`,
    communities: await tx`select c.*, t.name as topic_name from faceoff.communities c left join faceoff.topics t on t.id = c.topic_id order by c.status, c.name`,
  }));
}

export async function supportRequests() {
  return asService((tx) => tx`select * from faceoff.support_requests order by (status = 'open') desc, created_at desc limit 100`);
}
