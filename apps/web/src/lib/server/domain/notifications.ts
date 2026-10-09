import "server-only";
import type { NotificationKind, NotificationView } from "@faceoff/shared";
import { asService, asUser, type Tx } from "../db";
import { emails, sendEmail } from "../email";
import { env } from "../env";
import { prefixedProfile, iso } from "./mappers";

const PREF_FOR_KIND: Partial<Record<NotificationKind, string>> = {
  challenge_received: "notify_challenges",
  challenge_accepted: "notify_challenges",
  challenge_declined: "notify_challenges",
  challenge_rescheduled: "notify_challenges",
  challenge_cancelled: "notify_challenges",
  challenge_expired: "notify_challenges",
  debate_reminder: "notify_reminders",
  debate_starting: "notify_reminders",
  new_follower: "notify_followers",
  community_debate: "notify_community",
  motion_listed: "notify_community",
  replay_ready: "notify_replays",
  debate_completed: "notify_replays",
};

const EMAIL_KINDS: ReadonlySet<string> = new Set(["challenge_received", "challenge_accepted", "challenge_rescheduled", "debate_reminder", "replay_ready", "moderation_notice"]);

export interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  actorId?: string | null;
  entity?: { type: string; id: string };
  title: string;
  body?: string;
  href?: string;
  /** identical keys for the same user are delivered once */
  dedupeKey: string;
}

/** Inserts an in-app notification (inside the caller's service transaction), honoring preferences. */
export async function notify(tx: Tx, n: NotifyInput): Promise<void> {
  const pref = PREF_FOR_KIND[n.kind];
  if (pref) {
    const [p] = await tx<{ enabled: boolean }[]>`select ${tx(pref)} as enabled from faceoff.user_preferences where user_id = ${n.userId}`;
    if (p && p.enabled === false) return;
  }
  await tx`
    insert into faceoff.notifications (user_id, kind, actor_id, entity_type, entity_id, title, body, href, dedupe_key)
    values (${n.userId}, ${n.kind}, ${n.actorId ?? null}, ${n.entity?.type ?? null}, ${n.entity?.id ?? null},
            ${n.title}, ${n.body ?? null}, ${n.href ?? null}, ${n.dedupeKey})
    on conflict (user_id, dedupe_key) do nothing`;
}

/** Sends emails for recent, email-worthy notifications not yet emailed. Safe to call repeatedly. */
export async function deliverPendingEmails(limit = 50): Promise<number> {
  const rows = await asService(async (tx) => {
    return tx<{ id: string; email: string; title: string; body: string | null; href: string | null }[]>`
      with candidates as (
        select id from faceoff.notifications
        where emailed_at is null and read_at is null and created_at > now() - interval '2 days'
          and kind = any(${[...EMAIL_KINDS]})
        order by created_at limit ${limit}
        for update skip locked
      ), marked as (
        update faceoff.notifications n set emailed_at = now() from candidates c where n.id = c.id
        returning n.id, n.user_id, n.title, n.body, n.href
      )
      select m.id, u.email, m.title, m.body, m.href
      from marked m
      join faceoff.users u on u.id = m.user_id
      join faceoff.user_preferences p on p.user_id = m.user_id
      where p.email_notifications and u.status = 'active' and u.email_verified_at is not null and not u.is_demo`;
  });
  for (const r of rows) {
    await sendEmail(emails.notification(r.email, r.title, r.body ?? "", `${env.APP_URL}${r.href ?? "/activity"}`));
  }
  return rows.length;
}

export async function listNotifications(userId: string, limit = 30, before?: string): Promise<{ items: NotificationView[]; unread: number }> {
  return asUser(userId, async (tx) => {
    const rows = await tx`
      select n.id, n.kind, n.title, n.body, n.href, n.read_at, n.created_at,
             p.user_id as a_user_id, p.username as a_username, p.display_name as a_display_name, p.avatar_key as a_avatar_key,
             p.is_demo as a_is_demo, p.account_status as a_account_status
      from faceoff.notifications n
      left join faceoff.profiles p on p.user_id = n.actor_id
      where n.user_id = ${userId} ${before ? tx`and n.created_at < ${new Date(before)}` : tx``}
      order by n.created_at desc limit ${limit}`;
    const [u] = await tx<{ c: number }[]>`select count(*)::int as c from faceoff.notifications where user_id = ${userId} and read_at is null`;
    return {
      unread: u?.c ?? 0,
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        href: r.href,
        readAt: iso(r.read_at),
        createdAt: r.created_at.toISOString(),
        actor: r.a_user_id ? prefixedProfile(r, "a_") : null,
      })),
    };
  });
}

export async function unreadCount(userId: string): Promise<number> {
  const [r] = await asUser(userId, (tx) => tx<{ c: number }[]>`select count(*)::int as c from faceoff.notifications where user_id = ${userId} and read_at is null`);
  return r?.c ?? 0;
}

export async function markRead(userId: string, ids: string[] | "all") {
  await asUser(userId, async (tx) => {
    if (ids === "all") await tx`update faceoff.notifications set read_at = now() where user_id = ${userId} and read_at is null`;
    else if (ids.length) await tx`update faceoff.notifications set read_at = now() where user_id = ${userId} and id = any(${ids}) and read_at is null`;
  });
}
