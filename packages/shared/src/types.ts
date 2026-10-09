import type { ChallengeStatus, PollKind, ReactionKind, Region, SessionStatus, Side, UserRole } from "./constants";

/** API response envelope used by every /api/v1 endpoint. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };
export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface Me {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  onboarded: boolean;
  profile: ProfileSummary | null;
}

export interface ProfileSummary {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isDemo: boolean;
  availableNow?: boolean;
}

export interface ProfileDetail extends ProfileSummary {
  bio: string | null;
  location: string | null;
  region: Region | null;
  visibility: "public" | "followers";
  challengeEligibility: "everyone" | "following" | "nobody";
  createdAt: string;
  followers: number;
  following: number;
  debatesCompleted: number;
  topics: TopicSummary[];
  communities: CommunitySummary[];
  viewer: { isSelf: boolean; follows: boolean; blocked: boolean; canChallenge: boolean; canView: boolean } | null;
}

export interface TopicSummary {
  id: string;
  slug: string;
  name: string;
  category?: string;
}

export interface CommunitySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  topic: TopicSummary | null;
  memberCount: number;
  isDemo: boolean;
  isMember?: boolean;
}

export interface DebateCard {
  id: string;
  proposition: string;
  status: SessionStatus;
  visibility: "public" | "unlisted" | "private";
  scheduledStart: string | null;
  liveStartedAt: string | null;
  endsAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  community: { slug: string; name: string } | null;
  forSide: ProfileSummary;
  againstSide: ProfileSummary;
  hostId: string;
  recordingEnabled: boolean;
  replayStatus: "none" | "processing" | "ready" | "failed";
  stats: { comments: number; votes: number; views: number };
  isDemo: boolean;
}

export interface ChallengeView {
  id: string;
  status: ChallengeStatus;
  kind: "instant" | "scheduled";
  proposition: string;
  context: string | null;
  groundRules: string | null;
  challengerSide: Side;
  proposedStart: string | null;
  lastProposedBy: string;
  recordingEnabled: boolean;
  visibility: "public" | "unlisted";
  expiresAt: string;
  createdAt: string;
  challenger: ProfileSummary;
  recipient: ProfileSummary;
  community: { slug: string; name: string } | null;
  sessionId: string | null;
  /** what the current viewer may do */
  actions: Array<"accept" | "decline" | "cancel" | "propose_time" | "open_room">;
}

export interface SessionState {
  serverNow: string;
  session: DebateCard & {
    durationSeconds: number;
    readyOpenedAt: string | null;
    hostId: string;
  };
  participants: Array<{
    userId: string;
    side: Side;
    consentedAt: string | null;
    recordingConsent: boolean | null;
    readyAt: string | null;
    present: boolean;
    profile: ProfileSummary;
  }>;
  viewer: {
    role: "debater" | "audience" | "anonymous";
    side: Side | null;
    canComment: boolean;
    canVote: boolean;
    votes: Partial<Record<PollKind, string>>;
  };
  polls: Record<PollKind, { status: "open" | "closed"; tallies: Record<string, number>; total: number }>;
  reactions: Record<ReactionKind, number>;
  viewersNow: number;
  video: { configured: boolean; url: string | null };
  recording: { status: "none" | "requested" | "recording" | "processing" | "ready" | "failed"; playbackUrl: string | null };
}

export interface CommentView {
  id: string;
  body: string;
  createdAt: string;
  author: ProfileSummary;
  status: "visible" | "hidden" | "removed";
}

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  actor: ProfileSummary | null;
}

export interface OpponentCard {
  profile: ProfileSummary & { bio: string | null; region: Region | null };
  topics: TopicSummary[];
  sharedTopics: number;
  sharedCommunities: number;
  debatesCompleted: number;
  availableNow: boolean;
  motion: { id: string; title: string; authorSide: Side | null; community: { slug: string; name: string } | null } | null;
  score: number;
  reasons: string[];
}

export interface MotionView {
  id: string;
  title: string;
  context: string | null;
  status: "proposed" | "listed" | "archived";
  authorSide: Side | null;
  author: ProfileSummary;
  community: { id: string; slug: string; name: string } | null;
  supportVotes: number;
  viewerSupported: boolean;
  createdAt: string;
  isDemo: boolean;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}
