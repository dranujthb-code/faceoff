import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/server/env";
import { sweepSessions } from "@/lib/server/domain/debates";
import { expireChallenges, sendReminders } from "@/lib/server/domain/challenges";
import { deliverPendingEmails } from "@/lib/server/domain/notifications";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const expected = env.CRON_SECRET;
  if (!expected) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Scheduled sweeper (every minute): debate clock, no-shows, challenge expiry, reminders, email. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  const expired = await expireChallenges();
  const reminders = await sendReminders();
  const { advanced } = await sweepSessions();
  const emailed = await deliverPendingEmails();
  return NextResponse.json({ ok: true, data: { expired, reminders, advanced, emailed } });
}
