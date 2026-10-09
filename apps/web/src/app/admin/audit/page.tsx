"use client";
import { ErrorNote, Spinner } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { useAdminData } from "../useAdminData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function AuditLog() {
  const { data, error } = useAdminData<Row[]>("/admin/audit");
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Audit log</h1>
      <p className="text-sm text-muted">Append-only record of privileged actions. Entries can&apos;t be edited or deleted, even by administrators.</p>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      {!data && !error && <div className="mt-6"><Spinner /></div>}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="p-3 font-medium">When</th><th className="p-3 font-medium">Actor</th><th className="p-3 font-medium">Action</th><th className="p-3 font-medium">Target</th><th className="p-3 font-medium">Details</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.map((l: Row) => (
              <tr key={l.id} className="align-top">
                <td className="p-3 text-xs"><LocalTime iso={l.created_at} /></td>
                <td className="p-3">@{l.actor_username ?? "system"}</td>
                <td className="p-3 font-medium">{l.action}</td>
                <td className="p-3 text-xs">{l.target_type} {String(l.target_id ?? "").slice(0, 8)}</td>
                <td className="max-w-sm p-3 text-xs text-muted">{JSON.stringify(l.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
