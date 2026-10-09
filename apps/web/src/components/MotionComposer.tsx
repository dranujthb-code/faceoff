"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { PROPOSITION_MAX_LENGTH, type Side } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, ErrorNote, Field, Input, Textarea } from "./ui";
import { useToast } from "./Toast";

export function MotionComposer({ communityId, onDone }: { communityId?: string; onDone?: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [side, setSide] = useState<Side | null>("for");
  const { busy, error, fields, run } = useSubmit();
  const router = useRouter();
  const toast = useToast();
  return (
    <form
      className="space-y-4 rounded-2xl border border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const m = await api<{ id: string; status: string }>("/motions", { body: { title, context: context || undefined, communityId, authorSide: side ?? undefined } });
          setTitle("");
          setContext("");
          toast(m.status === "listed" ? "Motion posted — it's open for challengers" : "Motion proposed — it's listed once enough members support it", "success");
          if (onDone) onDone(m.id);
          else router.refresh();
        });
      }}
    >
      <p className="font-semibold">{communityId ? "Propose a motion" : "Post a motion you'll defend"}</p>
      {error && !fields.title && <ErrorNote>{error}</ErrorNote>}
      <Field id="mt" label="Proposition" error={fields.title} hint={`${title.length}/${PROPOSITION_MAX_LENGTH} — a clear statement someone can be for or against.`}>
        <Input id="mt" value={title} maxLength={PROPOSITION_MAX_LENGTH} placeholder="e.g. Voting should be mandatory" onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium">Your side</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([["for", "For"], ["against", "Against"], [null, "Either"]] as const).map(([v, l]) => (
            <button key={l} type="button" aria-pressed={side === v} onClick={() => setSide(v)}
              className={clsx("rounded-xl border py-2 text-sm font-semibold", side === v ? (v === "for" ? "border-for bg-for-soft text-for" : v === "against" ? "border-against bg-against-soft text-against" : "border-ink bg-sunken") : "border-line-strong")}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <Field id="mc" label="Context (optional)" error={fields.context}>
        <Textarea id="mc" value={context} maxLength={500} onChange={(e) => setContext(e.target.value)} className="min-h-20" />
      </Field>
      <Button type="submit" loading={busy} className="w-full">{communityId ? "Propose" : "Post motion"}</Button>
    </form>
  );
}
