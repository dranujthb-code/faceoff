import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Share, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";
import { END_REASON_LABELS, POLL_DEFINITIONS, formatClock, type CommentView, type EndReason, type PollKind, type SessionState } from "@faceoff/shared";
import { api, API_URL, ApiError } from "@/api";
import { useAuth } from "@/auth";
import { liveKitAvailable } from "@/room/setup";
import { Avatar, Badge, Button, ErrorBox, InkDivider, Loading, T, styles } from "@/components/ui";
import { fonts, radii, stageTheme as t } from "@/theme";

const CHOICE: Record<string, string> = { for: "For", against: "Against", tie: "Even", undecided: "Undecided" };

function useClock(endsAt: string | null, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);
  return endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - (now + offset)) / 1000)) : null;
}

export default function DebateRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const [state, setState] = useState<SessionState | null>(null);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<{ url: string; token: string } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [rules, setRules] = useState(false);
  const [recording, setRecording] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const status = state?.session.status;
  const active = status === "ready" || status === "live";
  const refresh = useCallback(async () => {
    const t0 = Date.now();
    try {
      const s = active ? await api<SessionState>(`/debates/${id}/presence`, { body: {} }) : await api<SessionState>(`/debates/${id}/state`);
      setOffset(Date.parse(s.serverNow) + (Date.now() - t0) / 2 - Date.now());
      setState(s);
      setComments(await api<CommentView[]>(`/debates/${id}/comments`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load the debate");
    }
  }, [id, active]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const i = setInterval(refresh, active ? 2500 : 15000);
    return () => { clearTimeout(first); clearInterval(i); };
  }, [refresh, active]);

  const remaining = useClock(state?.session.endsAt ?? null, offset);
  const asked = useRef(false);
  useEffect(() => {
    if (status === "live" && remaining === 0 && !asked.current) { asked.current = true; setTimeout(refresh, 400); }
  }, [remaining, status, refresh]);

  const role = state?.viewer.role;
  const meP = state?.participants.find((p) => p.userId === me?.id);
  const wantVideo = !!state?.video.configured && liveKitAvailable && ((role === "debater" && !!meP?.readyAt && active) || (role !== "debater" && status === "live"));
  useEffect(() => {
    if (!wantVideo || video) return;
    let live = true;
    api<{ token: string; url: string }>(`/debates/${id}/video-token`, { body: {} }).then(
      (v) => { if (live) setVideo(v); },
      (e) => { if (live) setVideoError(e instanceof ApiError ? e.message : "Couldn't connect video"); },
    );
    return () => { live = false; };
  }, [wantVideo, video, id]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); await refresh(); } catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong"); } finally { setBusy(null); }
  };

  if (!state) return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>{error ? <ErrorBox message={error} /> : <Loading />}</SafeAreaView>;
  const s = state.session;
  const ended = ["completed", "interrupted", "failed", "cancelled"].includes(s.status);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stage = wantVideo && video ? (require("@/room/MobileStage").default as typeof import("@/room/MobileStage").default) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.between}>
          <Button small variant="ghost" title="Close" onPress={() => router.back()} />
          <View style={styles.row}>
            {s.status === "live" ? <Badge label="Live" tone="live" /> : <Badge label={s.status} />}
            <Button small variant="ghost" title="Share" onPress={() => Share.share({ message: `${s.proposition} — ${API_URL}/d/${s.id}` })} />
          </View>
        </View>
        <T variant="display" color={t.text}>{s.proposition}</T>
        <T variant="small" color={t.textMuted}>{s.forSide.displayName} argues for, {s.againstSide.displayName} argues against. {state.viewersNow} watching.</T>
        {s.status === "live" && remaining !== null ? (
          <View accessibilityRole="timer" accessibilityLabel={`${formatClock(remaining)} remaining`} style={{ alignSelf: "center", borderWidth: 1, borderColor: remaining <= 60 ? t.sideAgainst : t.borderStrong, borderRadius: radii.lg, paddingHorizontal: 22, paddingVertical: 8 }}>
            <T color={remaining <= 60 ? t.sideAgainst : t.text} style={{ fontFamily: fonts.sansSemi, fontSize: 40, fontVariant: ["tabular-nums"] }}>{formatClock(remaining)}</T>
          </View>
        ) : null}
        <ErrorBox message={error ?? videoError} />

        {s.status === "ready" && role === "debater" && !meP?.readyAt ? (
          <View style={{ backgroundColor: t.surface, borderRadius: radii.lg, padding: 16, gap: 12 }}>
            <T variant="heading" color={t.text}>Green room</T>
            <T color={t.textMuted}>Ten minutes, one-on-one, unscripted. Argue the idea, not the person: no threats, harassment, hate or doxxing. The debate is public.</T>
            {s.recordingEnabled ? (
              <View style={{ gap: 8 }}>
                <T color={t.text}>This debate is set to be recorded. It is recorded only if both of you agree.</T>
                <View style={styles.row}>
                  <Button small variant={recording ? "accent" : "secondary"} title="I agree to be recorded" onPress={() => setRecording(true)} />
                  <Button small variant={!recording ? "accent" : "secondary"} title="Don't record" onPress={() => setRecording(false)} />
                </View>
              </View>
            ) : null}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rules }} onPress={() => setRules(!rules)} style={styles.row}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: t.accent, backgroundColor: rules ? t.accent : "transparent" }} />
              <T color={t.text} style={{ flex: 1 }}>I agree to the debate rules and Community Guidelines</T>
            </Pressable>
            <Button title="I'm ready" disabled={!rules} loading={busy === "ready"} onPress={() => act("ready", () => api(`/debates/${s.id}/ready`, { body: { acceptRules: true, acceptRecording: s.recordingEnabled ? recording : false } }))} />
          </View>
        ) : null}

        {s.status === "ready" && (meP?.readyAt || role !== "debater") ? <T color={t.textMuted}>{role === "debater" ? "You're ready. The clock starts when your opponent is ready too." : "The debaters are getting ready."}</T> : null}

        {active ? (
          Stage && video ? (
            <Stage url={video.url} token={video.token} isDebater={role === "debater"} participants={state.participants} />
          ) : (
            <View style={{ gap: 10 }}>
              {!state.video.configured ? <T variant="small" color={t.warning}>Live video isn&apos;t configured on this server yet. The clock, chat and voting still work.</T> : !liveKitAvailable ? <T variant="small" color={t.warning}>Live video needs the full FaceOff app build (not Expo Go).</T> : null}
              <View style={[styles.row, { justifyContent: "space-around" }]}>
                {state.participants.map((p) => (
                  <View key={p.userId} style={{ alignItems: "center", gap: 6 }}>
                    <Avatar profile={p.profile} size="lg" side={p.side} />
                    <T variant="label" color={t.text}>{p.profile.displayName}</T>
                    <T variant="small" color={p.side === "for" ? t.sideFor : t.sideAgainst}>{p.side === "for" ? "For" : "Against"}</T>
                  </View>
                ))}
              </View>
            </View>
          )
        ) : null}

        {s.status === "live" && role === "debater" ? (
          <View style={[styles.row, { justifyContent: "center" }]}>
            {s.hostId === me?.id ? <Button small variant="danger" title="End early" loading={busy === "end"} onPress={() => act("end", () => api(`/debates/${s.id}/end`, { body: {} }))} /> : null}
            <Button small variant="ghost" title="Leave" onPress={() => act("leave", async () => { await api(`/debates/${s.id}/leave`, { body: {} }); router.back(); })} />
          </View>
        ) : null}

        {ended ? (
          <View style={{ backgroundColor: t.surface, borderRadius: radii.lg, padding: 16, gap: 8 }}>
            <T variant="heading" color={t.text}>{s.status === "completed" ? "Debate complete" : s.status === "interrupted" ? "Debate interrupted" : "This debate didn't happen"}</T>
            {s.endReason ? <T color={t.textMuted}>{END_REASON_LABELS[s.endReason as EndReason]}</T> : null}
            <T variant="small" color={t.textMuted}>{state.recording.status === "ready" ? "Replay available on the web." : "No replay for this debate."}</T>
          </View>
        ) : null}

        {(["persuasion", "position"] as PollKind[]).map((k) => {
          const poll = state.polls[k];
          if (!poll || (poll.total === 0 && !state.viewer.canVote)) return null;
          const mine = state.viewer.votes[k];
          const blocked = k === "persuasion" && role === "debater";
          return (
            <View key={k} style={{ backgroundColor: t.surface, borderRadius: radii.lg, padding: 14, gap: 8 }}>
              <T variant="label" color={t.text}>{POLL_DEFINITIONS[k].question}</T>
              <T variant="small" color={t.textMuted}>{POLL_DEFINITIONS[k].help}</T>
              {POLL_DEFINITIONS[k].choices.map((c) => {
                const pct = poll.total ? Math.round(((poll.tallies[c] ?? 0) / poll.total) * 100) : 0;
                return (
                  <Pressable key={c} disabled={!state.viewer.canVote || blocked || poll.status !== "open"} accessibilityRole="radio" accessibilityState={{ selected: mine === c }}
                    onPress={() => act(`vote-${k}`, () => api(`/debates/${s.id}/votes`, { body: { poll: k, choice: c } }))}
                    style={{ borderWidth: 1, borderColor: mine === c ? t.text : t.borderStrong, borderRadius: radii.md, padding: 10, flexDirection: "row", justifyContent: "space-between" }}>
                    <T color={t.text}>{CHOICE[c]}{mine === c ? " (your vote)" : ""}</T>
                    {mine || poll.status === "closed" || role === "debater" ? <T color={t.textMuted}>{pct}%</T> : null}
                  </Pressable>
                );
              })}
              <T variant="small" color={t.textMuted}>{poll.total} votes{blocked ? " — debaters can't vote on this one" : ""}</T>
            </View>
          );
        })}

        <InkDivider height={0} />
        <T variant="heading" color={t.text}>Comments</T>
        {comments.filter((c) => c.status === "visible").map((c) => (
          <View key={c.id} style={[styles.row, { alignItems: "flex-start" }]}>
            <Avatar profile={c.author} size="xs" />
            <View style={{ flex: 1 }}>
              <T variant="label" color={t.text}>{c.author.displayName}</T>
              <T color={t.text}>{c.body}</T>
            </View>
          </View>
        ))}
        {state.viewer.canComment ? (
          <View style={styles.row}>
            <TextInput value={body} onChangeText={setBody} maxLength={500} placeholder="Say something about the arguments" placeholderTextColor={t.textSubtle} accessibilityLabel="Write a comment"
              style={{ flex: 1, borderWidth: 1, borderColor: t.borderStrong, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 10, color: t.text, fontFamily: fonts.sans }} />
            <Button small title="Post" disabled={!body.trim()} loading={busy === "comment"} onPress={() => act("comment", async () => { await api(`/debates/${s.id}/comments`, { body: { body } }); setBody(""); })} />
          </View>
        ) : null}
        {me && role !== "debater" ? <Button small variant="ghost" title="Report this debate" onPress={() => act("report", () => api("/reports", { body: { targetType: "session", targetId: s.id, reason: "other" } }))} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
