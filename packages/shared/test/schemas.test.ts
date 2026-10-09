import { describe, expect, it } from "vitest";
import { ageOn, createChallengeSchema, dateOfBirthSchema, passwordSchema, signUpSchema, usernameSchema } from "../src";

describe("account validation", () => {
  it("enforces 18+ by date of birth", () => {
    const on = new Date("2026-10-09T00:00:00Z");
    expect(ageOn("2008-10-09", on)).toBe(18);
    expect(ageOn("2008-10-10", on)).toBe(17);
    expect(dateOfBirthSchema.safeParse("1990-02-03").success).toBe(true);
    const kid = new Date(Date.now() - 17 * 365.25 * 86_400_000).toISOString().slice(0, 10);
    expect(dateOfBirthSchema.safeParse(kid).success).toBe(false);
  });
  it("requires strong-enough passwords", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletterslong").success).toBe(false);
    expect(passwordSchema.safeParse("Debate-2026-ok").success).toBe(true);
  });
  it("normalises and restricts usernames", () => {
    expect(usernameSchema.parse("  Nora_A ")).toBe("nora_a");
    expect(usernameSchema.safeParse("admin").success).toBe(false);
    expect(usernameSchema.safeParse("no spaces").success).toBe(false);
    expect(usernameSchema.safeParse("ab").success).toBe(false);
  });
  it("requires accepting the terms", () => {
    expect(signUpSchema.safeParse({ email: "a@b.co", password: "Debate-2026-ok", dateOfBirth: "1990-01-01", acceptTerms: false }).success).toBe(false);
    expect(signUpSchema.safeParse({ email: "A@B.co", password: "Debate-2026-ok", dateOfBirth: "1990-01-01", acceptTerms: true }).data?.email).toBe("a@b.co");
  });
});

describe("challenge validation", () => {
  const id = "6f587555-7fb4-461d-bd06-9c2e177e7edf";
  it("accepts an instant challenge", () => {
    expect(createChallengeSchema.safeParse({ recipientId: id, proposition: "Voting should be mandatory", challengerSide: "for", kind: "instant" }).success).toBe(true);
  });
  it("requires a time for scheduled challenges, at least 5 minutes ahead", () => {
    expect(createChallengeSchema.safeParse({ recipientId: id, proposition: "Voting should be mandatory", challengerSide: "for", kind: "scheduled" }).success).toBe(false);
    const soon = new Date(Date.now() + 60_000).toISOString();
    expect(createChallengeSchema.safeParse({ recipientId: id, proposition: "Voting should be mandatory", challengerSide: "for", kind: "scheduled", proposedStart: soon }).success).toBe(false);
    const later = new Date(Date.now() + 3600_000).toISOString();
    expect(createChallengeSchema.safeParse({ recipientId: id, proposition: "Voting should be mandatory", challengerSide: "for", kind: "scheduled", proposedStart: later }).success).toBe(true);
  });
  it("rejects vague or overlong propositions", () => {
    expect(createChallengeSchema.safeParse({ recipientId: id, proposition: "hmm", challengerSide: "for", kind: "instant" }).success).toBe(false);
    expect(createChallengeSchema.safeParse({ recipientId: id, proposition: "x".repeat(161), challengerSide: "for", kind: "instant" }).success).toBe(false);
  });
});
