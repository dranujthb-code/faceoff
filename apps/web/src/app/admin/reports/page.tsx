"use client";
import Link from "next/link";
import { useState } from "react";
import { clsx } from "clsx";
import { REPORT_REASON_LABELS, type ReportReason } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { Badge, Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { ModActionButton } from "../ModAction";
import { useAdminData } from "../useAdminData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const STATUSES = ["open", "in_review", "actioned", "dismissed", "all"] as const;

export default function ReportsPage() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("open");
  const { data, error, reload } = useAdminData<Row[]>(`/admin/reports?status=${status}`);
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Reports</h1>
      <p className="text-sm text-muted">Urgent reasons (threats, child safety, self-harm, doxxing) are sorted first. Judge conduct against the guidelines, not the viewpoint.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => <button key={s} onClick={() => setStatus(s)} className={clsx("rounded-full px-3 py-1 text-sm", status === s ? "bg-ink text-bg" : "border border-line-strong")}>{s.replace("_", " ")}</button>)}
      </div>
      <div className="mt-6 space-y-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data && !error && <Spinner />}
        {data?.length === 0 && <EmptyState title="Queue is clear" />}
        {data?.map((r: Row) => (
          <div key={r.id} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {r.priority === 1 && <Badge tone="against">Urgent</Badge>}
              <Badge>{r.target_type}</Badge>
              <span className="font-semibold">{REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason}</span>
              <span className="text-muted">by @{r.reporter_username ?? "unknown"}</span>
              <span className="ml-auto text-xs text-muted"><LocalTime iso={r.created_at} mode="relative" /> — {r.status.replace("_", " ")}</span>
            </div>
            {r.target_preview && <blockquote className="mt-3 rounded-xl bg-sunken px-4 py-3 text-sm">{r.target_preview}</blockquote>}
            {r.details && <p className="mt-2 text-sm text-muted">Reporter: “{r.details}”</p>}
            <p className="mt-2 text-xs text-muted">
              {r.target_username && <>Subject: <Link className="underline" href={`/u/${r.target_username}`}>@{r.target_username}</Link> — </>}
              {r.report_count} report(s) on this target, {r.prior_actions} prior action(s) against this user
              {r.target_type === "session" && <> — <Link className="underline" href={`/d/${r.target_id}`}>open debate</Link></>}
            </p>
            {r.resolution && <p className="mt-2 text-sm">Resolution: {r.resolution}</p>}
            {["open", "in_review"].includes(r.status) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === "open" && <Button size="sm" variant="ghost" onClick={async () => { await api(`/admin/reports/${r.id}/assign`, { body: {} }); reload(); }}>Assign to me</Button>}
                {r.target_type === "comment" && <ModActionButton action="hide_comment" targetType="comment" targetId={r.target_id} reportId={r.id} onDone={reload} variant="danger" />}
                {r.target_type === "session" && <ModActionButton action="hide_session" targetType="session" targetId={r.target_id} reportId={r.id} onDone={reload} variant="danger" />}
                {r.target_type === "session" && <ModActionButton action="terminate_session" targetType="session" targetId={r.target_id} reportId={r.id} onDone={reload} variant="danger" />}
                {r.target_type === "motion" && <ModActionButton action="hide_motion" targetType="motion" targetId={r.target_id} reportId={r.id} onDone={reload} variant="danger" />}
                {r.target_user_id && <ModActionButton action="warn" targetType="user" targetId={r.target_user_id} reportId={r.id} onDone={reload} />}
                {r.target_user_id && <ModActionButton action="suspend_user" targetType="user" targetId={r.target_user_id} reportId={r.id} onDone={reload} variant="danger" />}
                <ModActionButton action="dismiss_report" targetType="report" targetId={r.id} reportId={r.id} onDone={reload} variant="ghost" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
