"use client";
import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { END_REASON_LABELS, POLL_DEFINITIONS, type EndReason, type SessionState } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { Notice } from "../ui";
import { LocalTime } from "../LocalTime";

function Bar({ label, pct, tone }: { label: string; pct: number; tone: "for" | "against" | "neutral" }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="font-medium">{label}</span><span className="tabular-nums text-muted">{pct}%</span></div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sunken">
        <div className={clsx("h-full rounded-full", tone === "for" ? "bg-for" : tone === "against" ? "bg-against" : "bg-line-strong")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Results({ state }: { state: SessionState }) {
  const s = state.session;
  const reported = useRef(false);
  const replay = state.recording.status === "ready" && state.recording.playbackUrl;
  useEffect(() => {
    if (replay && !reported.current) {
      reported.current = true;
      api(`/debates/${s.id}/share`, { body: { channel: "copy", replay: true } }).catch(() => {});
    }
  }, [replay, s.id]);
  const label = (c: string) => (c === "for" ? `${s.forSide.displayName} (for)` : c === "against" ? `${s.againstSide.displayName} (against)` : c === "tie" ? "Even" : "Undecided");
  const failed = s.status === "failed" || s.status === "cancelled";
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-serif text-2xl font-semibold">
          {s.status === "completed" ? "Debate complete" : s.status === "interrupted" ? "Debate interrupted" : s.status === "failed" ? "This debate didn't happen" : "Debate cancelled"}
        </h2>
        <p className="mt-1 text-muted">
          {s.endReason ? END_REASON_LABELS[s.endReason as EndReason] : null}
          {s.endedAt && <> Ended <LocalTime iso={s.endedAt} />.</>}
        </p>
        {!failed && (
          <div className="mt-5">
            {replay ? (
              <video controls preload="metadata" src={state.recording.playbackUrl!} className="aspect-video w-full rounded-xl bg-black" />
            ) : (
              <Notice>
                {state.recording.status === "processing" || state.recording.status === "recording" || state.recording.status === "requested"
                  ? "The replay is processing. It appears here once the recording service confirms it's ready."
                  : state.recording.status === "failed"
                    ? "The recording couldn't be processed, so there's no replay for this debate."
                    : "This debate wasn't recorded, so there's no replay."}
              </Notice>
            )}
          </div>
        )}
      </div>
      {!failed && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["persuasion", "position"] as const).map((k) => {
            const p = state.polls[k];
            return (
              <div key={k} className="rounded-2xl border border-line bg-surface p-5">
                <h3 className="font-semibold">{POLL_DEFINITIONS[k].question}</h3>
                <p className="mt-0.5 text-xs text-muted">{POLL_DEFINITIONS[k].help}</p>
                <div className="mt-4 space-y-3">
                  {POLL_DEFINITIONS[k].choices.map((c) => (
                    <Bar key={c} label={label(c)} pct={p.total ? Math.round(((p.tallies[c] ?? 0) / p.total) * 100) : 0} tone={c === "for" ? "for" : c === "against" ? "against" : "neutral"} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">{p.total} vote{p.total === 1 ? "" : "s"}{p.status === "open" ? " — voting still open" : " — final"}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
