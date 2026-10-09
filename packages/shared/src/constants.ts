export const DEBATE_DURATION_SECONDS = 600; // the standard 10-minute FaceOff
export const INSTANT_CHALLENGE_TTL_SECONDS = 15 * 60; // instant invites expire after 15 minutes
export const NO_SHOW_GRACE_SECONDS = 10 * 60; // scheduled debate fails if both aren't ready within 10 min of start
export const READY_WINDOW_BEFORE_START_SECONDS = 15 * 60; // green room opens 15 min before scheduled start
export const DISCONNECT_GRACE_SECONDS = 90; // a debater may drop and rejoin within 90s; after that the debate is interrupted
export const PRESENCE_STALE_SECONDS = 30; // heartbeat staleness threshold
export const VIEWER_STALE_SECONDS = 30;
export const MIN_AGE = 18;
export const COMMENT_MAX_LENGTH = 500;
export const PROPOSITION_MAX_LENGTH = 160;
export const MOTION_LISTING_THRESHOLD_PCT = 20; // BRD: proposed topic listed with 20% community support
export const MOTION_LISTING_MIN_VOTES = 3;

export const CONSENT_VERSIONS = {
  terms: "2026-10-09",
  rules: "2026-10-09",
  recording: "2026-10-09",
} as const;

export const SESSION_STATUSES = [
  "created",
  "scheduled",
  "ready",
  "live",
  "completed",
  "cancelled",
  "failed",
  "interrupted",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const TERMINAL_SESSION_STATUSES: readonly SessionStatus[] = ["completed", "cancelled", "failed", "interrupted"];

export const CHALLENGE_STATUSES = ["pending", "accepted", "declined", "cancelled", "expired", "completed"] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const SIDES = ["for", "against"] as const;
export type Side = (typeof SIDES)[number];
export const oppositeSide = (s: Side): Side => (s === "for" ? "against" : "for");

export const REGIONS = ["global", "middle_east", "south_asia", "europe", "americas", "africa", "east_asia", "oceania"] as const;
export type Region = (typeof REGIONS)[number];
export const REGION_LABELS: Record<Region, string> = {
  global: "Global",
  middle_east: "Middle East",
  south_asia: "South Asia",
  europe: "Europe",
  americas: "Americas",
  africa: "Africa",
  east_asia: "East Asia",
  oceania: "Oceania",
};

export const REACTIONS = ["fire", "clap", "think", "laugh", "doubt"] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export const REACTION_EMOJI: Record<ReactionKind, string> = {
  fire: "🔥",
  clap: "👏",
  think: "🤔",
  laugh: "😂",
  doubt: "🧐",
};

/**
 * Two deliberately separate audience polls. Neither measures factual correctness.
 *  - persuasion: who made the stronger case in this debate (independent of the voter's own view)
 *  - position: which side of the proposition the voter personally supports
 */
export const POLL_KINDS = ["persuasion", "position"] as const;
export type PollKind = (typeof POLL_KINDS)[number];
export const POLL_DEFINITIONS: Record<PollKind, { question: string; help: string; choices: readonly string[] }> = {
  persuasion: {
    question: "Who argued more persuasively?",
    help: "Judge the arguments made in this debate, not whether you agree. This is not a measure of who is factually right.",
    choices: ["for", "against", "tie"],
  },
  position: {
    question: "Which position do you support?",
    help: "Your own view on the proposition. Results show opinion among viewers, not truth.",
    choices: ["for", "against", "undecided"],
  },
};

export const REPORT_REASONS = [
  "harassment",
  "hate",
  "threat",
  "doxxing",
  "impersonation",
  "sexual_content",
  "minor_safety",
  "spam",
  "self_harm",
  "illegal",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment or bullying",
  hate: "Hateful conduct against a protected group",
  threat: "Threats or incitement to violence",
  doxxing: "Sharing private information (doxxing)",
  impersonation: "Impersonation",
  sexual_content: "Sexual content",
  minor_safety: "Child safety concern",
  spam: "Spam or scam",
  self_harm: "Self-harm or suicide concern",
  illegal: "Illegal activity",
  other: "Something else",
};
/** Reasons triaged ahead of everything else in the admin queue. */
export const URGENT_REPORT_REASONS: readonly ReportReason[] = ["threat", "minor_safety", "self_harm", "doxxing"];

export const REPORT_TARGETS = ["user", "session", "comment", "motion"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const NOTIFICATION_KINDS = [
  "challenge_received",
  "challenge_accepted",
  "challenge_declined",
  "challenge_rescheduled",
  "challenge_cancelled",
  "challenge_expired",
  "debate_reminder",
  "debate_starting",
  "debate_completed",
  "new_follower",
  "community_debate",
  "replay_ready",
  "mention",
  "motion_listed",
  "moderation_notice",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const PROFILE_VISIBILITY = ["public", "followers"] as const;
export const CHALLENGE_ELIGIBILITY = ["everyone", "following", "nobody"] as const;
export type ChallengeEligibility = (typeof CHALLENGE_ELIGIBILITY)[number];

export const USER_ROLES = ["user", "moderator", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];
