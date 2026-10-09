import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { UserRole } from "@faceoff/shared";
import { asService } from "./db";
import { env } from "./env";
import { newToken, sha256 } from "./crypto";

export interface Viewer {
  userId: string;
  sessionId: string;
  email: string;
  role: UserRole;
  status: "active" | "suspended" | "banned" | "deleted";
  suspendedUntil: Date | null;
  emailVerified: boolean;
  onboarded: boolean;
  username: string | null;
  displayName: string | null;
  avatarKey: string | null;
  isDemo: boolean;
}

const TOUCH_INTERVAL_MS = 5 * 60_000;

export async function createSession(userId: string, client: "web" | "mobile", userAgent: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);
  await asService(
    (tx) => tx`
      insert into faceoff.auth_sessions (user_id, token_hash, client, user_agent, expires_at)
      values (${userId}, ${sha256(token)}, ${client}, ${userAgent?.slice(0, 300) ?? null}, ${expiresAt})`,
  );
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.APP_ENV === "production" || env.APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(env.AUTH_COOKIE_NAME);
}

export async function revokeSession(sessionId: string) {
  await asService((tx) => tx`update faceoff.auth_sessions set revoked_at = now() where id = ${sessionId} and revoked_at is null`);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await asService(
    (tx) => tx`update faceoff.auth_sessions set revoked_at = now()
      where user_id = ${userId} and revoked_at is null and id <> ${exceptSessionId ?? "00000000-0000-0000-0000-000000000000"}`,
  );
}

/** Reads the session token from the Authorization header (mobile) or the session cookie (web). */
export async function readSessionToken(): Promise<{ token: string; via: "bearer" | "cookie" } | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t.length >= 20 && t.length <= 200) return { token: t, via: "bearer" };
  }
  const jar = await cookies();
  const c = jar.get(env.AUTH_COOKIE_NAME)?.value;
  if (c && c.length >= 20 && c.length <= 200) return { token: c, via: "cookie" };
  return null;
}

export async function viewerFromToken(token: string): Promise<Viewer | null> {
  return asService(async (tx) => {
    const rows = await tx<
      Array<{
        session_id: string;
        last_used_at: Date;
        user_id: string;
        email: string;
        role: UserRole;
        status: Viewer["status"];
        suspended_until: Date | null;
        email_verified_at: Date | null;
        is_demo: boolean;
        username: string | null;
        display_name: string | null;
        avatar_key: string | null;
        onboarded_at: Date | null;
        last_active_at: Date | null;
      }>
    >`
      select s.id as session_id, s.last_used_at, u.id as user_id, u.email, u.role, u.status, u.suspended_until,
             u.email_verified_at, u.is_demo, u.last_active_at, p.username, p.display_name, p.avatar_key, p.onboarded_at
      from faceoff.auth_sessions s
      join faceoff.users u on u.id = s.user_id
      left join faceoff.profiles p on p.user_id = u.id
      where s.token_hash = ${sha256(token)} and s.revoked_at is null and s.expires_at > now()`;
    const r = rows[0];
    if (!r) return null;
    if (r.status === "banned" || r.status === "deleted") return null;

    let status = r.status;
    // Lift an expired temporary suspension.
    if (status === "suspended" && r.suspended_until && r.suspended_until < new Date()) {
      await tx`update faceoff.users set status = 'active', suspended_until = null where id = ${r.user_id}`;
      await tx`update faceoff.profiles set account_status = 'active' where user_id = ${r.user_id}`;
      status = "active";
    }
    if (Date.now() - r.last_used_at.getTime() > TOUCH_INTERVAL_MS) {
      await tx`update faceoff.auth_sessions set last_used_at = now() where id = ${r.session_id}`;
      await tx`update faceoff.users set last_active_at = now() where id = ${r.user_id}`;
      // One "active day" event per user per UTC day powers returning-user and cohort retention metrics.
      const today = new Date().toISOString().slice(0, 10);
      if (!r.last_active_at || r.last_active_at.toISOString().slice(0, 10) !== today) {
        await tx`insert into faceoff.analytics_events (name, user_id, props, is_demo) values ('session_started', ${r.user_id}, '{}', ${r.is_demo})`;
      }
    }
    return {
      userId: r.user_id,
      sessionId: r.session_id,
      email: r.email,
      role: r.role,
      status,
      suspendedUntil: r.suspended_until,
      emailVerified: r.email_verified_at !== null,
      onboarded: r.onboarded_at !== null,
      username: r.username,
      displayName: r.display_name,
      avatarKey: r.avatar_key,
      isDemo: r.is_demo,
    };
  });
}

/** The signed-in viewer for this request (memoized per request), or null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const t = await readSessionToken();
  if (!t) return null;
  return viewerFromToken(t.token);
});

export function isStaff(v: Viewer | null): boolean {
  return !!v && v.status === "active" && (v.role === "moderator" || v.role === "admin");
}
export function isAdmin(v: Viewer | null): boolean {
  return !!v && v.status === "active" && v.role === "admin";
}
