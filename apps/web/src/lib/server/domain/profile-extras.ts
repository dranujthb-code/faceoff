import "server-only";
import { asUser } from "../db";

export async function getAvailability(userId: string): Promise<string | null> {
  const [r] = await asUser(userId, (tx) => tx<{ available_until: Date | null }[]>`select available_until from faceoff.profiles where user_id = ${userId}`);
  return r?.available_until && r.available_until > new Date() ? r.available_until.toISOString() : null;
}

export async function savedAndHistory(userId: string) {
  return asUser(userId, async (tx) => ({
    saved: (await tx<{ session_id: string }[]>`select session_id from faceoff.saved_debates where user_id = ${userId} order by created_at desc limit 50`).map((r) => r.session_id),
    history: (await tx<{ session_id: string; watched_seconds: number; last_viewed_at: Date }[]>`select session_id, watched_seconds, last_viewed_at from faceoff.view_history where user_id = ${userId} order by last_viewed_at desc limit 50`),
  }));
}
