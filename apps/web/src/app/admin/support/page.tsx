"use client";
import { EmptyState, ErrorNote, Spinner, Badge } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { useAdminData } from "../useAdminData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function SupportInbox() {
  const { data, error } = useAdminData<Row[]>("/admin/support");
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Support inbox</h1>
      <p className="text-sm text-muted">Messages from the contact form. Reply from your support mailbox.</p>
      <div className="mt-6 space-y-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data && !error && <Spinner />}
        {data?.length === 0 && <EmptyState title="No messages" />}
        {data?.map((m: Row) => (
          <div key={m.id} className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <div className="flex flex-wrap items-center gap-2"><Badge>{m.topic}</Badge><span className="font-semibold">{m.name}</span><a className="text-link underline" href={`mailto:${m.email}`}>{m.email}</a><span className="ml-auto text-xs text-muted"><LocalTime iso={m.created_at} /></span></div>
            <p className="mt-3 whitespace-pre-wrap">{m.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
