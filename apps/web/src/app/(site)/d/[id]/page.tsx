import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/server/auth";
import { isUuid } from "@/lib/server/db";
import { getSessionState } from "@/lib/server/domain/debates";
import { listComments, isSaved } from "@/lib/server/domain/audience";
import { DebateRoom } from "@/components/room/DebateRoom";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Debate not found" };
  const s = await getSessionState(id, null);
  if (!s) return { title: "Debate not found" };
  const d = s.session;
  const title = d.proposition;
  const desc = `${d.forSide.displayName} (for) vs ${d.againstSide.displayName} (against) — a ${d.status === "live" ? "live " : ""}FaceOff debate.`;
  return {
    title,
    description: desc,
    openGraph: { title: `${title} — FaceOff`, description: desc, type: d.replayStatus === "ready" ? "video.other" : "website" },
    robots: d.visibility === "public" ? undefined : { index: false },
    alternates: { canonical: `/d/${d.id}` },
  };
}

export default async function DebatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const v = await getViewer();
  const state = await getSessionState(id, v);
  if (!state) notFound();
  const [comments, saved] = await Promise.all([listComments(id, v?.userId ?? null), v ? isSaved(v.userId, id) : Promise.resolve(false)]);
  return (
    <DebateRoom
      initial={state}
      initialComments={comments}
      initialSaved={saved}
      me={v && v.username ? { userId: v.userId, username: v.username, displayName: v.displayName ?? v.username, onboarded: v.onboarded, verified: v.emailVerified } : null}
    />
  );
}
