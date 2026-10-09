import Link from "next/link";
import { clsx } from "clsx";
import type { DebateCard as Card, ProfileSummary } from "@faceoff/shared";
import { Avatar } from "./Avatar";
import { Badge, DemoBadge, LiveBadge } from "./ui";
import { LocalTime } from "./LocalTime";

function Debater({ p, side, align }: { p: ProfileSummary; side: "for" | "against"; align: "left" | "right" }) {
  return (
    <div className={clsx("flex min-w-0 items-center gap-2.5", align === "right" && "flex-row-reverse text-right")}>
      <Avatar profile={p} size="sm" side={side} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{p.displayName}</p>
        <p className={clsx("text-xs font-semibold", side === "for" ? "text-for" : "text-against")}>{side === "for" ? "For" : "Against"}</p>
      </div>
    </div>
  );
}

export function StatusLine({ d }: { d: Card }) {
  if (d.status === "live") return <LiveBadge />;
  if (d.status === "scheduled" || d.status === "ready")
    return (
      <Badge tone="for">
        {d.scheduledStart ? <LocalTime iso={d.scheduledStart} mode="relative" /> : "Starting soon"}
      </Badge>
    );
  if (d.status === "completed")
    return <Badge>{d.replayStatus === "ready" ? "Replay" : d.endedAt ? <LocalTime iso={d.endedAt} mode="relative" /> : "Completed"}</Badge>;
  if (d.status === "interrupted") return <Badge tone="warning">Interrupted</Badge>;
  return <Badge>{d.status}</Badge>;
}

/** The split card: proposition over For (blue) | Against (red), separated by the logo's ink divider. */
export function DebateCard({ d, compact }: { d: Card; compact?: boolean }) {
  return (
    <Link
      href={`/d/${d.id}`}
      className="group block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong focus-visible:outline-offset-4 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusLine d={d} />
        {d.community && <span className="text-xs font-medium text-muted">{d.community.name}</span>}
        {d.isDemo && <DemoBadge />}
      </div>
      <h3 className={clsx("fo-proposition text-ink group-hover:underline decoration-1 underline-offset-4", compact ? "text-lg" : "text-xl sm:text-[22px]")}>
        {d.proposition}
      </h3>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Debater p={d.forSide} side="for" align="left" />
        <span className="fo-divider h-8" aria-hidden />
        <Debater p={d.againstSide} side="against" align="right" />
      </div>
      {!compact && (d.stats.votes > 0 || d.stats.comments > 0) && (
        <p className="mt-3 text-xs text-muted">
          {d.stats.votes} votes, {d.stats.comments} comments
        </p>
      )}
    </Link>
  );
}
