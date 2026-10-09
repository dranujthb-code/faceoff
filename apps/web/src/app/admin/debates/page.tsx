"use client";
import Link from "next/link";
import { useState } from "react";
import { clsx } from "clsx";
import { Badge, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { ModActionButton } from "../ModAction";
import { useAdminData } from "../useAdminData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const FILTERS = ["", "live", "ready", "scheduled", "completed", "interrupted", "failed", "cancelled"];

export default function AdminDebates() {
  const [status, setStatus] = useState("");
  const { data, error, reload } = useAdminData<Row[]>(`/admin/debates${status ? `?status=${status}` : ""}`);
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Debates and live sessions</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((s) => <button key={s || "all"} onClick={() => setStatus(s)} className={clsx("rounded-full px-3 py-1 text-sm", status === s ? "bg-ink text-bg" : "border border-line-strong")}>{s || "all"}</button>)}
      </div>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      {!data && !error && <div className="mt-6"><Spinner /></div>}
      {data?.length === 0 && <div className="mt-6"><EmptyState title="No debates" /></div>}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="p-3 font-medium">Proposition</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Debaters</th><th className="p-3 font-medium">When</th><th className="p-3 font-medium">Recording</th><th className="p-3 font-medium">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.map((d: Row) => (
              <tr key={d.id} className="align-top">
                <td className="max-w-xs p-3"><Link href={`/d/${d.id}`} className="font-medium hover:underline">{d.proposition}</Link>{d.is_demo && <span className="ml-1 text-xs text-muted">(demo)</span>}{d.reports > 0 && <span className="ml-1 text-xs text-danger">{d.reports} report(s)</span>}</td>
                <td className="p-3"><Badge tone={d.status === "live" ? "live" : "neutral"}>{d.status}</Badge>{d.moderation_state === "hidden" && <Badge tone="against" className="ml-1">hidden</Badge>}<div className="mt-1 text-xs text-muted">{d.end_reason}</div></td>
                <td className="p-3 text-xs">{d.debaters}</td>
                <td className="p-3 text-xs">{(d.live_started_at || d.scheduled_start || d.created_at) && <LocalTime iso={d.live_started_at ?? d.scheduled_start ?? d.created_at} />}<div className="text-muted">peak {d.viewer_peak} viewers</div></td>
                <td className="p-3 text-xs">{d.recording_enabled ? d.recording_status ?? "requested" : "off"}</td>
                <td className="space-x-1 space-y-1 p-3">
                  {["live", "ready", "scheduled"].includes(d.status) && <ModActionButton action="terminate_session" targetType="session" targetId={d.id} onDone={reload} variant="danger" />}
                  {d.moderation_state === "visible" ? <ModActionButton action="hide_session" targetType="session" targetId={d.id} onDone={reload} variant="ghost" /> : <ModActionButton action="restore_session" targetType="session" targetId={d.id} onDone={reload} variant="ghost" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
