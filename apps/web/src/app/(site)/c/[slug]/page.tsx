import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/server/auth";
import { getCommunity, listMotions } from "@/lib/server/domain/communities";
import { listDebates } from "@/lib/server/domain/debates";
import { DebateCard } from "@/components/DebateCard";
import { MotionCard } from "@/components/MotionCard";
import { JoinButton } from "@/components/JoinButton";
import { MotionComposer } from "@/components/MotionComposer";
import { SectionHeading } from "@/components/ui";
import { MOTION_LISTING_THRESHOLD_PCT } from "@faceoff/shared";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCommunity(slug, null);
  if (!c) return { title: "Community not found" };
  return { title: c.name, description: c.description ?? undefined, openGraph: { title: `${c.name} on FaceOff`, description: c.description ?? undefined } };
}

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await getViewer();
  const uid = v?.userId ?? null;
  const c = await getCommunity(slug, uid);
  if (!c) notFound();
  const [live, upcoming, replays, listed, proposed] = await Promise.all([
    listDebates({ filter: "live", communityId: c.id }, uid),
    listDebates({ filter: "upcoming", communityId: c.id }, uid),
    listDebates({ filter: "replays", communityId: c.id, limit: 12 }, uid),
    listMotions(uid, { communityId: c.id, status: "listed", trending: true }),
    listMotions(uid, { communityId: c.id, status: "proposed" }),
  ]);
  const threshold = Math.max(3, Math.ceil((c.memberCount * MOTION_LISTING_THRESHOLD_PCT) / 100));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {c.topic && <p className="text-sm font-medium text-muted">{c.topic.name}</p>}
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">{c.name}</h1>
          <p className="mt-2 max-w-2xl text-muted">{c.description}</p>
          <p className="mt-3 text-sm text-muted">{c.memberCount} member{c.memberCount === 1 ? "" : "s"}{c.tags.length ? ` — ${c.tags.join(", ")}` : ""}</p>
        </div>
        <JoinButton communityId={c.id} initial={!!c.isMember} signedIn={!!v?.onboarded} size="md" />
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-12">
          <section>
            <SectionHeading title="Ongoing debates" />
            {live.length ? <div className="grid gap-4">{live.map((d) => <DebateCard key={d.id} d={d} />)}</div> : <p className="text-sm text-muted">No debates are live in {c.name} right now.</p>}
          </section>
          <section>
            <SectionHeading title="Planned debates" />
            {upcoming.length ? <div className="grid gap-4">{upcoming.map((d) => <DebateCard key={d.id} d={d} />)}</div> : <p className="text-sm text-muted">Nothing scheduled. Challenge someone on a listed motion to schedule the next one.</p>}
          </section>
          <section>
            <SectionHeading title="Replays and past debates" />
            {replays.length ? <div className="grid gap-4 sm:grid-cols-2">{replays.map((d) => <DebateCard key={d.id} d={d} compact />)}</div> : <p className="text-sm text-muted">No completed debates yet.</p>}
          </section>
        </div>
        <aside className="space-y-10">
          <section>
            <SectionHeading title="Listed motions" sub="Ready for a challenger" />
            <div className="space-y-3">
              {listed.map((m) => <MotionCard key={m.id} m={m} compact viewerId={uid} />)}
              {listed.length === 0 && <p className="text-sm text-muted">No listed motions yet.</p>}
            </div>
          </section>
          <section>
            <SectionHeading title="Proposed motions" sub={`Listed at ${MOTION_LISTING_THRESHOLD_PCT}% member support (currently ${threshold} supporters)`} />
            <div className="space-y-3">
              {proposed.map((m) => <MotionCard key={m.id} m={m} compact viewerId={uid} />)}
              {proposed.length === 0 && <p className="text-sm text-muted">No proposals waiting for support.</p>}
            </div>
            {c.isMember ? (
              <div className="mt-5"><MotionComposer communityId={c.id} /></div>
            ) : (
              <p className="mt-5 text-sm text-muted">Join {c.name} to propose a motion.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
