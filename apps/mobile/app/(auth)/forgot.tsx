import { useState } from "react";
import { router } from "expo-router";
import { api, ApiError } from "@/api";
import { Button, ErrorBox, Field, Screen, T } from "@/components/ui";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <T variant="title">Reset your password</T>
      <T variant="muted">We&apos;ll email you a link to choose a new password.</T>
      <ErrorBox message={error} />
      {msg ? <T>{msg}</T> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Button title="Send reset link" loading={busy} onPress={async () => {
        setBusy(true); setError(null);
        try { setMsg((await api<{ message: string }>("/auth/forgot-password", { body: { email: email.trim() } })).message); }
        catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't send"); }
        finally { setBusy(false); }
      }} />
      <Button title="Back to sign in" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
