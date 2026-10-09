import "server-only";
import { asService, type Tx } from "./db";

/**
 * Privacy-conscious product analytics. Event names are a closed list; props must not contain
 * free text or personal data (no emails, names, IPs or user agents).
 */
export const ANALYTICS_EVENTS = [
  "signup_completed",
  "email_verified",
  "onboarding_completed",
  "community_joined",
  "challenge_sent",
  "challenge_accepted",
  "challenge_declined",
  "debate_started",
  "debate_completed",
  "debate_interrupted",
  "debate_failed",
  "debate_viewed",
  "watch_time",
  "comment_posted",
  "vote_cast",
  "reaction_sent",
  "replay_viewed",
  "share_clicked",
  "report_filed",
  "enforcement_action",
  "session_started",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

type Props = Record<string, string | number | boolean | null>;

export async function track(name: AnalyticsEvent, userId: string | null, props: Props = {}, opts: { sessionId?: string; isDemo?: boolean; tx?: Tx } = {}) {
  const run = (tx: Tx) =>
    tx`insert into faceoff.analytics_events (name, user_id, session_id, props, is_demo)
       values (${name}, ${userId}, ${opts.sessionId ?? null}, ${tx.json(props)}, ${opts.isDemo ?? false})`;
  try {
    if (opts.tx) await run(opts.tx);
    else await asService(run);
  } catch (e) {
    // analytics must never break a user flow
    console.error("analytics failed", name, (e as Error).message);
  }
}
