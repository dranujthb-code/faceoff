"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, ErrorNote, Field, Input, Notice, Select, Textarea } from "@/components/ui";

export default function ContactPage() {
  const [f, setF] = useState({ name: "", email: "", topic: "support", message: "" });
  const [done, setDone] = useState(false);
  const { busy, error, fields, run } = useSubmit();
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Contact and support</h1>
      <p className="mt-3 text-muted">To report a person, debate or comment, use the report option next to it — that reaches Trust &amp; Safety fastest. For anything else, write to us here.</p>
      {done ? (
        <div className="mt-8"><Notice tone="for">Thanks — we&apos;ve received your message and will reply by email.</Notice></div>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/contact", { body: f }); setDone(true); }); }}>
          {error && !Object.keys(fields).length && <ErrorNote>{error}</ErrorNote>}
          <Field id="cn" label="Your name" error={fields.name}><Input id="cn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field id="ce" label="Email" error={fields.email}><Input id="ce" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field id="ct" label="Topic">
            <Select id="ct" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
              <option value="support">Help with my account</option><option value="safety">Safety concern</option><option value="press">Press</option><option value="partnerships">Partnerships</option><option value="legal">Legal and privacy</option><option value="other">Something else</option>
            </Select>
          </Field>
          <Field id="cm" label="Message" error={fields.message}><Textarea id="cm" value={f.message} maxLength={2000} onChange={(e) => setF({ ...f, message: e.target.value })} className="min-h-36" /></Field>
          <Button type="submit" loading={busy}>Send message</Button>
        </form>
      )}
    </div>
  );
}
