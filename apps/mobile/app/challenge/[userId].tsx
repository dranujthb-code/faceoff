import { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { MotionView, ProfileDetail, Side } from "@faceoff/shared";
import { api, ApiError } from "@/api";
import { useApi } from "@/useApi";
import { Avatar, Button, Empty, ErrorBox, Field, Loading, Screen, T, styles } from "@/components/ui";
import { radii, useTheme } from "@/theme";

function ComposerForm({ recipient, motion }: { recipient: ProfileDetail; motion: MotionView | null }) {
  const t = useTheme();
  const sideLocked = !!(motion?.authorSide && motion.author.userId === recipient.userId);
  const [proposition, setProposition] = useState(motion?.title ?? "");
  const [side, setSide] = useState<Side>(sideLocked ? (motion!.authorSide === "for" ? "against" : "for") : "for");
  const [kind, setKind] = useState<"instant" | "scheduled">(recipient.availableNow ? "instant" : "scheduled");
  const [when, setWhen] = useState("");
  const [recording, setRecording] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const send = async () => {
    setBusy(true); setError(null); setFields({});
    try {
      const start = kind === "scheduled" ? new Date(when.trim().replace(" ", "T")) : null;
      if (start && Number.isNaN(start.getTime())) { setFields({ proposedStart: "Use the format YYYY-MM-DD HH:MM" }); return; }
      await api("/challenges", {
        body: { recipientId: recipient.userId, proposition, challengerSide: side, motionId: motion?.id, kind, proposedStart: start?.toISOString(), recordingEnabled: recording },
      });
      router.replace("/activity");
    } catch (e) {
      if (e instanceof ApiError) { setError(e.message); setFields(e.fields ?? {}); } else setError("Couldn't send");
    } finally { setBusy(false); }
  };

  return (
    <>
      <View style={styles.row}><Avatar profile={recipient} size="md" /><View><T variant="label">{recipient.displayName}</T><T variant="small">@{recipient.username}</T></View></View>
      <ErrorBox message={error} />
      <Field label="Proposition" value={proposition} onChangeText={setProposition} editable={!motion} maxLength={160} error={fields.proposition} hint="One clear statement. They see it before accepting." />
      <T variant="label">Sides</T>
      <View style={[styles.row, { alignItems: "stretch" }]}>
        {(["for", "against"] as const).map((s) => (
          <Pressable key={s} disabled={sideLocked} accessibilityRole="radio" accessibilityState={{ selected: side === s, disabled: sideLocked }} onPress={() => setSide(s)}
            style={{ flex: 1, borderRadius: radii.lg, borderWidth: 1, padding: 12, borderColor: side === s ? (s === "for" ? t.sideFor : t.sideAgainst) : t.borderStrong, backgroundColor: side === s ? (s === "for" ? t.sideForSoft : t.sideAgainstSoft) : t.surface }}>
            <T variant="small" color={s === "for" ? t.sideFor : t.sideAgainst}>{s === "for" ? "For" : "Against"}</T>
            <T variant="label">{side === s ? "You" : recipient.displayName}</T>
          </Pressable>
        ))}
      </View>
      {sideLocked ? <T variant="small">{recipient.displayName} posted this motion arguing {motion!.authorSide}.</T> : null}
      <T variant="label">When</T>
      <View style={styles.row}>
        <Button small variant={kind === "instant" ? "accent" : "secondary"} title="Right now" onPress={() => setKind("instant")} />
        <Button small variant={kind === "scheduled" ? "accent" : "secondary"} title="Schedule" onPress={() => setKind("scheduled")} />
      </View>
      {kind === "scheduled" ? <Field label="Start (YYYY-MM-DD HH:MM, your time)" value={when} onChangeText={setWhen} placeholder="2026-10-12 19:30" error={fields.proposedStart} /> : null}
      <View style={styles.between}>
        <T style={{ flex: 1 }}>Record for a replay — both debaters must agree before going live.</T>
        <Switch value={recording} onValueChange={setRecording} accessibilityLabel="Record this debate" />
      </View>
      <Button title="Send challenge" onPress={send} loading={busy} />
    </>
  );
}

export default function Compose() {
  const { userId, motion: motionId } = useLocalSearchParams<{ userId: string; motion?: string }>();
  const profile = useApi<ProfileDetail>(`/users/id/${userId}`);
  const motion = useApi<MotionView>(motionId ? `/motions/${motionId}` : null);
  const ready = profile.data && (!motionId || motion.data);
  return (
    <Screen>
      <View style={styles.between}>
        <T variant="title">Send a challenge</T>
        <Button small variant="ghost" title="Close" onPress={() => router.back()} />
      </View>
      <ErrorBox message={profile.error ?? motion.error} />
      {!ready && !profile.error ? <Loading /> : null}
      {ready && !profile.data!.viewer?.canChallenge ? <Empty title={`${profile.data!.displayName} isn't accepting challenges from you`} /> : null}
      {ready && profile.data!.viewer?.canChallenge ? <ComposerForm recipient={profile.data!} motion={motion.data} /> : null}
    </Screen>
  );
}
