"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { ChallengeView } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Avatar } from "./Avatar";
import { Badge, Button, DemoBadge, ErrorNote, Field, Input, Modal } from "./ui";
import { buttonClass } from "./ui/button-class";
import { LocalTime } from "./LocalTime";

const STATUS_TONE: Record<string, "neutral" | "for" | "against" | "success" | "warning"> = {
  pending: "for", accepted: "success", declined: "against", cancelled: "neutral", expired: "neutral", completed: "neutral",
};

export function ChallengeItem({ c, viewerId, focus }: { c: ChallengeView; viewerId: string; focus?: boolean }) {
  const router = useRouter();
  const { busy, error, run } = useSubmit();
  const [proposeOpen, setProposeOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");
  const iAmChallenger = c.challenger.userId === viewerId;
  const other = iAmChallenger ? c.recipient : c.challenger;
  const mySide = iAmChallenger ? c.challengerSide : c.challengerSide === "for" ? "against" : "for";
  const respond = (body: Record<string, unknown>) =>
    run(async () => {
      const r = await api<{ sessionId: string | null }>(`/challenges/${c.id}/respond`, { body });
      setProposeOpen(false);
      setDeclineOpen(false);
      if (body.action === "accept" && r.sessionId) router.push(`/d/${r.sessionId}`);
      else router.refresh();
    });

  return (
    <li id={`c-${c.id}`} className={clsx("rounded-2xl border bg-surface p-5", focus ? "border-ink" : "border-line")}>
      <div className="flex items-center gap-3">
        <Avatar profile={other} size="sm" side={mySide === "for" ? "against" : "for"} />
        <p className="min-w-0 flex-1 text-sm">
          <Link href={`/u/${other.username}`} className="font-semibold hover:underline">{other.displayName}</Link>{" "}
          <span className="text-muted">{iAmChallenger ? "— you challenged them" : "challenged you"}</span>
        </p>
        {other.isDemo && <DemoBadge />}
        <Badge tone={STATUS_TONE[c.status]}>{c.status === "pending" && c.lastProposedBy !== viewerId ? "Needs response" : c.status}</Badge>
      </div>
      <p className="fo-proposition mt-3 text-xl">{c.proposition}</p>
      <p className="mt-1.5 text-sm">
        You argue <span className={clsx("font-semibold", mySide === "for" ? "text-for" : "text-against")}>{mySide}</span>
        {c.community && <span className="text-muted"> in {c.community.name}</span>}
      </p>
      {c.context && <p className="mt-2 text-sm text-muted">{c.context}</p>}
      {c.groundRules && <p className="mt-1 text-sm text-muted">Ground rules: {c.groundRules}</p>}
      <p className="mt-2 text-sm text-muted">
        {c.kind === "instant" ? <>Instant FaceOff — {c.status === "pending" ? <>expires <LocalTime iso={c.expiresAt} mode="relative" /></> : "started on acceptance"}</> : c.proposedStart ? <>Scheduled for <LocalTime iso={c.proposedStart} /></> : null}
        {c.recordingEnabled ? " — recording requested" : " — not recorded"}
        {c.visibility === "unlisted" ? " — unlisted" : ""}
      </p>
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      {c.actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {c.actions.includes("accept") && <Button size="sm" loading={busy} onClick={() => respond({ action: "accept" })}>Accept</Button>}
          {c.actions.includes("open_room") && c.sessionId && <Link href={`/d/${c.sessionId}`} className={buttonClass("primary", "sm")}>Open debate room</Link>}
          {c.actions.includes("propose_time") && <Button size="sm" variant="secondary" onClick={() => setProposeOpen(true)}>Propose another time</Button>}
          {c.actions.includes("decline") && <Button size="sm" variant="ghost" onClick={() => setDeclineOpen(true)}>Decline</Button>}
          {c.actions.includes("cancel") && <Button size="sm" variant="ghost" loading={busy} onClick={() => respond({ action: "cancel" })}>Withdraw</Button>}
        </div>
      )}
      <Modal open={proposeOpen} onClose={() => setProposeOpen(false)} title="Propose another time">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (when) respond({ action: "propose_time", proposedStart: new Date(when).toISOString() }); }}>
          <Field id={`pt-${c.id}`} label={`New start time (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}>
            <Input id={`pt-${c.id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" loading={busy} disabled={!when}>Send new time</Button>
        </form>
      </Modal>
      <Modal open={declineOpen} onClose={() => setDeclineOpen(false)} title="Decline this challenge?">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); respond({ action: "decline", reason: reason || undefined }); }}>
          <Field id={`dr-${c.id}`} label="Reason (optional, shared with them)">
            <Input id={`dr-${c.id}`} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button type="submit" variant="danger" loading={busy}>Decline challenge</Button>
        </form>
      </Modal>
    </li>
  );
}
