"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Badge, Button, EmptyState, ErrorNote, Field, Modal, Textarea } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";

const LABELS: Record<string, string> = {
  warn: "Warning", hide_comment: "Comment hidden", hide_session: "Debate hidden", hide_motion: "Motion hidden",
  terminate_session: "Debate stopped", suspend_user: "Account suspended", ban_user: "Account banned", unsuspend_user: "Suspension lifted",
  restore_comment: "Comment restored", restore_session: "Debate restored", restore_motion: "Motion restored",
};
interface A { id: string; action: string; reason: string; createdAt: string; expiresAt: string | null; appealStatus: string | null; decisionNote: string | null }

export function Standing({ status, suspendedUntil, actions }: { status: string; suspendedUntil: string | null; actions: A[] }) {
  const [appealing, setAppealing] = useState<A | null>(null);
  const [body, setBody] = useState("");
  const { busy, error, run } = useSubmit();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Account standing</h1>
      <p className="mt-2 text-muted">
        {status === "active" ? "Your account is in good standing." : status === "suspended" ? <>Your account is suspended{suspendedUntil ? <> until <LocalTime iso={suspendedUntil} /></> : ""}. You can still read, report and block, but you can&apos;t debate, comment or vote.</> : "Your account is restricted."}
      </p>
      <div className="mt-8">
        {actions.length === 0 ? <EmptyState title="No enforcement actions" body="Nothing on your account. Thanks for debating in good faith." /> : (
          <ul className="space-y-3">
            {actions.map((a) => (
              <li key={a.id} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{LABELS[a.action] ?? a.action}</p>
                  <span className="text-xs text-muted"><LocalTime iso={a.createdAt} mode="date" /></span>
                </div>
                <p className="mt-1 text-sm text-muted">Reason: {a.reason}</p>
                {a.appealStatus ? (
                  <p className="mt-3 text-sm"><Badge tone={a.appealStatus === "overturned" ? "success" : a.appealStatus === "open" ? "for" : "neutral"}>Appeal {a.appealStatus === "open" ? "under review" : a.appealStatus}</Badge>{a.decisionNote && <span className="ml-2 text-muted">{a.decisionNote}</span>}</p>
                ) : !a.action.startsWith("restore") && a.action !== "unsuspend_user" ? (
                  <Button size="sm" variant="secondary" className="mt-3" onClick={() => { setAppealing(a); setBody(""); }}>Appeal this decision</Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal open={!!appealing} onClose={() => setAppealing(null)} title="Appeal this decision">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/appeals", { body: { actionId: appealing!.id, body } }); setAppealing(null); router.refresh(); }); }}>
          {error && <ErrorNote>{error}</ErrorNote>}
          <p className="text-sm text-muted">A different member of the Trust &amp; Safety team reviews every appeal.</p>
          <Field id="ap" label="Why should this be reconsidered?" hint={`${body.length}/1000`}><Textarea id="ap" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} /></Field>
          <Button type="submit" loading={busy} disabled={body.trim().length < 10}>Submit appeal</Button>
        </form>
      </Modal>
    </div>
  );
}
