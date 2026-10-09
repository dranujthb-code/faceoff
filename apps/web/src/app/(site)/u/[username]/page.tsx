import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REGION_LABELS } from "@faceoff/shared";
import { getViewer } from "@/lib/server/auth";
import { getProfileDetail } from "@/lib/server/domain/profiles";
import { listDebates } from "@/lib/server/domain/debates";
import { listMotions } from "@/lib/server/domain/communities";
import { Avatar } from "@/components/Avatar";
import { DebateCard } from "@/components/DebateCard";
import { MotionCard } from "@/components/MotionCard";
import { ProfileActions } from "@/components/ProfileActions";
import { DemoBadge, EmptyState, SectionHeading, Badge, ButtonLink } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const p = await getProfileDetail(username.toLowerCase(), null);
  if (!p) return { title: "Wall not found" };
  const desc = p.visibility === "public" && p.bio ? p.bio : `${p.displayName}'s FaceOff Wall — ${p.debatesCompleted} debates.`;
  return { title: `${p.displayName} (@${p.username})`, description: desc, openGraph: { title: `${p.displayName} on FaceOff`, description: desc, type: "profile" }, alternates: { canonical: `/u/${p.username}` } };
}

export default async function WallPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const v = await getViewer();
  const uid = v?.userId ?? null;
  const p = await getProfileDetail(username.toLowerCase(), uid);
  if (!p) notFound();
  const canView = p.viewer?.canView ?? p.visibility === "public";
  const [debates, motions] = canView
    ? await Promise.all([
        listDebates({ filter: "all", userId: p.userId, includeUnlisted: p.viewer?.isSelf, limit: 40 }, uid),
        listMotions(uid, { authorId: p.userId, limit: 20 }),
      ])
    : [[], []];
  const live = debates.filter((d) => d.status === "live");
  const upcoming = debates.filter((d) => d.status === "scheduled" || d.status === "ready");
  const past = debates.filter((d) => ["completed", "interrupted"].includes(d.status));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar profile={p} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-3xl font-semibold tracking-tight">{p.displayName}</h1>
              {p.isDemo && <DemoBadge />}
              {p.availableNow && <Badge tone="success">Available now</Badge>}
            </div>
            <p className="text-muted">@{p.username}{p.region ? ` — ${REGION_LABELS[p.region]}` : ""}</p>
            {p.bio && <p className="mt-3 max-w-2xl">{p.bio}</p>}
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div><dt className="sr-only">Debates</dt><dd><strong>{p.debatesCompleted}</strong> <span className="text-muted">debates</span></dd></div>
              <div><dt className="sr-only">Followers</dt><dd><Link href={`/u/${p.username}/followers`} className="hover:underline"><strong>{p.followers}</strong> <span className="text-muted">followers</span></Link></dd></div>
              <div><dt className="sr-only">Following</dt><dd><Link href={`/u/${p.username}/following`} className="hover:underline"><strong>{p.following}</strong> <span className="text-muted">following</span></Link></dd></div>
              <div><dt className="sr-only">Joined</dt><dd className="text-muted">Joined <LocalTime iso={p.createdAt} mode="date" /></dd></div>
            </dl>
            {p.topics.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Topics">
                {p.topics.map((t) => <li key={t.id}><Link href={`/discover?topic=${t.slug}`} className="inline-block rounded-full bg-sunken px-3 py-1 text-xs font-medium hover:text-ink">{t.name}</Link></li>)}
              </ul>
            )}
          </div>
          <ProfileActions profile={{ userId: p.userId, username: p.username, displayName: p.displayName }} viewer={p.viewer} signedIn={!!v} />
        </div>
      </header>

      {!canView ? (
        <div className="mt-10"><EmptyState title="This Wall is visible to followers" body={`Follow ${p.displayName} to see their debates and motions.`} /></div>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-10">
            {live.length > 0 && <section><SectionHeading title="Live now" /><div className="grid gap-4">{live.map((d) => <DebateCard key={d.id} d={d} />)}</div></section>}
            {upcoming.length > 0 && <section><SectionHeading title="Upcoming" /><div className="grid gap-4">{upcoming.map((d) => <DebateCard key={d.id} d={d} />)}</div></section>}
            <section>
              <SectionHeading title="Debates" />
              {past.length ? <div className="grid gap-4">{past.map((d) => <DebateCard key={d.id} d={d} />)}</div> : (
                <EmptyState title={p.viewer?.isSelf ? "Your first debate will show up here" : "No debates yet"} body={p.viewer?.isSelf ? "Challenge someone, or post a motion and wait for a challenger." : undefined}
                  action={p.viewer?.isSelf ? <ButtonLink href="/challenge">Start a FaceOff</ButtonLink> : undefined} />
              )}
            </section>
          </div>
          <aside>
            <SectionHeading title="Motions" sub={p.viewer?.isSelf ? "Propositions you'll defend" : "Propositions they'll defend"} />
            <div className="space-y-3">
              {motions.map((m) => <MotionCard key={m.id} m={m} compact viewerId={uid} />)}
              {motions.length === 0 && <p className="text-sm text-muted">No open motions.</p>}
            </div>
            {p.viewer?.isSelf && <ButtonLink href="/motions/new" variant="secondary" className="mt-4 w-full">Post a motion</ButtonLink>}
            {p.communities.length > 0 && (
              <div className="mt-10">
                <SectionHeading title="Communities" />
                <ul className="flex flex-wrap gap-2">{p.communities.map((c) => <li key={c.id}><Link href={`/c/${c.slug}`} className="inline-block rounded-full border border-line-strong px-3 py-1 text-sm hover:bg-sunken">{c.name}</Link></li>)}</ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
