"use client";
import { useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check } from "lucide-react";
import { REGIONS, REGION_LABELS, usernameSchema, type CommunitySummary, type Region, type TopicSummary } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, ErrorNote, Field, Input, Notice, Select, Textarea } from "@/components/ui";

const STEPS = ["You", "Topics", "Communities", "Your Wall"] as const;

export function Onboarding({ topics, communities, next, emailVerified, email }: { topics: TopicSummary[]; communities: CommunitySummary[]; next: string; emailVerified: boolean; email: string }) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [region, setRegion] = useState<Region>("global");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [communityIds, setCommunityIds] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, error, fields, run } = useSubmit();

  const suggested = useMemo(() => {
    const chosen = new Set(topicIds);
    return [...communities].sort((a, b) => Number(chosen.has(b.topic?.id ?? "")) - Number(chosen.has(a.topic?.id ?? "")));
  }, [communities, topicIds]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const nextStep = () => {
    setLocalErr(null);
    if (step === 0) {
      if (!displayName.trim()) return setLocalErr("Enter a display name");
      const u = usernameSchema.safeParse(username);
      if (!u.success) return setLocalErr(u.error.issues[0]?.message ?? "Choose a valid username");
    }
    if (step === 1 && topicIds.length === 0) return setLocalErr("Pick at least one topic");
    setStep((s) => s + 1);
  };

  const finish = () =>
    run(async () => {
      await api("/onboarding", { body: { username, displayName, region, topicIds, communityIds, bio: bio || undefined } });
      if (avatar) {
        const fd = new FormData();
        fd.append("file", avatar);
        await api("/me/avatar", { method: "POST", body: fd }).catch(() => {});
      }
      window.location.href = next === "/home" ? "/home?welcome=1" : next;
    });

  const errMsg = localErr ?? (fields.username ? `Username: ${fields.username}` : error);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <ol className="mb-8 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={clsx("h-1 rounded-full", i <= step ? "bg-ink" : "bg-line")} />
            <p className={clsx("mt-2 text-xs font-medium", i === step ? "text-ink" : "text-subtle")} aria-current={i === step ? "step" : undefined}>{s}</p>
          </li>
        ))}
      </ol>
      {!emailVerified && step === 0 && (
        <div className="mb-6"><Notice tone="for">We sent a confirmation link to <strong>{email}</strong>. You can set up your Wall now; you&apos;ll need to confirm before sending challenges.</Notice></div>
      )}
      {errMsg && <div className="mb-5"><ErrorNote>{errMsg}</ErrorNote></div>}

      {step === 0 && (
        <section className="space-y-5">
          <h1 className="font-serif text-3xl font-semibold">How should people know you?</h1>
          <Field id="dn" label="Display name"><Input id="dn" value={displayName} maxLength={50} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" /></Field>
          <Field id="un" label="Username" hint="Your Wall lives at faceoff/u/username. Letters, numbers and underscores.">
            <div className="flex items-center rounded-xl border border-line-strong bg-surface pl-3.5 focus-within:border-accent">
              <span className="text-muted">@</span>
              <input id="un" value={username} maxLength={24} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} className="w-full bg-transparent px-1.5 py-2.5 text-[15px] focus:outline-none" autoComplete="username" />
            </div>
          </Field>
          <Field id="rg" label="Where do you mostly debate from?" hint="Used to suggest nearby opponents. You can change it any time.">
            <Select id="rg" value={region} onChange={(e) => setRegion(e.target.value as Region)}>
              {REGIONS.map((r) => <option key={r} value={r}>{REGION_LABELS[r]}</option>)}
            </Select>
          </Field>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 className="font-serif text-3xl font-semibold">What do you like to argue about?</h1>
          <p className="mt-2 text-muted">Pick as many as you like. We use these to find you opponents and debates.</p>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Topics">
            {topics.map((t) => {
              const on = topicIds.includes(t.id);
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(topicIds, setTopicIds, t.id)}
                  className={clsx("inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium", on ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface hover:border-ink")}>
                  {on && <Check className="h-4 w-4" aria-hidden />}{t.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 className="font-serif text-3xl font-semibold">Join a few communities</h1>
          <p className="mt-2 text-muted">Communities are where motions get proposed and debates get scheduled. Optional — you can join later.</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {suggested.map((c) => {
              const on = communityIds.includes(c.id);
              return (
                <li key={c.id}>
                  <button type="button" aria-pressed={on} onClick={() => toggle(communityIds, setCommunityIds, c.id)}
                    className={clsx("h-full w-full rounded-2xl border p-4 text-left", on ? "border-ink bg-sunken" : "border-line bg-surface hover:border-line-strong")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{c.name}</span>
                      <span className={clsx("flex h-5 w-5 items-center justify-center rounded-full border", on ? "border-ink bg-ink text-bg" : "border-line-strong")}>{on && <Check className="h-3.5 w-3.5" />}</span>
                    </span>
                    <span className="mt-1 block text-sm text-muted">{c.description}</span>
                    {c.topic && <span className="mt-2 block text-xs text-subtle">{c.topic.name}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5">
          <h1 className="font-serif text-3xl font-semibold">Finish your Wall</h1>
          <Field id="bio" label="Bio (optional)" hint={`${bio.length}/280 — what do you stand for, and what would change your mind?`}>
            <Textarea id="bio" maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} />
          </Field>
          <div>
            <p className="text-sm font-medium">Profile picture (optional)</p>
            <div className="mt-2 flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>{avatar ? "Change picture" : "Upload a picture"}</Button>
              {avatar && <span className="text-sm text-muted">{avatar.name}</span>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} aria-label="Profile picture" />
            </div>
            <p className="mt-1.5 text-xs text-muted">JPG, PNG, WebP or GIF up to 5 MB. We remove location data from photos.</p>
          </div>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between">
        {step > 0 ? <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button> : <span />}
        {step < STEPS.length - 1 ? (
          <div className="flex gap-2">
            {step === 2 && <Button variant="ghost" onClick={() => setStep(3)}>Skip</Button>}
            <Button onClick={nextStep}>Continue</Button>
          </div>
        ) : (
          <Button onClick={finish} loading={busy}>Create my Wall</Button>
        )}
      </div>
    </div>
  );
}
