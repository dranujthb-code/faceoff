import Link from "next/link";
import { clsx } from "clsx";
import type { MotionView } from "@faceoff/shared";
import { Avatar } from "./Avatar";
import { DemoBadge, Badge } from "./ui";
import { MotionActions } from "./MotionActions";

export function MotionCard({ m, compact, viewerId }: { m: MotionView; compact?: boolean; viewerId?: string | null }) {
  const side = m.authorSide;
  return (
    <div className={clsx("rounded-2xl border border-line bg-surface", compact ? "p-4" : "p-5")}>
      <div className="flex items-center gap-2.5">
        <Avatar profile={m.author} size="xs" side={side} />
        <p className="min-w-0 truncate text-sm">
          <Link href={`/u/${m.author.username}`} className="font-semibold hover:underline">{m.author.displayName}</Link>
          {side && <span className={clsx("ml-1.5 font-semibold", side === "for" ? "text-for" : "text-against")}>argues {side}</span>}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {m.status === "proposed" && <Badge>Proposed</Badge>}
          {m.isDemo && <DemoBadge />}
        </div>
      </div>
      <p className={clsx("fo-proposition mt-2.5", compact ? "text-lg" : "text-xl")}>{m.title}</p>
      {!compact && m.context && <p className="mt-2 text-sm text-muted">{m.context}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
        {m.community && <Link href={`/c/${m.community.slug}`} className="font-medium hover:text-ink">{m.community.name}</Link>}
        <span>{m.supportVotes} support{m.supportVotes === 1 ? "" : "s"}</span>
        <MotionActions m={m} viewerId={viewerId ?? null} />
      </div>
    </div>
  );
}
