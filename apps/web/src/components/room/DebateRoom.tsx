"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Bookmark, BookmarkCheck, Eye, Flag } from "lucide-react";
import {
  END_REASON_LABELS,
  NO_SHOW_GRACE_SECONDS,
  READY_WINDOW_BEFORE_START_SECONDS,
  formatClock,
  type CommentView,
  type EndReason,
  type ReactionKind,
  type SessionState,
} from "@faceoff/shared";
import { api, ClientApiError } from "@/lib/client/api";
import { Avatar } from "../Avatar";
import { Badge, Button, DemoBadge, LiveBadge, Modal, Notice } from "../ui";
import { LocalTime } from "../LocalTime";
import { ShareButton } from "../ShareButton";
import { ReportDialog } from "../ReportDialog";
import { useToast } from "../Toast";
import { VideoStage } from "./VideoStage";
import { GreenRoom } from "./GreenRoom";
import { AudiencePanel } from "./AudiencePanel";
import { Results } from "./Results";
import { useNow } from "@/lib/client/useNow";
import { useRouter } from "next/navigation";

interface Me { userId: string; username: string; displayName: string; onboarded: boolean; verified: boolean }

function viewerKeyForTab(): string {
  try {
    const k = sessionStorage.getItem("fo-vk");
    if (k) return k;
    const n = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem("fo-vk", n);
    return n;
  } catch {
    return Math.random().toString(36).slice(2, 14).padEnd(12, "x");
  }
}

export function DebateRoom({ initial, initialComments, initialSaved, me }: { initial: SessionState; initialComments: CommentView[]; initialSaved: boolean; me: Me | null }) {
  const [state, setState] = useState(initial);
  const [comments, setComments] = useState(initialComments);
  const [saved, setSaved] = useState(initialSaved);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "end" | "leave" | "cancel">(null);
  const [burst, setBurst] = useState<Array<{ id: number; kind: ReactionKind }>>([]);
  // server clock offset (ms), refined on every refresh using the round-trip time
  const [offset, setOffset] = useState(0);
  const lastReactions = useRef(initial.reactions);
  const [viewerKey] = useState(() => (typeof window === "undefined" ? "pending" : viewerKeyForTab()));
  const toast = useToast();
  const router = useRouter();
  const now = useNow(250);

  const s = state.session;
  const role = state.viewer.role;
  const isDebater = role === "debater";
  const me_p = state.participants.find((p) => p.userId === me?.userId);
  const status = s.status;
  const active = status === "ready" || status === "live";

  const refresh = useCallback(async () => {
    const t0 = Date.now();
    try {
      const next = active && viewerKey !== "pending"
        ? await api<SessionState>(`/debates/${s.id}/presence`, { body: { viewerKey } })
        : await api<SessionState>(`/debates/${s.id}/state`);
      const rtt = Date.now() - t0;
      setOffset(Date.parse(next.serverNow) + rtt / 2 - Date.now());
      // reaction burst animation for newly arrived reactions
      const added: Array<{ id: number; kind: ReactionKind }> = [];
      for (const k of Object.keys(next.reactions) as ReactionKind[]) {
        const diff = Math.min(5, next.reactions[k] - (lastReactions.current[k] ?? 0));
        for (let i = 0; i < diff; i++) added.push({ id: Date.now() + Math.random() * 1000, kind: k });
      }
      lastReactions.current = next.reactions;
      if (added.length) {
        setBurst((b) => [...b.slice(-12), ...added]);
        setTimeout(() => setBurst((b) => b.filter((x) => !added.includes(x))), 1500);
      }
      setState(next);
    } catch {
      // transient network errors are retried on the next tick
    }
  }, [s.id, active, viewerKey]);

  const refreshComments = useCallback(async () => {
    try { setComments(await api<CommentView[]>(`/debates/${s.id}/comments`)); } catch { /* retry next tick */ }
  }, [s.id]);

  // Polling cadence follows the session state. LiveKit data messages trigger immediate refreshes.
  useEffect(() => {
    const fast = status === "live" || status === "ready";
    const ms = fast ? 2500 : status === "scheduled" ? 15000 : 30000;
    const t = setInterval(() => { refresh(); refreshComments(); }, ms);
    const first = fast ? setTimeout(refresh, 0) : null;
    return () => { clearInterval(t); if (first) clearTimeout(first); };
  }, [status, refresh, refreshComments]);

  // When the server clock says time is up, ask the server to finalize right away.
  const remaining = s.endsAt && now !== null ? Math.max(0, Math.ceil((Date.parse(s.endsAt) - (now + offset)) / 1000)) : null;
  const askedEnd = useRef(false);
  useEffect(() => {
    if (status === "live" && remaining === 0 && !askedEnd.current) {
      askedEnd.current = true;
      setTimeout(refresh, 400);
    }
  }, [remaining, status, refresh]);

  // A debater closing the tab starts the 90-second reconnect grace period on the server.
  useEffect(() => {
    if (!isDebater || status !== "live") return;
    const onHide = () => navigator.sendBeacon?.(`/api/v1/debates/${s.id}/leave`);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [isDebater, status, s.id]);

  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRealtime = useCallback(() => {
    if (realtimeTimer.current) return;
    realtimeTimer.current = setTimeout(() => { realtimeTimer.current = null; refresh(); refreshComments(); }, 300);
  }, [refresh, refreshComments]);

  const act = async (path: "end" | "leave" | "cancel") => {
    try {
      await api(`/debates/${s.id}/${path}`, { body: {} });
      setConfirm(null);
      if (path === "leave") router.push("/home");
      else refresh();
    } catch (e) {
      toast(e instanceof ClientApiError ? e.message : "Something went wrong", "error");
    }
  };

  const toggleSave = async () => {
    if (!me) return router.push(`/signin?next=/d/${s.id}`);
    try { await api(`/debates/${s.id}/save`, { method: saved ? "DELETE" : "POST", body: {} }); setSaved(!saved); toast(saved ? "Removed from saved" : "Saved", "success"); }
    catch { toast("Couldn't update", "error"); }
  };

  const startsIn = s.scheduledStart && now !== null ? Date.parse(s.scheduledStart) - (now + offset) : null;
  const noShowDeadline = useMemo(() => {
    const anchor = Math.max(s.scheduledStart ? Date.parse(s.scheduledStart) : 0, s.readyOpenedAt ? Date.parse(s.readyOpenedAt) : 0);
    return anchor ? anchor + NO_SHOW_GRACE_SECONDS * 1000 : null;
  }, [s.scheduledStart, s.readyOpenedAt]);
  const debaterReady = !!me_p?.readyAt;
  const stageConnect = (isDebater && debaterReady && active) || (!isDebater && status === "live");
  const ended = ["completed", "interrupted", "failed", "cancelled"].includes(status);
  const lowTime = remaining !== null && remaining <= 60;

  return (
    <div className={clsx(active && "fo-stage min-h-[calc(100dvh-4rem)] bg-bg text-ink")}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {status === "live" ? <LiveBadge /> : <Badge tone={ended ? "neutral" : "for"}>{status === "ready" ? "Green room open" : status}</Badge>}
              {s.community && <Link href={`/c/${s.community.slug}`} className="font-medium text-muted hover:text-ink">{s.community.name}</Link>}
              {s.isDemo && <DemoBadge />}
              {s.visibility !== "public" && <Badge>Unlisted</Badge>}
              {(status === "live" || status === "ready") && <span className="inline-flex items-center gap-1 text-muted"><Eye className="h-4 w-4" aria-hidden />{state.viewersNow} watching</span>}
              {s.recordingEnabled && status === "live" && state.recording.status !== "none" && <Badge tone="against"><span className="h-1.5 w-1.5 rounded-full bg-against" aria-hidden />Recording</Badge>}
            </div>
            <h1 className="fo-proposition mt-3 text-3xl sm:text-4xl lg:text-5xl">{s.proposition}</h1>
            <p className="mt-2 text-sm text-muted">
              <Link href={`/u/${s.forSide.username}`} className="font-semibold text-for hover:underline">{s.forSide.displayName}</Link> argues for,{" "}
              <Link href={`/u/${s.againstSide.username}`} className="font-semibold text-against hover:underline">{s.againstSide.displayName}</Link> argues against.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {status === "live" && remaining !== null && (
              <div role="timer" aria-live="off" aria-label={`${formatClock(remaining)} remaining`} className={clsx("rounded-2xl border px-5 py-2 text-center", lowTime ? "border-against text-against" : "border-line-strong")}>
                <span className="block text-4xl font-semibold tabular-nums">{formatClock(remaining)}</span>
                <span className="block text-[11px] text-muted">server clock</span>
              </div>
            )}
            <ShareButton path={`/d/${s.id}`} title={s.proposition} sessionId={s.id} />
            <Button variant="secondary" size="sm" onClick={toggleSave} aria-pressed={saved}>
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{saved ? "Saved" : "Save"}
            </Button>
            {me && !isDebater && (
              <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)} aria-label="Report this debate"><Flag className="h-4 w-4" /></Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-6">
            {status === "scheduled" && (
              <div className="rounded-2xl border border-line bg-surface p-6 text-center">
                <p className="text-sm text-muted">Scheduled for</p>
                <p className="mt-1 font-serif text-3xl font-semibold">{s.scheduledStart && <LocalTime iso={s.scheduledStart} />}</p>
                {startsIn !== null && startsIn > 0 && (
                  <p className="mt-2 text-muted">Starts in {formatClock(Math.min(Math.floor(startsIn / 1000), 99 * 60 + 59))}{startsIn > 3600_000 ? "+" : ""}. The green room opens {READY_WINDOW_BEFORE_START_SECONDS / 60} minutes before.</p>
                )}
                <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  {state.participants.map((p, i) => (
                    <div key={p.userId} style={{ order: i * 2 }} className="flex flex-col items-center gap-2">
                      <Avatar profile={p.profile} size="lg" side={p.side} />
                      <p className="font-semibold">{p.profile.displayName}</p>
                      <p className={clsx("text-xs font-semibold", p.side === "for" ? "text-for" : "text-against")}>{p.side === "for" ? "For" : "Against"}</p>
                    </div>
                  ))}
                  <span className="fo-divider order-1 h-20" aria-hidden />
                </div>
                {isDebater && <Button variant="ghost" size="sm" className="mt-6" onClick={() => setConfirm("cancel")}>Cancel this debate</Button>}
              </div>
            )}

            {status === "ready" && isDebater && !debaterReady && (
              <GreenRoom state={state} onReady={refresh} videoConfigured={state.video.configured} />
            )}

            {status === "ready" && (debaterReady || !isDebater) && (
              <Notice tone="for">
                {isDebater
                  ? <>You&apos;re ready. Waiting for {state.participants.find((p) => p.userId !== me?.userId)?.profile.displayName}. The clock starts when they&apos;re ready.</>
                  : <>The debaters are getting ready. The debate starts when both are in.</>}
                {noShowDeadline && <> If they don&apos;t arrive by <LocalTime iso={new Date(noShowDeadline).toISOString()} mode="time" />, the debate is called off.</>}
              </Notice>
            )}

            {(status === "live" || (status === "ready" && (debaterReady || !isDebater))) && (
              <VideoStage
                sessionId={s.id}
                debaters={state.participants}
                role={role}
                shouldConnect={stageConnect && viewerKey !== "pending"}
                videoConfigured={state.video.configured}
                viewerKey={viewerKey}
                onRealtime={onRealtime}
              />
            )}

            {status === "live" && isDebater && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {s.hostId === me?.userId ? (
                  <Button variant="danger" onClick={() => setConfirm("end")}>End debate early</Button>
                ) : (
                  <p className="text-xs text-muted">Only the host ({s.hostId === s.forSide.userId ? s.forSide.displayName : s.againstSide.displayName}) can end early.</p>
                )}
                <Button variant="ghost" onClick={() => setConfirm("leave")}>Leave</Button>
              </div>
            )}
            {status === "ready" && isDebater && (
              <div className="text-center"><Button variant="ghost" size="sm" onClick={() => setConfirm("cancel")}>Cancel this debate</Button></div>
            )}

            {ended && <Results state={state} />}
            {s.isDemo && ended && <p className="text-xs text-muted">This is demonstration content created to show how FaceOff works. The people and debate are not real.</p>}
          </div>

          <AudiencePanel state={state} comments={comments} me={me} onChanged={() => { refresh(); refreshComments(); }} reactionBurst={burst} />
        </div>
      </div>

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="session" targetId={s.id} label="this debate" />
      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "end" ? "End the debate now?" : confirm === "leave" ? "Leave the debate?" : "Cancel this debate?"}>
        <p className="text-sm text-muted">
          {confirm === "end" && "The debate ends for everyone and is marked as ended early by the host. Votes stay open for 24 hours."}
          {confirm === "leave" && "If you don't come back within 90 seconds, the debate is marked as interrupted."}
          {confirm === "cancel" && "Your opponent will be notified. This can't be undone."}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Keep going</Button>
          <Button variant="danger" onClick={() => confirm && act(confirm)}>{confirm === "end" ? "End debate" : confirm === "leave" ? "Leave" : "Cancel debate"}</Button>
        </div>
      </Modal>
    </div>
  );
}

export function endReasonLabel(r: string | null): string {
  return r ? END_REASON_LABELS[r as EndReason] ?? r : "";
}
