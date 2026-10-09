import { getViewer } from "@/lib/server/auth";
import { listMotions } from "@/lib/server/domain/communities";
import { MotionCard } from "@/components/MotionCard";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "Trending motions" };
export const dynamic = "force-dynamic";

export default async function TrendingPage() {
  const v = await getViewer();
  const motions = await listMotions(v?.userId ?? null, { status: "listed", trending: true, limit: 60 });
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Trending motions</h1>
          <p className="mt-2 text-muted">Propositions people are ready to defend. Ranked by recent challenges, debates and support — never by how angry the comments are.</p>
        </div>
        {v && <ButtonLink href="/motions/new" variant="secondary">Post a motion</ButtonLink>}
      </div>
      <div className="mt-8 space-y-3">
        {motions.map((m) => <MotionCard key={m.id} m={m} viewerId={v?.userId} />)}
        {motions.length === 0 && <EmptyState title="No motions yet" body="Post a proposition you'll defend and let someone challenge you." />}
      </div>
    </div>
  );
}
