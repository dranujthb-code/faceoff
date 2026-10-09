import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/auth";
import { ApiError } from "@/api";
import { Button, ErrorBox, Field, Screen, T } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { useTheme } from "@/theme";

export default function SignIn() {
  const { signIn } = useAuth();
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try { await signIn(email.trim(), password); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't sign in"); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 8, marginTop: 24 }}>
        <LogoMark size={88} />
        <T variant="display">FaceOff</T>
        <T variant="small" style={{ letterSpacing: 2 }}>YOU HAVE A VOICE</T>
      </View>
      <T variant="title" style={{ marginTop: 16 }}>Sign in</T>
      <ErrorBox message={error} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" />
      <Button title="Sign in" onPress={submit} loading={busy} />
      <Link href="/forgot" style={{ color: t.link, fontSize: 15 }}>Forgot password?</Link>
      <Link href="/sign-up" style={{ color: t.link, fontSize: 15 }}>New here? Create your Wall</Link>
    </Screen>
  );
}
