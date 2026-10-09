"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, Checkbox, ErrorNote, Field, Input } from "@/components/ui";

export function SignUpForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [accept, setAccept] = useState(false);
  const { busy, error, fields, run } = useSubmit();
  const router = useRouter();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/auth/signup", { body: { email, password, dateOfBirth: dob, acceptTerms: accept } });
      router.push(`/onboarding?next=${encodeURIComponent(next)}`);
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Create your Wall</h1>
        <p className="mt-1.5 text-sm text-muted">Already have one? <Link href={`/signin?next=${encodeURIComponent(next)}`} className="font-medium text-link underline underline-offset-4">Sign in</Link></p>
      </div>
      {error && !Object.keys(fields).length && <ErrorNote>{error}</ErrorNote>}
      <Field id="email" label="Email" error={fields.email}>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!fields.email} />
      </Field>
      <Field id="password" label="Password" error={fields.password} hint="At least 10 characters, with a letter and a number.">
        <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!fields.password} />
      </Field>
      <Field id="dob" label="Date of birth" error={fields.dateOfBirth} hint="FaceOff is for people aged 18 and over. Your birth date is never shown publicly.">
        <Input id="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} invalid={!!fields.dateOfBirth} max={new Date().toISOString().slice(0, 10)} />
      </Field>
      <div>
        <Checkbox
          checked={accept}
          onChange={setAccept}
          label={<>I agree to the <Link href="/terms" target="_blank" className="text-link underline">Terms</Link>, <Link href="/privacy" target="_blank" className="text-link underline">Privacy Policy</Link> and <Link href="/guidelines" target="_blank" className="text-link underline">Community Guidelines</Link>.</>}
        />
        {fields.acceptTerms && <p role="alert" className="mt-1 text-sm text-danger">{fields.acceptTerms}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      <p className="text-xs text-subtle">Sign-in with Google, Apple and phone numbers is planned for a later release.</p>
    </form>
  );
}
