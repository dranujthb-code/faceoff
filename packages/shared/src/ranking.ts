/**
 * Transparent ranking. Every factor is documented and shown on /how-it-works.
 * Deliberately NOT used as signals: report counts, "controversy", dislike ratios, or
 * how heated comments are. We rank on recency, relevance to what you chose, and genuine
 * participation (completed debates, votes, watch time).
 */

export interface FeedItemSignals {
  status: "live" | "scheduled" | "ready" | "completed" | string;
  /** when it happens/happened (live start, scheduled start, or completion) */
  at: Date;
  topicMatch: boolean; // in a topic the viewer selected
  communityMatch: boolean; // in a community the viewer joined
  followsParticipant: boolean;
  votes: number;
  comments: number;
  views: number;
  hasReplay: boolean;
}

export const FEED_WEIGHTS = {
  live: 40,
  upcomingSoon: 18,
  followsParticipant: 25,
  communityMatch: 15,
  topicMatch: 10,
  replay: 5,
  engagement: 6, // multiplied by log10(1 + votes + comments/2 + views/10)
  halfLifeHours: 36,
} as const;

export function feedScore(s: FeedItemSignals, now: Date): number {
  const ageHours = Math.abs(now.getTime() - s.at.getTime()) / 3_600_000;
  const recency = Math.pow(0.5, ageHours / FEED_WEIGHTS.halfLifeHours) * 30;
  let score = recency;
  if (s.status === "live") score += FEED_WEIGHTS.live;
  if ((s.status === "scheduled" || s.status === "ready") && s.at.getTime() > now.getTime() && ageHours < 24) score += FEED_WEIGHTS.upcomingSoon;
  if (s.followsParticipant) score += FEED_WEIGHTS.followsParticipant;
  if (s.communityMatch) score += FEED_WEIGHTS.communityMatch;
  if (s.topicMatch) score += FEED_WEIGHTS.topicMatch;
  if (s.hasReplay) score += FEED_WEIGHTS.replay;
  score += FEED_WEIGHTS.engagement * Math.log10(1 + s.votes + s.comments / 2 + s.views / 10);
  return Math.round(score * 100) / 100;
}

export interface OpponentSignals {
  sharedTopics: number;
  sharedCommunities: number;
  availableNow: boolean;
  hasOpenMotion: boolean;
  lastActiveAt: Date | null;
  completedDebates: number;
  sameRegion: boolean;
}

export const OPPONENT_WEIGHTS = {
  sharedTopic: 8,
  sharedCommunity: 6,
  availableNow: 30,
  openMotion: 12,
  sameRegion: 4,
  experience: 3, // * log2(1 + completed)
  activeWithinDay: 10,
  activeWithinWeek: 4,
} as const;

export function opponentScore(s: OpponentSignals, now: Date): number {
  let score = 0;
  score += Math.min(s.sharedTopics, 5) * OPPONENT_WEIGHTS.sharedTopic;
  score += Math.min(s.sharedCommunities, 5) * OPPONENT_WEIGHTS.sharedCommunity;
  if (s.availableNow) score += OPPONENT_WEIGHTS.availableNow;
  if (s.hasOpenMotion) score += OPPONENT_WEIGHTS.openMotion;
  if (s.sameRegion) score += OPPONENT_WEIGHTS.sameRegion;
  score += OPPONENT_WEIGHTS.experience * Math.log2(1 + s.completedDebates);
  if (s.lastActiveAt) {
    const h = (now.getTime() - s.lastActiveAt.getTime()) / 3_600_000;
    if (h <= 24) score += OPPONENT_WEIGHTS.activeWithinDay;
    else if (h <= 24 * 7) score += OPPONENT_WEIGHTS.activeWithinWeek;
  }
  return Math.round(score * 100) / 100;
}

/** Trending motions/topics: recent challenges, debates and support votes with a 48h half-life. */
export function trendingScore(input: { challenges: number; debates: number; supportVotes: number; viewers: number; lastActivityAt: Date }, now: Date): number {
  const ageHours = (now.getTime() - input.lastActivityAt.getTime()) / 3_600_000;
  const decay = Math.pow(0.5, Math.max(0, ageHours) / 48);
  const raw = input.debates * 5 + input.challenges * 3 + input.supportVotes + Math.log10(1 + input.viewers) * 4;
  return Math.round(raw * decay * 100) / 100;
}

/** BRD rule: a proposed community motion is listed once it reaches 20% of members (min 3 votes). */
export function motionReachesThreshold(votes: number, members: number, pct = 20, minVotes = 3): boolean {
  if (votes < minVotes) return false;
  return votes >= Math.ceil((Math.max(members, 1) * pct) / 100);
}
