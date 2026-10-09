import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/server/auth";
import { getProfileDetail, listFollows } from "@/lib/server/domain/profiles";
import { Avatar } from "@/components/Avatar";
import { DemoBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const v = await getViewer();
  const p = await getProfileDetail(username.toLowerCase(), v?.userId ?? null);
  if (!p) notFound();
  const people = await listFollows(p.username, "following", v?.userId ?? null);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href={`/u/${p.username}`} className="text-sm text-link">Back to {p.displayName}</Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold">{p.displayName}: Following</h1>
      <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
        {people.map((x) => (
          <li key={x.userId}>
            <Link href={`/u/${x.username}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
              <Avatar profile={x} size="sm" />
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{x.displayName}</span><span className="text-sm text-muted">@{x.username}</span></span>
              {x.isDemo && <DemoBadge />}
            </Link>
          </li>
        ))}
      </ul>
      {people.length === 0 && <div className="mt-6"><EmptyState title="Nobody here yet" /></div>}
    </div>
  );
}
