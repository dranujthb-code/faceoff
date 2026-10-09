"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, ErrorNote, Field, Input, Modal, Textarea } from "@/components/ui";

export type ModActionName =
  | "warn" | "hide_comment" | "restore_comment" | "hide_session" | "restore_session" | "hide_motion" | "restore_motion"
  | "terminate_session" | "suspend_user" | "unsuspend_user" | "ban_user" | "dismiss_report";

const LABEL: Record<ModActionName, string> = {
  warn: "Warn user", hide_comment: "Hide comment", restore_comment: "Restore comment", hide_session: "Hide debate", restore_session: "Restore debate",
  hide_motion: "Hide motion", restore_motion: "Restore motion", terminate_session: "Stop debate", suspend_user: "Suspend user",
  unsuspend_user: "Lift suspension", ban_user: "Ban user", dismiss_report: "Dismiss report",
};

export function ModActionButton({ action, targetType, targetId, reportId, onDone, variant = "secondary" }: {
  action: ModActionName; targetType: "user" | "session" | "comment" | "motion" | "report"; targetId: string; reportId?: string; onDone: () => void; variant?: "secondary" | "danger" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const { busy, error, run } = useSubmit();
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>{LABEL[action]}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={LABEL[action]}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => {
          await api("/admin/moderation", { body: { action, targetType, targetId, reportId, reason, durationDays: action === "suspend_user" ? Number(days) : undefined } });
          setOpen(false); setReason(""); onDone();
        }); }}>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Field id={`r-${action}-${targetId}`} label="Reason" hint="Shown to the affected user (for enforcement actions) and kept in the audit log.">
            <Textarea id={`r-${action}-${targetId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          {action === "suspend_user" && (
            <Field id={`d-${targetId}`} label="Duration (days)"><Input id={`d-${targetId}`} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
          )}
          <Button type="submit" variant={action.startsWith("restore") || action === "unsuspend_user" || action === "dismiss_report" ? "primary" : "danger"} loading={busy} disabled={reason.trim().length < 3}>Confirm</Button>
        </form>
      </Modal>
    </>
  );
}
