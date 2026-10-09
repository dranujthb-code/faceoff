import { describe, expect, it } from "vitest";
import { feedScore, motionReachesThreshold, opponentScore, trendingScore } from "../src";

const now = new Date("2026-10-09T12:00:00Z");
const base = { status: "completed", at: now, topicMatch: false, communityMatch: false, followsParticipant: false, votes: 0, comments: 0, views: 0, hasReplay: false };

describe("feed ranking", () => {
  it("puts live debates first", () => {
    expect(feedScore({ ...base, status: "live" }, now)).toBeGreaterThan(feedScore({ ...base, communityMatch: true, topicMatch: true }, now));
  });
  it("decays with age", () => {
    expect(feedScore(base, now)).toBeGreaterThan(feedScore({ ...base, at: new Date(now.getTime() - 72 * 3600_000) }, now));
  });
  it("rewards relevance and participation with diminishing returns", () => {
    expect(feedScore({ ...base, followsParticipant: true }, now)).toBeGreaterThan(feedScore(base, now));
    const a = feedScore({ ...base, votes: 10 }, now) - feedScore(base, now);
    const b = feedScore({ ...base, votes: 1000 }, now) - feedScore({ ...base, votes: 990 }, now);
    expect(a).toBeGreaterThan(b);
  });
});

describe("opponent ranking", () => {
  const o = { sharedTopics: 0, sharedCommunities: 0, availableNow: false, hasOpenMotion: false, lastActiveAt: null, completedDebates: 0, sameRegion: false };
  it("prefers available people with open motions and shared interests", () => {
    expect(opponentScore({ ...o, availableNow: true }, now)).toBeGreaterThan(opponentScore({ ...o, sharedTopics: 2 }, now));
    expect(opponentScore({ ...o, hasOpenMotion: true }, now)).toBeGreaterThan(opponentScore(o, now));
  });
  it("caps shared-topic credit", () => {
    expect(opponentScore({ ...o, sharedTopics: 50 }, now)).toBe(opponentScore({ ...o, sharedTopics: 5 }, now));
  });
});

describe("trending and motion listing", () => {
  it("decays trending activity over time", () => {
    const x = { challenges: 3, debates: 1, supportVotes: 5, viewers: 10 };
    expect(trendingScore({ ...x, lastActivityAt: now }, now)).toBeGreaterThan(trendingScore({ ...x, lastActivityAt: new Date(now.getTime() - 96 * 3600_000) }, now));
  });
  it("lists a community motion at 20% support with a minimum of three", () => {
    expect(motionReachesThreshold(2, 5)).toBe(false); // below minimum
    expect(motionReachesThreshold(3, 10)).toBe(true);
    expect(motionReachesThreshold(19, 100)).toBe(false);
    expect(motionReachesThreshold(20, 100)).toBe(true);
  });
});
