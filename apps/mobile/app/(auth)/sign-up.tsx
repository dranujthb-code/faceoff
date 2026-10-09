import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/auth";
import { ApiError, API_URL } from "@/api";
import { Button, ErrorBox, Field, Screen, T, styles } from "@/components/ui";
import { useTheme } from "@/theme";

export default function SignUp() {
  const { signUp } = useAuth();
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const submit = async () => {
    if (!accept) return setError("Accept the Terms and Community Guidelines to continue.");
    setBusy(true); setError(null); setFields({});
    try { await signUp(email.trim(), password, dob.trim()); }
    catch (e) { if (e instanceof ApiError) { setError(e.message); setFields(e.fields ?? {}); } else setError("Couldn't create your account"); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <T variant="title">Create your Wall</T>
      <ErrorBox message={error} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={fields.email} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry error={fields.password} hint="At least 10 characters, with a letter and a number." />
      <Field label="Date of birth (YYYY-MM-DD)" value={dob} onChangeText={setDob} placeholder="1995-06-15" keyboardType="numbers-and-punctuation" error={fields.dateOfBirth} hint="FaceOff is for adults 18+. Never shown publicly." />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accept }} onPress={() => setAccept(!accept)} style={[styles.row, { alignItems: "flex-start" }]}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: t.accent, backgroundColor: accept ? t.accent : "transparent", marginTop: 1 }} />
        <T style={{ flex: 1 }}>I agree to the Terms, Privacy Policy and Community Guidelines.</T>
      </Pressable>
      <Pressable onPress={() => Linking.openURL(`${API_URL}/guidelines`)} accessibilityRole="link"><T color={t.link}>Read the Community Guidelines</T></Pressable>
      <Button title="Create account" onPress={submit} loading={busy} />
      <Link href="/sign-in" style={{ color: t.link, fontSize: 15 }}>Already have an account? Sign in</Link>
    </Screen>
  );
}
