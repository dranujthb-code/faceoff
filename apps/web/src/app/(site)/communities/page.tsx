import Link from "next/link";
import { getViewer } from "@/lib/server/auth";
import { listCommunities, listTopics } from "@/lib/server/domain/communities";
import { JoinButton } from "@/components/JoinButton";
import { DemoBadge } from "@/components/ui";

export const metadata = { title: "Communities" };
export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const v = await getViewer();
  const [topics, communities] = await Promise.all([listTopics(), listCommunities(v?.userId ?? null, { limit: 200 })]);
  const byTopic = topics.map((t) => ({ t, cs: communities.filter((c) => c.topic?.id === t.id) })).filter((g) => g.cs.length);
  const other = communities.filter((c) => !c.topic);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Communities</h1>
      <p className="mt-2 max-w-2xl text-muted">Each community has its own motions, scheduled debates and replays. Members propose motions; a motion is listed once 20% of members support it.</p>
      <div className="mt-10 space-y-12">
        {[...byTopic, ...(other.length ? [{ t: { id: "other", name: "More", slug: "more" }, cs: other }] : [])].map(({ t, cs }) => (
          <section key={t.id} aria-labelledby={`t-${t.id}`}>
            <h2 id={`t-${t.id}`} className="mb-4 font-serif text-2xl font-semibold">{t.name}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cs.map((c) => (
                <li key={c.id} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/c/${c.slug}`} className="text-lg font-semibold hover:underline">{c.name}</Link>
                    {c.isDemo && <DemoBadge />}
                  </div>
                  <p className="mt-1.5 flex-1 text-sm text-muted">{c.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted">{c.memberCount} member{c.memberCount === 1 ? "" : "s"}</span>
                    <JoinButton communityId={c.id} initial={!!c.isMember} signedIn={!!v?.onboarded} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
