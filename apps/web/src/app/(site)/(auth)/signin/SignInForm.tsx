"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, ErrorNote, Field, Input, Notice } from "@/components/ui";

export function SignInForm({ next, reset }: { next: string; reset: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, fields, run } = useSubmit();
  const router = useRouter();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/auth/signin", { body: { email, password } });
      router.push(next);
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted">New to FaceOff? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-link underline underline-offset-4">Create your Wall</Link></p>
      </div>
      {reset && <Notice tone="for">Your password was changed. Sign in with your new password.</Notice>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field id="email" label="Email" error={fields.email}>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="password" label="Password" error={fields.password}>
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between">
        <Link href="/forgot-password" className="text-sm text-link underline underline-offset-4">Forgot password?</Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
    </form>
  );
}
