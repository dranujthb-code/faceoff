import Link from "next/link";
import { clsx } from "clsx";
import { getViewer } from "@/lib/server/auth";
import { listDebates, type DebateFilter } from "@/lib/server/domain/debates";
import { searchPeople } from "@/lib/server/domain/profiles";
import { listCommunities, listTopics } from "@/lib/server/domain/communities";
import { DebateCard } from "@/components/DebateCard";
import { Avatar } from "@/components/Avatar";
import { DemoBadge, EmptyState, ButtonLink } from "@/components/ui";

export const metadata = { title: "Discover debates" };
export const dynamic = "force-dynamic";

const TABS: Array<{ key: DebateFilter; label: string }> = [
  { key: "recent", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "replays", label: "Replays" },
];

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await getViewer();
  const uid = v?.userId ?? null;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "recent") as DebateFilter;
  const q = (sp.q ?? "").trim();
  const topics = await listTopics();
  const topic = topics.find((t) => t.slug === sp.topic);
  const communities = topic ? await listCommunities(uid, { topicSlug: topic.slug }) : [];
  const [debates, people, comms] = await Promise.all([
    q ? listDebates({ filter: "all", q, limit: 30 }, uid) : topic ? Promise.all(communities.map((c) => listDebates({ filter: tab, communityId: c.id, limit: 12 }, uid))).then((xs) => xs.flat()) : listDebates({ filter: tab, limit: 30 }, uid),
    q ? searchPeople(q, uid, 12) : Promise.resolve([]),
    q ? listCommunities(uid, { q, limit: 8 }) : Promise.resolve([]),
  ]);
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries({ tab, topic: sp.topic, ...o })) if (val) p.set(k, val);
    return `/discover?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Discover</h1>
      <form action="/discover" className="mt-5" role="search">
        <label htmlFor="q" className="sr-only">Search debates, people and communities</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search debates, people, communities" className="w-full rounded-full border border-line-strong bg-surface px-5 py-3 text-[15px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25" />
      </form>

      {q ? (
        <div className="mt-8 space-y-10">
          {people.length > 0 && (
            <section>
              <h2 className="mb-3 font-serif text-xl font-semibold">People</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {people.map((p) => (
                  <li key={p.userId}>
                    <Link href={`/u/${p.username}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-line-strong">
                      <Avatar profile={p} size="sm" />
                      <span className="min-w-0"><span className="block truncate font-semibold">{p.displayName}</span><span className="text-sm text-muted">@{p.username}</span></span>
                      {p.isDemo && <DemoBadge />}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {comms.length > 0 && (
            <section>
              <h2 className="mb-3 font-serif text-xl font-semibold">Communities</h2>
              <ul className="flex flex-wrap gap-2">{comms.map((c) => <li key={c.id}><Link href={`/c/${c.slug}`} className="inline-block rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium hover:bg-sunken">{c.name}</Link></li>)}</ul>
            </section>
          )}
          <section>
            <h2 className="mb-3 font-serif text-xl font-semibold">Debates</h2>
            {debates.length ? <div className="grid gap-4 md:grid-cols-2">{debates.map((d) => <DebateCard key={d.id} d={d} />)}</div> : <p className="text-muted">No debates match “{q}”.</p>}
          </section>
        </div>
      ) : (
        <>
          <nav aria-label="Debate filters" className="mt-6 flex flex-wrap items-center gap-2">
            {TABS.map((t) => (
              <Link key={t.key} href={qs({ tab: t.key })} aria-current={tab === t.key ? "page" : undefined}
                className={clsx("rounded-full px-4 py-1.5 text-sm font-medium", tab === t.key ? "bg-ink text-bg" : "border border-line-strong hover:bg-sunken")}>
                {t.label}
              </Link>
            ))}
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            <Link href={qs({ topic: undefined })} className={clsx("rounded-full px-3 py-1.5 text-sm", !topic ? "font-semibold text-ink" : "text-muted hover:text-ink")}>Every topic</Link>
            {topics.map((t) => (
              <Link key={t.id} href={qs({ topic: t.slug })} aria-current={topic?.id === t.id ? "true" : undefined} className={clsx("rounded-full px-3 py-1.5 text-sm", topic?.id === t.id ? "font-semibold text-ink underline underline-offset-4" : "text-muted hover:text-ink")}>
                {t.name}
              </Link>
            ))}
          </nav>
          <div className="mt-8">
            {debates.length ? (
              <div className="grid gap-4 md:grid-cols-2">{debates.map((d) => <DebateCard key={d.id} d={d} />)}</div>
            ) : (
              <EmptyState
                title={tab === "live" ? "Nobody is live right now" : tab === "upcoming" ? "Nothing scheduled yet" : "No debates here yet"}
                body="Debates appear here the moment two people agree to a FaceOff."
                action={<ButtonLink href="/challenge">Start a FaceOff</ButtonLink>}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
