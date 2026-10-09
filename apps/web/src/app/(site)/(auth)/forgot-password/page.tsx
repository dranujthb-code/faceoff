"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, ErrorNote, Field, Input, Notice } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const { busy, error, fields, run } = useSubmit();
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => setSent((await api<{ message: string }>("/auth/forgot-password", { body: { email } })).message));
      }}
    >
      <h1 className="font-serif text-3xl font-semibold">Reset your password</h1>
      <p className="text-sm text-muted">Enter the email you signed up with and we&apos;ll send a link to choose a new password.</p>
      {sent ? <Notice tone="for">{sent}</Notice> : error && <ErrorNote>{error}</ErrorNote>}
      <Field id="email" label="Email" error={fields.email}>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
      <p className="text-sm"><Link href="/signin" className="text-link underline underline-offset-4">Back to sign in</Link></p>
    </form>
  );
}
