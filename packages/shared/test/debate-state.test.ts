import { describe, expect, it } from "vitest";
import {
  DISCONNECT_GRACE_SECONDS,
  NO_SHOW_GRACE_SECONDS,
  READY_WINDOW_BEFORE_START_SECONDS,
  canTransition,
  evaluateTimedTransition,
  formatClock,
  isTerminal,
  liveWindow,
  remainingSeconds,
  shouldGoLive,
  type ParticipantSnapshot,
  type SessionSnapshot,
} from "../src";

const t0 = new Date("2026-10-09T12:00:00Z");
const at = (s: number) => new Date(t0.getTime() + s * 1000);
const p = (id: string, o: Partial<ParticipantSnapshot> = {}): ParticipantSnapshot => ({ userId: id, readyAt: null, lastSeenAt: null, leftAt: null, ...o });
const sess = (o: Partial<SessionSnapshot>): SessionSnapshot => ({ status: "ready", scheduledStart: null, readyOpenedAt: t0, liveStartedAt: null, endsAt: null, ...o });

describe("transition table", () => {
  it("allows the happy path and forbids going backwards", () => {
    expect(canTransition("created", "ready")).toBe(true);
    expect(canTransition("scheduled", "ready")).toBe(true);
    expect(canTransition("ready", "live")).toBe(true);
    expect(canTransition("live", "completed")).toBe(true);
    expect(canTransition("live", "interrupted")).toBe(true);
    expect(canTransition("completed", "live")).toBe(false);
    expect(canTransition("live", "ready")).toBe(false);
    expect(canTransition("cancelled", "ready")).toBe(false);
  });
  it("marks terminal states", () => {
    for (const s of ["completed", "cancelled", "failed", "interrupted"] as const) expect(isTerminal(s)).toBe(true);
    for (const s of ["created", "scheduled", "ready", "live"] as const) expect(isTerminal(s)).toBe(false);
  });
});

describe("scheduled sessions", () => {
  const start = at(3600);
  it("stays scheduled until the green room window", () => {
    expect(evaluateTimedTransition(sess({ status: "scheduled", scheduledStart: start, readyOpenedAt: null }), [p("a"), p("b")], at(3600 - READY_WINDOW_BEFORE_START_SECONDS - 1))).toBeNull();
  });
  it("opens the green room 15 minutes before start", () => {
    expect(evaluateTimedTransition(sess({ status: "scheduled", scheduledStart: start, readyOpenedAt: null }), [p("a"), p("b")], at(3600 - READY_WINDOW_BEFORE_START_SECONDS))?.to).toBe("ready");
  });
  it("fails as a no-show if nobody came", () => {
    const r = evaluateTimedTransition(sess({ status: "scheduled", scheduledStart: start, readyOpenedAt: null }), [p("a"), p("b")], at(3600 + NO_SHOW_GRACE_SECONDS));
    expect(r).toMatchObject({ to: "failed", reason: "no_show" });
  });
});

describe("ready sessions", () => {
  it("goes live only when both debaters are ready", () => {
    expect(shouldGoLive(sess({}), [p("a", { readyAt: t0 }), p("b")])).toBe(false);
    expect(shouldGoLive(sess({}), [p("a", { readyAt: t0 }), p("b", { readyAt: t0 })])).toBe(true);
    expect(shouldGoLive(sess({ status: "live" }), [p("a", { readyAt: t0 }), p("b", { readyAt: t0 })])).toBe(false);
  });
  it("blames only the missing debater for a no-show", () => {
    const r = evaluateTimedTransition(sess({}), [p("a", { readyAt: t0 }), p("b")], at(NO_SHOW_GRACE_SECONDS));
    expect(r).toMatchObject({ to: "failed", reason: "no_show", responsibleUserIds: ["b"] });
  });
  it("waits before the no-show deadline", () => {
    expect(evaluateTimedTransition(sess({}), [p("a", { readyAt: t0 }), p("b")], at(NO_SHOW_GRACE_SECONDS - 1))).toBeNull();
  });
});

describe("live sessions", () => {
  const { liveStartedAt, endsAt } = liveWindow(t0);
  const live = sess({ status: "live", liveStartedAt, endsAt });
  const present = (s: number) => [p("a", { readyAt: t0, lastSeenAt: at(s) }), p("b", { readyAt: t0, lastSeenAt: at(s) })];
  it("runs for exactly ten minutes", () => {
    expect(endsAt.getTime() - liveStartedAt.getTime()).toBe(600_000);
    expect(evaluateTimedTransition(live, present(599), at(599))).toBeNull();
    expect(evaluateTimedTransition(live, present(599), at(600))).toMatchObject({ to: "completed", reason: "time_elapsed" });
  });
  it("interrupts when a debater is gone past the grace window", () => {
    const ps = [p("a", { readyAt: t0, lastSeenAt: at(200) }), p("b", { readyAt: t0, lastSeenAt: at(100) })];
    expect(evaluateTimedTransition(live, ps, at(100 + DISCONNECT_GRACE_SECONDS - 1))).toBeNull();
    expect(evaluateTimedTransition(live, ps, at(100 + DISCONNECT_GRACE_SECONDS))).toMatchObject({ to: "interrupted", responsibleUserIds: ["b"] });
  });
  it("treats an explicit leave the same way", () => {
    const ps = [p("a", { readyAt: t0, lastSeenAt: at(300) }), p("b", { readyAt: t0, lastSeenAt: at(300), leftAt: at(250) })];
    expect(evaluateTimedTransition(live, ps, at(250 + DISCONNECT_GRACE_SECONDS))).toMatchObject({ to: "interrupted", responsibleUserIds: ["b"] });
  });
  it("time-up wins over a late disconnect", () => {
    const ps = [p("a", { readyAt: t0, lastSeenAt: at(10) }), p("b", { readyAt: t0, lastSeenAt: at(10) })];
    expect(evaluateTimedTransition(live, ps, at(700))?.to).toBe("completed");
  });
});

describe("clock helpers", () => {
  it("formats mm:ss", () => {
    expect(formatClock(600)).toBe("10:00");
    expect(formatClock(59)).toBe("00:59");
    expect(formatClock(0)).toBe("00:00");
  });
  it("uses the server offset, never going negative", () => {
    const ends = new Date(Date.now() + 30_000).toISOString();
    expect(remainingSeconds(ends, 0)).toBeGreaterThanOrEqual(29);
    expect(remainingSeconds(ends, 10_000)).toBeLessThanOrEqual(20);
    expect(remainingSeconds(ends, 60_000)).toBe(0);
  });
});
