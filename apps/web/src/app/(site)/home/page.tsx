import Link from "next/link";
import { requireViewer } from "@/lib/server/page-guards";
import { homeFeed } from "@/lib/server/domain/discover";
import { listChallenges } from "@/lib/server/domain/challenges";
import { DebateCard } from "@/components/DebateCard";
import { MotionCard } from "@/components/MotionCard";
import { ButtonLink, EmptyState, Notice, SectionHeading } from "@/components/ui";
import { AvailabilityToggle } from "@/components/AvailabilityToggle";
import { ResendVerification } from "@/components/ResendVerification";
import { JoinButton } from "@/components/JoinButton";
import { getAvailability } from "@/lib/server/domain/profile-extras";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer("/home");
  const [feed, ch, availableUntil] = await Promise.all([homeFeed(v.userId), listChallenges(v.userId), getAvailability(v.userId)]);
  const needsAction = ch.incoming.length;

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-10">
        {sp.welcome && (
          <Notice tone="for">
            <strong>Your Wall is live.</strong> Next: find someone who disagrees with you. Use <Link href="/challenge" className="underline">Start a FaceOff</Link> to swipe through opponents, or post a motion you&apos;ll defend.
          </Notice>
        )}
        {!v.emailVerified && <ResendVerification email={v.email} />}
        {needsAction > 0 && (
          <Link href="/activity?tab=challenges" className="flex items-center justify-between rounded-2xl border border-against/30 bg-against-soft px-5 py-4">
            <span className="font-semibold">{needsAction === 1 ? "You have a challenge waiting" : `You have ${needsAction} challenges waiting`}</span>
            <span className="text-sm font-semibold text-against">Respond</span>
          </Link>
        )}
        {ch.upcoming.length > 0 && (
          <section>
            <SectionHeading title="Your upcoming FaceOffs" />
            <ul className="space-y-2">
              {ch.upcoming.map((c) => (
                <li key={c.id}>
                  <Link href={`/d/${c.sessionId}`} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 hover:border-line-strong">
                    <span className="fo-proposition text-lg">{c.proposition}</span>
                    <span className="shrink-0 text-sm font-semibold text-link">{c.kind === "instant" ? "Enter room" : "Open"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {feed.live.length > 0 && (
          <section>
            <SectionHeading title="Live now" />
            <div className="grid gap-4 sm:grid-cols-2">{feed.live.map((d) => <DebateCard key={d.id} d={d} />)}</div>
          </section>
        )}
        <section>
          <SectionHeading title="For you" sub="Ranked by recency, your topics and communities, people you follow, and real participation." action={<Link href="/how-it-works#ranking" className="text-sm text-link">How ranking works</Link>} />
          {feed.forYou.length ? (
            <div className="grid gap-4">{feed.forYou.map((d) => <DebateCard key={d.id} d={d} />)}</div>
          ) : (
            <EmptyState title="Nothing here yet" body="Join communities or follow people to fill your feed — or start the first debate yourself." action={<ButtonLink href="/challenge">Start a FaceOff</ButtonLink>} />
          )}
        </section>
      </div>

      <aside className="space-y-8">
        <AvailabilityToggle initialUntil={availableUntil} />
        <section>
          <SectionHeading title="Open motions" />
          <div className="space-y-3">
            {feed.motions.map((m) => <MotionCard key={m.id} m={m} compact viewerId={v.userId} />)}
            {feed.motions.length === 0 && <p className="text-sm text-muted">No open motions right now.</p>}
          </div>
          <ButtonLink href="/motions/new" variant="secondary" className="mt-4 w-full">Post a motion you&apos;ll defend</ButtonLink>
        </section>
        {feed.suggestedCommunities.length > 0 && (
          <section>
            <SectionHeading title="Communities to join" />
            <ul className="space-y-3">
              {feed.suggestedCommunities.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <Link href={`/c/${c.slug}`} className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-xs text-muted">{c.memberCount} members</p>
                  </Link>
                  <JoinButton communityId={c.id} initial={false} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
