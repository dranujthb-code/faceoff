import "server-only";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import type { CommunitySummary, ProfileDetail, ProfileSummary, ProfileUpdateInput, TopicSummary } from "@faceoff/shared";
import { asService, asUser, type Tx } from "../db";
import { ApiError, badRequest, notFound } from "../errors";
import { putObject } from "../storage";
import { toProfileSummary } from "./mappers";
import { notify } from "./notifications";

export const PROFILE_COLS = "p.user_id, p.username, p.display_name, p.avatar_key, p.is_demo, p.available_until, p.account_status";

export async function getProfileDetail(username: string, viewerId: string | null): Promise<ProfileDetail | null> {
  return asUser(viewerId, async (tx) => {
    const [p] = await tx`
      select p.*,
        (select count(*)::int from faceoff.follows f where f.followee_id = p.user_id) as followers,
        (select count(*)::int from faceoff.follows f where f.follower_id = p.user_id) as following,
        (select count(*)::int from faceoff.session_participants sp join faceoff.debate_sessions s on s.id = sp.session_id
           where sp.user_id = p.user_id and s.status = 'completed') as debates_completed
      from faceoff.profiles p where p.username = ${username} and p.onboarded_at is not null`;
    if (!p || p.account_status === "deleted") return null;
    const topics = await tx<TopicSummary[]>`
      select t.id, t.slug, t.name from faceoff.user_interests ui join faceoff.topics t on t.id = ui.topic_id
      where ui.user_id = ${p.user_id} order by t.sort_order, t.name`;
    const communities = await tx`
      select c.id, c.slug, c.name, c.description, c.member_count, c.is_demo
      from faceoff.community_memberships m join faceoff.communities c on c.id = m.community_id
      where m.user_id = ${p.user_id} order by c.member_count desc limit 12`;
    let viewer: ProfileDetail["viewer"] = null;
    const isSelf = viewerId === p.user_id;
    let follows = false;
    let followedBack = false;
    let blocked = false;
    if (viewerId) {
      follows = (await tx`select 1 from faceoff.follows where follower_id = ${viewerId} and followee_id = ${p.user_id}`).length > 0;
      followedBack = (await tx`select 1 from faceoff.follows where follower_id = ${p.user_id} and followee_id = ${viewerId}`).length > 0;
      blocked = (await tx`select 1 from faceoff.blocks where blocker_id = ${viewerId} and blocked_id = ${p.user_id}`).length > 0;
    }
    const canView = isSelf || p.visibility === "public" || follows;
    const canChallenge =
      !!viewerId && !isSelf && !blocked && p.account_status === "active" &&
      (p.challenge_eligibility === "everyone" || (p.challenge_eligibility === "following" && followedBack));
    if (viewerId) viewer = { isSelf, follows, blocked, canChallenge, canView };
    return {
      ...toProfileSummary(p as never),
      bio: canView ? p.bio : null,
      location: canView ? p.location : null,
      region: p.region,
      visibility: p.visibility,
      challengeEligibility: p.challenge_eligibility,
      createdAt: p.created_at.toISOString(),
      followers: p.followers,
      following: p.following,
      debatesCompleted: p.debates_completed,
      topics,
      communities: communities.map(
        (c): CommunitySummary => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, topic: null, memberCount: c.member_count, isDemo: c.is_demo }),
      ),
      viewer: viewer ?? { isSelf: false, follows: false, blocked: false, canChallenge: false, canView: p.visibility === "public" },
    };
  });
}

/** Server-side challenge eligibility check (used before creating a challenge). */
export async function assertCanChallenge(tx: Tx, challengerId: string, recipientId: string): Promise<void> {
  if (challengerId === recipientId) throw badRequest("You can't challenge yourself");
  const [r] = await tx`
    select p.challenge_eligibility, p.account_status, p.onboarded_at, u.status,
      exists (select 1 from faceoff.blocks b where (b.blocker_id = ${challengerId} and b.blocked_id = ${recipientId})
                                                 or (b.blocker_id = ${recipientId} and b.blocked_id = ${challengerId})) as blocked,
      exists (select 1 from faceoff.follows f where f.follower_id = ${recipientId} and f.followee_id = ${challengerId}) as recipient_follows
    from faceoff.profiles p join faceoff.users u on u.id = p.user_id where p.user_id = ${recipientId}`;
  if (!r || !r.onboarded_at || r.account_status !== "active" || r.status !== "active") throw notFound("That person isn't available to challenge");
  // Deliberately the same message for "blocked" and "not accepting": don't reveal blocks.
  const msg = "This person isn't accepting challenges from you right now";
  if (r.blocked) throw badRequest(msg);
  if (r.challenge_eligibility === "nobody") throw badRequest(msg);
  if (r.challenge_eligibility === "following" && !r.recipient_follows) throw badRequest("This person only accepts challenges from people they follow");
}

export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  await asUser(userId, async (tx) => {
    if (input.username) {
      const taken = await tx`select 1 from faceoff.profiles where username = ${input.username} and user_id <> ${userId}`;
      if (taken.length) throw badRequest("That username is taken", { username: "That username is taken" });
    }
    const patch: Record<string, unknown> = {};
    if (input.username !== undefined) patch.username = input.username;
    if (input.displayName !== undefined) patch.display_name = input.displayName;
    if (input.bio !== undefined) patch.bio = input.bio || null;
    if (input.location !== undefined) patch.location = input.location || null;
    if (input.region !== undefined) patch.region = input.region;
    if (input.visibility !== undefined) patch.visibility = input.visibility;
    if (input.challengeEligibility !== undefined) patch.challenge_eligibility = input.challengeEligibility;
    if (Object.keys(patch).length === 0) return;
    const res = await tx`update faceoff.profiles set ${tx(patch)} where user_id = ${userId}`;
    if (res.count === 0) throw notFound("Profile not found");
  });
}

export async function setInterests(userId: string, topicIds: string[]) {
  await asUser(userId, async (tx) => {
    await tx`delete from faceoff.user_interests where user_id = ${userId}`;
    for (const t of topicIds.slice(0, 12)) {
      await tx`insert into faceoff.user_interests (user_id, topic_id) select ${userId}, id from faceoff.topics where id = ${t} and is_active on conflict do nothing`;
    }
  });
}

/** "Available now" makes you discoverable for instant FaceOffs for the next N minutes. */
export async function setAvailability(userId: string, minutes: number) {
  const until = minutes > 0 ? new Date(Date.now() + Math.min(minutes, 180) * 60_000) : null;
  await asUser(userId, (tx) => tx`update faceoff.profiles set available_until = ${until} where user_id = ${userId}`);
  return { availableUntil: until?.toISOString() ?? null };
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Re-encodes to 512×512 WebP: strips EXIF/GPS metadata and neutralizes malformed images. */
export async function uploadAvatar(userId: string, file: File): Promise<{ avatarUrl: string }> {
  // Serverless hosts have no persistent disk: without S3 storage, say so instead of failing obscurely.
  if (process.env.VERCEL && process.env.STORAGE_DRIVER !== "s3") {
    throw new ApiError(503, "uploads_unavailable", "Picture uploads aren't set up on this server yet.");
  }
  if (file.size > MAX_AVATAR_BYTES) throw badRequest("Images must be under 5 MB");
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) throw badRequest("Use a JPG, PNG, WebP or GIF image");
  let out: Buffer;
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw badRequest("That file doesn't look like a valid image");
  }
  const key = `avatars/${userId}/${randomBytes(8).toString("hex")}.webp`;
  await putObject(key, out, "image/webp");
  await asUser(userId, (tx) => tx`update faceoff.profiles set avatar_key = ${key} where user_id = ${userId}`);
  const { publicUrl } = await import("../storage");
  return { avatarUrl: publicUrl(key)! };
}

export async function follow(userId: string, targetId: string) {
  if (userId === targetId) throw badRequest("You can't follow yourself");
  const inserted = await asUser(userId, async (tx) => {
    const r = await tx`insert into faceoff.follows (follower_id, followee_id) values (${userId}, ${targetId}) on conflict do nothing`;
    return r.count > 0;
  });
  if (inserted) {
    await asService(async (tx) => {
      const [actor] = await tx`select username, display_name from faceoff.profiles where user_id = ${userId}`;
      await notify(tx, {
        userId: targetId,
        kind: "new_follower",
        actorId: userId,
        entity: { type: "user", id: userId },
        title: `${actor?.display_name ?? "Someone"} followed you`,
        href: `/u/${actor?.username ?? ""}`,
        dedupeKey: `follow:${userId}`,
      });
    });
  }
}

export async function unfollow(userId: string, targetId: string) {
  await asUser(userId, (tx) => tx`delete from faceoff.follows where follower_id = ${userId} and followee_id = ${targetId}`);
}

/** Blocking removes follows both ways and cancels pending challenges between the two. */
export async function block(userId: string, targetId: string) {
  if (userId === targetId) throw badRequest("You can't block yourself");
  await asUser(userId, async (tx) => {
    const exists = await tx`select 1 from faceoff.profiles where user_id = ${targetId}`;
    if (!exists.length) throw notFound("User not found");
    await tx`insert into faceoff.blocks (blocker_id, blocked_id) values (${userId}, ${targetId}) on conflict do nothing`;
  });
  await asService(async (tx) => {
    await tx`delete from faceoff.follows where (follower_id = ${userId} and followee_id = ${targetId}) or (follower_id = ${targetId} and followee_id = ${userId})`;
    await tx`update faceoff.challenges set status = 'cancelled', responded_at = now()
             where status = 'pending' and ((challenger_id = ${userId} and recipient_id = ${targetId}) or (challenger_id = ${targetId} and recipient_id = ${userId}))`;
  });
}

export async function unblock(userId: string, targetId: string) {
  await asUser(userId, (tx) => tx`delete from faceoff.blocks where blocker_id = ${userId} and blocked_id = ${targetId}`);
}

export async function mute(userId: string, targetId: string, on: boolean) {
  if (userId === targetId) throw badRequest("You can't mute yourself");
  await asUser(userId, (tx) =>
    on
      ? tx`insert into faceoff.mutes (muter_id, muted_id) values (${userId}, ${targetId}) on conflict do nothing`
      : tx`delete from faceoff.mutes where muter_id = ${userId} and muted_id = ${targetId}`,
  );
}

export async function listBlocked(userId: string): Promise<ProfileSummary[]> {
  return asUser(userId, async (tx) => {
    const rows = await tx`select ${tx.unsafe(PROFILE_COLS)} from faceoff.blocks b join faceoff.profiles p on p.user_id = b.blocked_id where b.blocker_id = ${userId} order by b.created_at desc`;
    return rows.map((r) => toProfileSummary(r as never));
  });
}

export async function listFollows(username: string, direction: "followers" | "following", viewerId: string | null): Promise<ProfileSummary[]> {
  return asUser(viewerId, async (tx) => {
    const [t] = await tx`select user_id from faceoff.profiles where username = ${username}`;
    if (!t) throw notFound();
    const rows =
      direction === "followers"
        ? await tx`select ${tx.unsafe(PROFILE_COLS)} from faceoff.follows f join faceoff.profiles p on p.user_id = f.follower_id where f.followee_id = ${t.user_id} and p.account_status = 'active' order by f.created_at desc limit 200`
        : await tx`select ${tx.unsafe(PROFILE_COLS)} from faceoff.follows f join faceoff.profiles p on p.user_id = f.followee_id where f.follower_id = ${t.user_id} and p.account_status = 'active' order by f.created_at desc limit 200`;
    return rows.map((r) => toProfileSummary(r as never));
  });
}

export async function getPreferences(userId: string) {
  const [p] = await asUser(userId, (tx) => tx`select * from faceoff.user_preferences where user_id = ${userId}`);
  if (!p) throw notFound();
  return {
    notifyChallenges: p.notify_challenges,
    notifyReminders: p.notify_reminders,
    notifyFollowers: p.notify_followers,
    notifyCommunity: p.notify_community,
    notifyReplays: p.notify_replays,
    emailNotifications: p.email_notifications,
  };
}

export async function updatePreferences(userId: string, input: Record<string, boolean | undefined>) {
  const map: Record<string, string> = {
    notifyChallenges: "notify_challenges",
    notifyReminders: "notify_reminders",
    notifyFollowers: "notify_followers",
    notifyCommunity: "notify_community",
    notifyReplays: "notify_replays",
    emailNotifications: "email_notifications",
  };
  const patch: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(input)) if (typeof v === "boolean" && map[k]) patch[map[k]] = v;
  if (!Object.keys(patch).length) return;
  await asUser(userId, (tx) => tx`update faceoff.user_preferences set ${tx(patch)} where user_id = ${userId}`);
}

export async function searchPeople(q: string, viewerId: string | null, limit = 20): Promise<ProfileSummary[]> {
  const term = q.trim().slice(0, 50);
  if (term.length < 2) return [];
  return asUser(viewerId, async (tx) => {
    const like = `%${term.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    const rows = await tx`
      select ${tx.unsafe(PROFILE_COLS)} from faceoff.profiles p
      where p.onboarded_at is not null and p.account_status = 'active' and (p.username ilike ${like} or p.display_name ilike ${like})
      order by (p.username = ${term.toLowerCase()}) desc, p.is_demo, p.display_name limit ${limit}`;
    return rows.map((r) => toProfileSummary(r as never));
  });
}

