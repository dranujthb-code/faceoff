"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Badge, Button, Checkbox, ErrorNote, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { useAdminData } from "../useAdminData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function AdminCommunities() {
  const { data, error, reload } = useAdminData<{ topics: Row[]; communities: Row[] }>("/admin/topics");
  const [editC, setEditC] = useState<Row | null>(null);
  const [editT, setEditT] = useState<Row | null>(null);
  const cForm = useSubmit();
  const tForm = useSubmit();
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Spinner />;
  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between"><h1 className="font-serif text-3xl font-semibold">Communities</h1><Button size="sm" onClick={() => setEditC({ slug: "", name: "", description: "", topic_id: null, tags: [], is_featured: false, status: "active" })}>New community</Button></div>
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
          {data.communities.map((c: Row) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="font-semibold">{c.name}</span><span className="text-muted">/{c.slug} — {c.topic_name ?? "no topic"} — {c.member_count} members</span>
              {c.is_featured && <Badge tone="for">featured</Badge>}{c.status !== "active" && <Badge>archived</Badge>}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditC(c)}>Edit</Button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="flex items-end justify-between"><h2 className="font-serif text-2xl font-semibold">Topics (categories)</h2><Button size="sm" variant="secondary" onClick={() => setEditT({ slug: "", name: "", description: "", is_featured: false, is_active: true, sort_order: 100 })}>New topic</Button></div>
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
          {data.topics.map((t: Row) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-10 tabular-nums text-muted">{t.sort_order}</span><span className="font-semibold">{t.name}</span><span className="text-muted">/{t.slug}</span>
              {t.is_featured && <Badge tone="for">featured</Badge>}{!t.is_active && <Badge>inactive</Badge>}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditT(t)}>Edit</Button>
            </li>
          ))}
        </ul>
      </section>

      <Modal open={!!editC} onClose={() => setEditC(null)} title={editC?.id ? "Edit community" : "New community"}>
        {editC && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); cForm.run(async () => {
            await api("/admin/communities", { body: { id: editC.id, slug: editC.slug, name: editC.name, description: editC.description || undefined, topicId: editC.topic_id, tags: (Array.isArray(editC.tags) ? editC.tags : String(editC.tags).split(",")).map((x: string) => x.trim()).filter(Boolean), isFeatured: editC.is_featured, status: editC.status } });
            setEditC(null); reload();
          }); }}>
            {cForm.error && <ErrorNote>{cForm.error}</ErrorNote>}
            <Field id="c-n" label="Name" error={cForm.fields.name}><Input id="c-n" value={editC.name} onChange={(e) => setEditC({ ...editC, name: e.target.value })} /></Field>
            <Field id="c-s" label="Slug" error={cForm.fields.slug}><Input id="c-s" value={editC.slug} onChange={(e) => setEditC({ ...editC, slug: e.target.value })} /></Field>
            <Field id="c-d" label="Description"><Textarea id="c-d" value={editC.description ?? ""} onChange={(e) => setEditC({ ...editC, description: e.target.value })} className="min-h-16" /></Field>
            <Field id="c-t" label="Topic"><Select id="c-t" value={editC.topic_id ?? ""} onChange={(e) => setEditC({ ...editC, topic_id: e.target.value || null })}><option value="">None</option>{data.topics.map((t: Row) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <Field id="c-g" label="Tags (comma-separated)"><Input id="c-g" value={Array.isArray(editC.tags) ? editC.tags.join(", ") : editC.tags} onChange={(e) => setEditC({ ...editC, tags: e.target.value })} /></Field>
            <Checkbox checked={editC.is_featured} onChange={(v) => setEditC({ ...editC, is_featured: v })} label="Featured" />
            <Checkbox checked={editC.status === "archived"} onChange={(v) => setEditC({ ...editC, status: v ? "archived" : "active" })} label="Archived (hidden from users)" />
            <Button type="submit" loading={cForm.busy}>Save</Button>
          </form>
        )}
      </Modal>
      <Modal open={!!editT} onClose={() => setEditT(null)} title={editT?.id ? "Edit topic" : "New topic"}>
        {editT && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); tForm.run(async () => {
            await api("/admin/topics", { body: { id: editT.id, slug: editT.slug, name: editT.name, description: editT.description || undefined, isFeatured: editT.is_featured, isActive: editT.is_active, sortOrder: Number(editT.sort_order) } });
            setEditT(null); reload();
          }); }}>
            {tForm.error && <ErrorNote>{tForm.error}</ErrorNote>}
            <Field id="t-n" label="Name" error={tForm.fields.name}><Input id="t-n" value={editT.name} onChange={(e) => setEditT({ ...editT, name: e.target.value })} /></Field>
            <Field id="t-s" label="Slug" error={tForm.fields.slug}><Input id="t-s" value={editT.slug} onChange={(e) => setEditT({ ...editT, slug: e.target.value })} /></Field>
            <Field id="t-d" label="Description"><Input id="t-d" value={editT.description ?? ""} onChange={(e) => setEditT({ ...editT, description: e.target.value })} /></Field>
            <Field id="t-o" label="Sort order"><Input id="t-o" type="number" value={editT.sort_order} onChange={(e) => setEditT({ ...editT, sort_order: e.target.value })} /></Field>
            <Checkbox checked={editT.is_featured} onChange={(v) => setEditT({ ...editT, is_featured: v })} label="Featured topic" />
            <Checkbox checked={editT.is_active} onChange={(v) => setEditT({ ...editT, is_active: v })} label="Active" />
            <Button type="submit" loading={tForm.busy}>Save</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
