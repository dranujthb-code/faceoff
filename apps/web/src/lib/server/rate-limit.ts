import "server-only";
import { asService } from "./db";
import { tooMany } from "./errors";

export interface RateRule {
  /** bucket name, e.g. "comment" */
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_RULES = {
  signUp: { name: "signup", limit: 5, windowSeconds: 3600 },
  signIn: { name: "signin", limit: 10, windowSeconds: 600 },
  passwordReset: { name: "pwreset", limit: 5, windowSeconds: 3600 },
  verifyResend: { name: "verify", limit: 5, windowSeconds: 3600 },
  challenge: { name: "challenge", limit: 15, windowSeconds: 3600 },
  challengeBurst: { name: "challenge_burst", limit: 4, windowSeconds: 60 },
  comment: { name: "comment", limit: 8, windowSeconds: 30 },
  reaction: { name: "reaction", limit: 30, windowSeconds: 30 },
  vote: { name: "vote", limit: 20, windowSeconds: 60 },
  report: { name: "report", limit: 20, windowSeconds: 3600 },
  motion: { name: "motion", limit: 10, windowSeconds: 3600 },
  follow: { name: "follow", limit: 60, windowSeconds: 600 },
  upload: { name: "upload", limit: 10, windowSeconds: 3600 },
  contact: { name: "contact", limit: 5, windowSeconds: 3600 },
} satisfies Record<string, RateRule>;

/** Throws 429 when `subject` exceeded the rule. Fixed window, shared across instances via Postgres. */
export async function enforceRateLimit(rule: RateRule, subject: string): Promise<void> {
  const windowStart = new Date(Math.floor(Date.now() / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000);
  const key = `${rule.name}:${subject}`;
  const count = await asService(async (tx) => {
    const [row] = await tx<{ count: number }[]>`
      insert into faceoff.rate_limits (key, window_start, count) values (${key}, ${windowStart}, 1)
      on conflict (key, window_start) do update set count = faceoff.rate_limits.count + 1
      returning count`;
    // opportunistic cleanup of old windows (cheap, bounded)
    if (Math.random() < 0.01) await tx`delete from faceoff.rate_limits where window_start < now() - interval '1 day'`;
    return row?.count ?? 1;
  });
  if (count > rule.limit) throw tooMany();
}
