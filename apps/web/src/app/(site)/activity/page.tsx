import Link from "next/link";
import { clsx } from "clsx";
import { requireViewer } from "@/lib/server/page-guards";
import { listChallenges } from "@/lib/server/domain/challenges";
import { listNotifications } from "@/lib/server/domain/notifications";
import { ChallengeItem } from "@/components/ChallengeItem";
import { NotificationList } from "@/components/NotificationList";
import { EmptyState, ButtonLink, Notice } from "@/components/ui";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer("/activity");
  const tab = sp.tab === "challenges" ? "challenges" : "notifications";
  const [ch, notes] = await Promise.all([listChallenges(v.userId), listNotifications(v.userId)]);
  const tabs = [
    { key: "notifications", label: "Notifications", count: notes.unread },
    { key: "challenges", label: "Challenges", count: ch.incoming.length },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Activity</h1>
      <nav className="mt-6 flex gap-2 border-b border-line" aria-label="Activity sections">
        {tabs.map((t) => (
          <Link key={t.key} href={`/activity?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}
            className={clsx("-mb-px border-b-2 px-3 pb-3 text-sm font-semibold", tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
            {t.label}{t.count > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-on-primary">{t.count}</span>}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        {tab === "notifications" ? (
          <NotificationList initial={notes.items} unread={notes.unread} />
        ) : (
          <div className="space-y-10">
            {sp.sent && <Notice tone="for">Challenge sent. You&apos;ll get a notification when they respond.</Notice>}
            <Group title="Waiting for you" empty="No challenges waiting for your response.">{ch.incoming.map((c) => <ChallengeItem key={c.id} c={c} viewerId={v.userId} focus={sp.focus === c.id} />)}</Group>
            <Group title="Scheduled and ready" empty="No upcoming FaceOffs.">{ch.upcoming.map((c) => <ChallengeItem key={c.id} c={c} viewerId={v.userId} />)}</Group>
            <Group title="Sent" empty="You haven't sent any challenges recently.">{ch.outgoing.map((c) => <ChallengeItem key={c.id} c={c} viewerId={v.userId} />)}</Group>
            {ch.past.length > 0 && <Group title="Recent history" empty="">{ch.past.map((c) => <ChallengeItem key={c.id} c={c} viewerId={v.userId} />)}</Group>}
            {ch.incoming.length + ch.upcoming.length + ch.outgoing.length === 0 && (
              <EmptyState title="No challenges yet" body="Find someone who disagrees with you and send the first one." action={<ButtonLink href="/challenge">Start a FaceOff</ButtonLink>} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h2 className="mb-3 font-serif text-xl font-semibold">{title}</h2>
      {children.length ? <ul className="space-y-3">{children}</ul> : empty ? <p className="text-sm text-muted">{empty}</p> : null}
    </section>
  );
}
