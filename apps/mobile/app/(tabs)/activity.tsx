import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import type { ChallengeView, NotificationView } from "@faceoff/shared";
import { api, ApiError } from "@/api";
import { useApi } from "@/useApi";
import { useAuth } from "@/auth";
import { Avatar, Badge, Button, Card, Empty, ErrorBox, Loading, Screen, T, styles } from "@/components/ui";
import { radii, useTheme } from "@/theme";

interface Lists { incoming: ChallengeView[]; outgoing: ChallengeView[]; upcoming: ChallengeView[]; past: ChallengeView[] }

function ChallengeRow({ c, onChanged }: { c: ChallengeView; onChanged: () => void }) {
  const { me } = useAuth();
  const t = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = c.challenger.userId === me?.id;
  const other = mine ? c.recipient : c.challenger;
  const mySide = mine ? c.challengerSide : c.challengerSide === "for" ? "against" : "for";
  const respond = async (action: "accept" | "decline" | "cancel") => {
    setBusy(action); setError(null);
    try {
      const r = await api<{ sessionId: string | null }>(`/challenges/${c.id}/respond`, { body: { action } });
      if (action === "accept" && r.sessionId) router.push(`/d/${r.sessionId}`);
      onChanged();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong"); }
    finally { setBusy(null); }
  };
  return (
    <Card>
      <View style={styles.row}>
        <Avatar profile={other} size="sm" />
        <T variant="label" style={{ flex: 1 }}>{other.displayName} {mine ? "(you challenged)" : "challenged you"}</T>
        <Badge label={c.status} tone={c.status === "pending" ? "for" : "neutral"} />
      </View>
      <T variant="proposition">{c.proposition}</T>
      <T variant="small">You argue <T variant="small" color={mySide === "for" ? t.sideFor : t.sideAgainst}>{mySide}</T>{c.proposedStart ? ` — ${new Date(c.proposedStart).toLocaleString()}` : " — instant"}{c.recordingEnabled ? " — recording requested" : ""}</T>
      <ErrorBox message={error} />
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        {c.actions.includes("accept") ? <Button small title="Accept" loading={busy === "accept"} onPress={() => respond("accept")} /> : null}
        {c.actions.includes("decline") ? <Button small variant="secondary" title="Decline" loading={busy === "decline"} onPress={() => respond("decline")} /> : null}
        {c.actions.includes("cancel") ? <Button small variant="ghost" title="Withdraw" loading={busy === "cancel"} onPress={() => respond("cancel")} /> : null}
        {c.actions.includes("open_room") && c.sessionId ? <Button small title="Open debate room" onPress={() => router.push(`/d/${c.sessionId}`)} /> : null}
      </View>
    </Card>
  );
}

export default function Activity() {
  const t = useTheme();
  const [tab, setTab] = useState<"notifications" | "challenges">("challenges");
  const notes = useApi<{ items: NotificationView[]; unread: number }>(tab === "notifications" ? "/notifications" : null);
  const ch = useApi<Lists>(tab === "challenges" ? "/challenges" : null);
  return (
    <Screen refresh={<RefreshControl refreshing={notes.refreshing || ch.refreshing} onRefresh={() => (tab === "notifications" ? notes.reload() : ch.reload())} />}>
      <T variant="title">Activity</T>
      <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="tablist">
        {(["challenges", "notifications"] as const).map((k) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)}
            style={{ borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: tab === k ? t.text : "transparent", borderWidth: 1, borderColor: tab === k ? t.text : t.borderStrong }}>
            <T variant="label" color={tab === k ? t.bg : t.text}>{k === "challenges" ? "Challenges" : "Notifications"}</T>
          </Pressable>
        ))}
      </View>
      {tab === "challenges" ? (
        <>
          <ErrorBox message={ch.error} />
          {!ch.data && !ch.error ? <Loading /> : null}
          {ch.data ? (
            <>
              <T variant="heading">Waiting for you</T>
              {ch.data.incoming.length ? ch.data.incoming.map((c) => <ChallengeRow key={c.id} c={c} onChanged={ch.reload} />) : <T variant="muted">Nothing waiting.</T>}
              <T variant="heading">Scheduled and ready</T>
              {ch.data.upcoming.length ? ch.data.upcoming.map((c) => <ChallengeRow key={c.id} c={c} onChanged={ch.reload} />) : <T variant="muted">No upcoming FaceOffs.</T>}
              <T variant="heading">Sent</T>
              {ch.data.outgoing.length ? ch.data.outgoing.map((c) => <ChallengeRow key={c.id} c={c} onChanged={ch.reload} />) : <T variant="muted">No pending challenges you sent.</T>}
            </>
          ) : null}
        </>
      ) : (
        <>
          <ErrorBox message={notes.error} />
          {!notes.data && !notes.error ? <Loading /> : null}
          {notes.data && notes.data.items.length === 0 ? <Empty title="You're all caught up" /> : null}
          {notes.data?.items.map((n) => (
            <Card key={n.id} onPress={n.href ? () => { const m = /^\/(d|u)\/([^?]+)/.exec(n.href!); if (m) router.push(`/${m[1]}/${m[2]}`); } : undefined} accessibilityLabel={n.title}>
              <T variant="label">{n.title}</T>
              {n.body ? <T variant="small">{n.body}</T> : null}
              <T variant="small">{new Date(n.createdAt).toLocaleString()}</T>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
