import {
  DEBATE_DURATION_SECONDS,
  DISCONNECT_GRACE_SECONDS,
  NO_SHOW_GRACE_SECONDS,
  READY_WINDOW_BEFORE_START_SECONDS,
  type SessionStatus,
  TERMINAL_SESSION_STATUSES,
} from "./constants";

/**
 * Server-authoritative debate session state machine.
 *
 *   CREATED ─▶ SCHEDULED ─▶ READY ─▶ LIVE ─▶ COMPLETED
 *      │           │          │        └──▶ INTERRUPTED (a debater dropped past the grace window)
 *      │           │          └──▶ FAILED (no-show)
 *      └───────────┴──────────┴──▶ CANCELLED
 *
 * The database row is the source of truth; these pure functions decide what the next
 * state must be. Callers apply transitions inside a row-locked transaction.
 */

export const TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  created: ["scheduled", "ready", "cancelled"],
  scheduled: ["ready", "cancelled", "failed"],
  ready: ["live", "cancelled", "failed"],
  live: ["completed", "interrupted", "failed"],
  completed: [],
  cancelled: [],
  failed: [],
  interrupted: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: SessionStatus): boolean {
  return TERMINAL_SESSION_STATUSES.includes(status);
}

export type EndReason =
  | "time_elapsed"
  | "host_ended"
  | "participant_left"
  | "no_show"
  | "cancelled"
  | "admin_terminated"
  | "video_failure";

export interface SessionSnapshot {
  status: SessionStatus;
  scheduledStart: Date | null;
  readyOpenedAt: Date | null;
  liveStartedAt: Date | null;
  endsAt: Date | null;
}

export interface ParticipantSnapshot {
  userId: string;
  readyAt: Date | null;
  lastSeenAt: Date | null;
  leftAt: Date | null;
}

export interface TimedTransition {
  to: SessionStatus;
  reason: EndReason | "green_room_open";
  /** For failures/interruptions: the participant(s) responsible, if determinable. */
  responsibleUserIds?: string[];
}

/** Determines a time-driven transition that must happen now, or null. */
export function evaluateTimedTransition(
  s: SessionSnapshot,
  participants: ParticipantSnapshot[],
  now: Date,
): TimedTransition | null {
  const t = now.getTime();
  switch (s.status) {
    case "scheduled": {
      if (!s.scheduledStart) return null;
      const open = s.scheduledStart.getTime() - READY_WINDOW_BEFORE_START_SECONDS * 1000;
      const deadline = s.scheduledStart.getTime() + NO_SHOW_GRACE_SECONDS * 1000;
      if (t >= deadline) return { to: "failed", reason: "no_show", responsibleUserIds: participants.map((p) => p.userId) };
      if (t >= open) return { to: "ready", reason: "green_room_open" };
      return null;
    }
    case "ready": {
      const anchor = s.scheduledStart ?? s.readyOpenedAt;
      if (!anchor) return null;
      const deadline = Math.max(anchor.getTime(), s.readyOpenedAt?.getTime() ?? 0) + NO_SHOW_GRACE_SECONDS * 1000;
      if (t >= deadline) {
        const missing = participants.filter((p) => !p.readyAt).map((p) => p.userId);
        return { to: "failed", reason: "no_show", responsibleUserIds: missing };
      }
      return null;
    }
    case "live": {
      if (s.endsAt && t >= s.endsAt.getTime()) return { to: "completed", reason: "time_elapsed" };
      const dropped = participants.filter((p) => {
        if (p.leftAt && t - p.leftAt.getTime() >= DISCONNECT_GRACE_SECONDS * 1000) return true;
        const seen = p.lastSeenAt?.getTime() ?? s.liveStartedAt?.getTime() ?? t;
        return t - seen >= DISCONNECT_GRACE_SECONDS * 1000;
      });
      if (dropped.length > 0) return { to: "interrupted", reason: "participant_left", responsibleUserIds: dropped.map((p) => p.userId) };
      return null;
    }
    default:
      return null;
  }
}

/** Both debaters have consented and marked themselves ready. */
export function shouldGoLive(s: SessionSnapshot, participants: ParticipantSnapshot[]): boolean {
  return s.status === "ready" && participants.length === 2 && participants.every((p) => p.readyAt !== null);
}

export function liveWindow(start: Date, durationSeconds = DEBATE_DURATION_SECONDS): { liveStartedAt: Date; endsAt: Date } {
  return { liveStartedAt: start, endsAt: new Date(start.getTime() + durationSeconds * 1000) };
}

/** Remaining seconds given the server's ends_at and the client's estimated server-clock offset. */
export function remainingSeconds(endsAtIso: string, serverOffsetMs: number, clientNow = Date.now()): number {
  const serverNow = clientNow + serverOffsetMs;
  return Math.max(0, Math.ceil((Date.parse(endsAtIso) - serverNow) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const END_REASON_LABELS: Record<EndReason, string> = {
  time_elapsed: "Time's up — the full 10 minutes were completed.",
  host_ended: "The host ended the debate early.",
  participant_left: "A debater disconnected and did not return in time.",
  no_show: "A debater did not show up.",
  cancelled: "The debate was cancelled.",
  admin_terminated: "The debate was stopped by FaceOff Trust & Safety.",
  video_failure: "The video connection failed.",
};
