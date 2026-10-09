"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const { busy, error, fields, run } = useSubmit();
  const router = useRouter();
  if (!token) return <ErrorNote>This reset link is incomplete. Request a new one from the sign-in page.</ErrorNote>;
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api("/auth/reset-password", { body: { token, password } });
          router.push("/signin?reset=1");
        });
      }}
    >
      <h1 className="font-serif text-3xl font-semibold">Choose a new password</h1>
      {error && !fields.password && <ErrorNote>{error}</ErrorNote>}
      <Field id="password" label="New password" error={fields.password} hint="At least 10 characters, with a letter and a number. You'll be signed out everywhere else.">
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>Save new password</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
