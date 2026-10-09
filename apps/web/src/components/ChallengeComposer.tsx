"use client";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { PROPOSITION_MAX_LENGTH, type ProfileSummary, type Side } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Avatar } from "./Avatar";
import { Button, Checkbox, ErrorNote, Field, Input, Textarea } from "./ui";

export interface ComposerMotion { id: string; title: string; authorSide: Side | null; authorId: string; communityId?: string | null }

function localDefault() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ChallengeComposer({ recipient, motion, communityId, onSent, availableNow }: {
  recipient: ProfileSummary;
  motion?: ComposerMotion | null;
  communityId?: string | null;
  availableNow?: boolean;
  onSent: (challengeId: string) => void;
}) {
  const motionByRecipient = motion && motion.authorId === recipient.userId;
  const initialSide: Side = motionByRecipient && motion?.authorSide ? (motion.authorSide === "for" ? "against" : "for") : "for";
  const [proposition, setProposition] = useState(motion?.title ?? "");
  const [side, setSide] = useState<Side>(initialSide);
  const [kind, setKind] = useState<"instant" | "scheduled">(availableNow ? "instant" : "scheduled");
  const [when, setWhen] = useState(localDefault);
  const [context, setContext] = useState("");
  const [rules, setRules] = useState("");
  const [recording, setRecording] = useState(true);
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const { busy, error, fields, run } = useSubmit();
  const sideLocked = !!(motionByRecipient && motion?.authorSide);
  const theirSide: Side = side === "for" ? "against" : "for";
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const c = await api<{ id: string }>("/challenges", {
        body: {
          recipientId: recipient.userId,
          proposition,
          context: context || undefined,
          groundRules: rules || undefined,
          challengerSide: side,
          motionId: motion?.id,
          communityId: communityId ?? motion?.communityId ?? undefined,
          kind,
          proposedStart: kind === "scheduled" ? new Date(when).toISOString() : undefined,
          recordingEnabled: recording,
          visibility,
        },
      });
      onSent(c.id);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar profile={recipient} size="md" side={theirSide} />
        <div>
          <p className="font-semibold">{recipient.displayName}</p>
          <p className="text-sm text-muted">@{recipient.username}</p>
        </div>
      </div>
      {error && !Object.keys(fields).length && <ErrorNote>{error}</ErrorNote>}
      <Field id="prop" label="Proposition" error={fields.proposition} hint={`${proposition.length}/${PROPOSITION_MAX_LENGTH} — one clear statement. They'll see it before accepting.`}>
        <Input id="prop" value={proposition} maxLength={PROPOSITION_MAX_LENGTH} onChange={(e) => setProposition(e.target.value)} placeholder="e.g. Remote work beats the office" readOnly={!!motion} className={clsx(motion && "bg-sunken")} />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium">Sides</legend>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
          {(["for", "against"] as const).map((s, i) => (
            <button key={s} type="button" disabled={sideLocked} aria-pressed={side === s} onClick={() => setSide(s)}
              style={{ order: i * 2 }}
              className={clsx("rounded-2xl border p-3 text-left disabled:cursor-default", side === s ? (s === "for" ? "border-for bg-for-soft" : "border-against bg-against-soft") : "border-line-strong bg-surface")}>
              <span className={clsx("block text-xs font-semibold", s === "for" ? "text-for" : "text-against")}>{s === "for" ? "For" : "Against"}</span>
              <span className="mt-0.5 block text-sm font-semibold">{side === s ? "You" : recipient.displayName}</span>
            </button>
          ))}
          <span className="fo-divider order-1 my-3" aria-hidden />
        </div>
        {sideLocked && <p className="mt-1.5 text-xs text-muted">{recipient.displayName} posted this motion arguing {motion!.authorSide}, so you argue {side}.</p>}
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">When</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([["instant", "Right now", "They have 15 minutes to accept"], ["scheduled", "Schedule", "Pick a date and time"]] as const).map(([k, l, d]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={clsx("rounded-2xl border p-3 text-left", kind === k ? "border-ink bg-sunken" : "border-line-strong bg-surface")}>
              <span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-muted">{d}</span>
            </button>
          ))}
        </div>
        {kind === "scheduled" && (
          <div className="mt-3">
            <Field id="when" label={`Start time (${tz})`} error={fields.proposedStart}>
              <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          </div>
        )}
      </fieldset>
      <Field id="ctx" label="Context (optional)" error={fields.context}>
        <Textarea id="ctx" value={context} maxLength={500} onChange={(e) => setContext(e.target.value)} className="min-h-20" placeholder="Why this, why them?" />
      </Field>
      <Field id="rules" label="Ground rules (optional)" error={fields.groundRules} hint="e.g. no statistics without a source. The 10-minute format and community guidelines always apply.">
        <Input id="rules" value={rules} maxLength={300} onChange={(e) => setRules(e.target.value)} />
      </Field>
      <div className="space-y-3 rounded-2xl bg-sunken p-4">
        <Checkbox checked={recording} onChange={setRecording} label="Record this debate for a replay"
          description="Both debaters are asked again before going live. If either says no, nothing is recorded." />
        <Checkbox checked={visibility === "unlisted"} onChange={(v) => setVisibility(v ? "unlisted" : "public")} label="Unlisted"
          description="Only people with the link can find it. It won't appear in Discover or community feeds." />
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy}>Send challenge</Button>
    </form>
  );
}
