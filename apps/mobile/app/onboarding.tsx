import { useState } from "react";
import { Pressable, View } from "react-native";
import { REGIONS, REGION_LABELS, usernameSchema, type CommunitySummary, type Region, type TopicSummary } from "@faceoff/shared";
import { api, ApiError } from "@/api";
import { useAuth } from "@/auth";
import { useApi } from "@/useApi";
import { Button, ErrorBox, Field, Loading, Screen, T } from "@/components/ui";
import { radii, useTheme } from "@/theme";

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ borderRadius: radii.pill, borderWidth: 1, borderColor: on ? t.text : t.borderStrong, backgroundColor: on ? t.text : t.surface, paddingHorizontal: 14, paddingVertical: 8 }}>
      <T variant="label" color={on ? t.bg : t.text}>{label}</T>
    </Pressable>
  );
}

export default function Onboarding() {
  const { refresh, me } = useAuth();
  const topics = useApi<TopicSummary[]>("/topics");
  const communities = useApi<CommunitySummary[]>("/communities");
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [region, setRegion] = useState<Region>("global");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [communityIds, setCommunityIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (xs: string[], set: (v: string[]) => void, id: string) => set(xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);

  const next = async () => {
    setError(null);
    if (step === 0) {
      if (!displayName.trim()) return setError("Enter a display name");
      const u = usernameSchema.safeParse(username);
      if (!u.success) return setError(u.error.issues[0]?.message ?? "Choose a valid username");
    }
    if (step === 1 && !topicIds.length) return setError("Pick at least one topic");
    if (step < 2) return setStep(step + 1);
    setBusy(true);
    try {
      await api("/onboarding", { body: { username, displayName, region, topicIds, communityIds } });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <T variant="small">Step {step + 1} of 3</T>
      {!me?.emailVerified && step === 0 ? <T variant="muted">We sent a confirmation link to {me?.email}. Confirm it before sending challenges.</T> : null}
      <ErrorBox message={error} />
      {step === 0 && (
        <>
          <T variant="title">How should people know you?</T>
          <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={50} />
          <Field label="Username" value={username} onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))} autoCapitalize="none" maxLength={24} />
          <T variant="label">Region</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {REGIONS.map((r) => <Chip key={r} label={REGION_LABELS[r]} on={region === r} onPress={() => setRegion(r)} />)}
          </View>
        </>
      )}
      {step === 1 && (
        <>
          <T variant="title">What do you like to argue about?</T>
          {!topics.data ? <Loading /> : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {topics.data.map((x) => <Chip key={x.id} label={x.name} on={topicIds.includes(x.id)} onPress={() => toggle(topicIds, setTopicIds, x.id)} />)}
            </View>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <T variant="title">Join a few communities</T>
          <T variant="muted">Optional — you can join more later.</T>
          {!communities.data ? <Loading /> : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {communities.data.map((c) => <Chip key={c.id} label={c.name} on={communityIds.includes(c.id)} onPress={() => toggle(communityIds, setCommunityIds, c.id)} />)}
            </View>
          )}
        </>
      )}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        {step > 0 ? <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
        <Button title={step < 2 ? "Continue" : "Create my Wall"} onPress={next} loading={busy} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
