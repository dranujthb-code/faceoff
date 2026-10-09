"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import { Badge, ErrorNote, Input, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { LocalTime } from "@/components/LocalTime";
import { ModActionButton } from "../ModAction";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const load = useCallback(async (term: string) => {
    try {
      setRows(await api<Row[]>(`/admin/users?q=${encodeURIComponent(term)}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Failed");
    }
  }, []);
  useEffect(() => {
    let live = true;
    api<Row[]>("/admin/users?q=").then((r) => { if (live) setRows(r); }, () => { if (live) setError("Failed to load users"); });
    return () => { live = false; };
  }, []);
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Users</h1>
      <form className="mt-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <label htmlFor="uq" className="sr-only">Search users</label>
        <Input id="uq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, username or name" />
      </form>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      {!rows && !error && <div className="mt-6"><Spinner /></div>}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="p-3 font-medium">User</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Signals</th><th className="p-3 font-medium">Joined / active</th><th className="p-3 font-medium">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows?.map((u: Row) => (
              <tr key={u.id} className="align-top">
                <td className="p-3">{u.username ? <Link href={`/u/${u.username}`} className="font-medium hover:underline">{u.display_name}</Link> : <span className="text-muted">Not onboarded</span>}<div className="text-xs text-muted">{u.email}{u.is_demo ? " (demo)" : ""}</div></td>
                <td className="p-3"><Badge tone={u.status === "active" ? "success" : "against"}>{u.status}</Badge>{u.suspended_until && <div className="mt-1 text-xs text-muted">until <LocalTime iso={u.suspended_until} mode="date" /></div>}{!u.email_verified_at && <div className="mt-1 text-xs text-warning">email unconfirmed</div>}</td>
                <td className="p-3">
                  <label className="sr-only" htmlFor={`role-${u.id}`}>Role</label>
                  <Select id={`role-${u.id}`} value={u.role} className="!w-36 !py-1.5 text-sm" onChange={async (e) => {
                    try { await api(`/admin/users/${u.id}/role`, { body: { role: e.target.value } }); toast("Role updated", "success"); load(q); }
                    catch (err) { toast(err instanceof ClientApiError ? err.message : "Failed", "error"); }
                  }}>
                    <option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option>
                  </Select>
                </td>
                <td className="p-3 text-xs text-muted">{u.reports_against} reports, {u.actions_against} actions</td>
                <td className="p-3 text-xs"><LocalTime iso={u.created_at} mode="date" /><div className="text-muted">{u.last_active_at ? <LocalTime iso={u.last_active_at} mode="relative" /> : "never"}</div></td>
                <td className="space-x-1 space-y-1 p-3">
                  <ModActionButton action="warn" targetType="user" targetId={u.id} onDone={() => load(q)} variant="ghost" />
                  {u.status === "active" ? <ModActionButton action="suspend_user" targetType="user" targetId={u.id} onDone={() => load(q)} variant="danger" /> : <ModActionButton action="unsuspend_user" targetType="user" targetId={u.id} onDone={() => load(q)} />}
                  {u.status !== "banned" && <ModActionButton action="ban_user" targetType="user" targetId={u.id} onDone={() => load(q)} variant="danger" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
