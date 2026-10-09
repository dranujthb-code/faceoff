"use client";
import { useState } from "react";
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason, type ReportTarget } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, ErrorNote, Field, Modal, Notice, Textarea } from "./ui";

export function ReportDialog({ open, onClose, targetType, targetId, label }: { open: boolean; onClose: () => void; targetType: ReportTarget; targetId: string; label: string }) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const { busy, error, run } = useSubmit();
  const close = () => { setDone(false); setReason(""); setDetails(""); onClose(); };
  return (
    <Modal open={open} onClose={close} title={`Report ${label}`}>
      {done ? (
        <div className="space-y-4">
          <Notice tone="for">Thanks — our Trust &amp; Safety team will review this. Urgent safety reports are reviewed first.</Notice>
          <p className="text-sm text-muted">You can also block this person so they can&apos;t challenge you or comment on your debates.</p>
          <Button onClick={close}>Done</Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!reason) return; run(async () => { await api("/reports", { body: { targetType, targetId, reason, details: details || undefined } }); setDone(true); }); }}>
          {error && <ErrorNote>{error}</ErrorNote>}
          <fieldset>
            <legend className="text-sm font-medium">What&apos;s the problem?</legend>
            <div className="mt-2 space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-sunken">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--fo-accent)]" />
                  {REPORT_REASON_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="rd" label="Anything else we should know? (optional)">
            <Textarea id="rd" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <p className="text-xs text-muted">Disagreeing with someone&apos;s opinion isn&apos;t a violation. If someone is in immediate danger, contact local emergency services.</p>
          <Button type="submit" disabled={!reason} loading={busy}>Submit report</Button>
        </form>
      )}
    </Modal>
  );
}
