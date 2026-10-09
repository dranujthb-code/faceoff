"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Badge, Button, EmptyState, ErrorNote, Field, Spinner, Textarea } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { useAdminData } from "../useAdminData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function Decide({ id, onDone }: { id: string; onDone: () => void }) {
  const [note, setNote] = useState("");
  const { busy, error, run } = useSubmit();
  return (
    <div className="mt-4 space-y-3">
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field id={`n-${id}`} label="Decision note (sent to the user)"><Textarea id={`n-${id}`} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" /></Field>
      <div className="flex gap-2">
        <Button size="sm" loading={busy} disabled={note.trim().length < 3} onClick={() => run(async () => { await api(`/admin/appeals/${id}`, { body: { decision: "overturned", note } }); onDone(); })}>Overturn</Button>
        <Button size="sm" variant="secondary" loading={busy} disabled={note.trim().length < 3} onClick={() => run(async () => { await api(`/admin/appeals/${id}`, { body: { decision: "upheld", note } }); onDone(); })}>Uphold</Button>
      </div>
    </div>
  );
}

export default function AppealsPage() {
  const { data, error, reload } = useAdminData<Row[]>("/admin/appeals");
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Appeals</h1>
      <p className="text-sm text-muted">Moderators can&apos;t decide appeals of their own decisions.</p>
      <div className="mt-6 space-y-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data && !error && <Spinner />}
        {data?.length === 0 && <EmptyState title="No appeals" />}
        {data?.map((a: Row) => (
          <div key={a.id} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={a.status === "open" ? "for" : a.status === "overturned" ? "success" : "neutral"}>{a.status}</Badge>
              <span className="font-semibold">@{a.username}</span><span className="text-muted">appeals “{a.action}”</span>
              <span className="ml-auto text-xs text-muted"><LocalTime iso={a.created_at} mode="relative" /></span>
            </div>
            <p className="mt-2 text-sm text-muted">Original reason: {a.reason}</p>
            <blockquote className="mt-3 rounded-xl bg-sunken px-4 py-3 text-sm">{a.body}</blockquote>
            {a.decision_note && <p className="mt-2 text-sm">Decision: {a.decision_note}</p>}
            {a.status === "open" && <Decide id={a.id} onDone={reload} />}
          </div>
        ))}
      </div>
    </div>
  );
}
