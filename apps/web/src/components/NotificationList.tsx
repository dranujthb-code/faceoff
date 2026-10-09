"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { NotificationView } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { Avatar } from "./Avatar";
import { Button, EmptyState } from "./ui";
import { LocalTime } from "./LocalTime";

export function NotificationList({ initial, unread }: { initial: NotificationView[]; unread: number }) {
  const [items, setItems] = useState(initial);
  const [more, setMore] = useState(initial.length >= 30);
  const router = useRouter();
  useEffect(() => {
    // Viewing the list marks everything read (the server keeps read_at timestamps).
    if (unread > 0) api("/notifications/read", { body: { ids: "all" } }).then(() => router.refresh()).catch(() => {});
  }, [unread, router]);
  if (!items.length) return <EmptyState title="You're all caught up" body="Challenges, debate reminders and new followers will show up here." />;
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((n) => {
          const body = (
            <div className={clsx("flex gap-3 px-4 py-4", !n.readAt && "bg-for-soft/60")}>
              {n.actor ? <Avatar profile={n.actor} size="sm" /> : <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                <p className="mt-1 text-xs text-subtle"><LocalTime iso={n.createdAt} mode="relative" /></p>
              </div>
            </div>
          );
          return <li key={n.id}>{n.href ? <Link href={n.href} className="block hover:bg-sunken">{body}</Link> : body}</li>;
        })}
      </ul>
      {more && (
        <div className="mt-4 text-center">
          <Button variant="secondary" size="sm" onClick={async () => {
            const r = await api<{ items: NotificationView[] }>(`/notifications?before=${encodeURIComponent(items[items.length - 1]!.createdAt)}`);
            setItems((xs) => [...xs, ...r.items]);
            setMore(r.items.length >= 30);
          }}>Load older</Button>
        </div>
      )}
    </>
  );
}
