import { useState } from "react";
import { RefreshControl, Share, View } from "react-native";
import { router } from "expo-router";
import { REGION_LABELS, type DebateCard, type ProfileDetail } from "@faceoff/shared";
import { api, API_URL, ApiError } from "../api";
import { useApi } from "../useApi";
import { DebateCardView } from "./DebateCardView";
import { Avatar, Badge, Button, Empty, ErrorBox, Loading, Screen, T, styles } from "./ui";

export function WallView({ username, header }: { username: string; header?: React.ReactNode }) {
  const p = useApi<ProfileDetail>(`/users/${username}`);
  const debates = useApi<DebateCard[]>(`/users/${username}/debates`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = p.data?.viewer;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); p.reload(); } catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong"); } finally { setBusy(false); }
  };
  return (
    <Screen refresh={<RefreshControl refreshing={p.refreshing} onRefresh={() => { p.reload(); debates.reload(); }} />}>
      {header}
      <ErrorBox message={p.error ?? error} />
      {!p.data && !p.error ? <Loading /> : null}
      {p.data ? (
        <>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Avatar profile={p.data} size="xl" />
            <T variant="title" style={{ textAlign: "center" }}>{p.data.displayName}</T>
            <T variant="small">@{p.data.username}{p.data.region ? ` — ${REGION_LABELS[p.data.region]}` : ""}</T>
            <View style={styles.row}>
              {p.data.isDemo ? <Badge label="Demo" tone="demo" /> : null}
              {p.data.availableNow ? <Badge label="Available now" tone="success" /> : null}
            </View>
            {p.data.bio ? <T style={{ textAlign: "center" }}>{p.data.bio}</T> : null}
            <T variant="small">{p.data.debatesCompleted} debates — {p.data.followers} followers — {p.data.following} following</T>
          </View>
          <View style={[styles.row, { justifyContent: "center", flexWrap: "wrap" }]}>
            {v && !v.isSelf ? (
              <>
                <Button small variant={v.follows ? "secondary" : "accent"} title={v.follows ? "Following" : "Follow"} loading={busy}
                  onPress={() => act(() => api(`/users/id/${p.data!.userId}/follow`, { method: v.follows ? "DELETE" : "POST", body: {} }))} />
                {v.canChallenge ? <Button small title="Send a challenge" onPress={() => router.push(`/challenge/${p.data!.userId}`)} /> : null}
                <Button small variant="ghost" title={v.blocked ? "Unblock" : "Block"} onPress={() => act(() => api(`/users/id/${p.data!.userId}/block`, { method: v.blocked ? "DELETE" : "POST", body: {} }))} />
                <Button small variant="ghost" title="Report" onPress={() => act(() => api("/reports", { body: { targetType: "user", targetId: p.data!.userId, reason: "harassment" } }))} />
              </>
            ) : null}
            <Button small variant="secondary" title="Share" onPress={() => Share.share({ message: `${p.data!.displayName} on FaceOff: ${API_URL}/u/${p.data!.username}` })} />
          </View>
          <T variant="heading">Debates</T>
          {v && !v.canView ? <Empty title="This Wall is visible to followers" /> : null}
          {debates.data?.map((d) => <DebateCardView key={d.id} d={d} />)}
          {debates.data && debates.data.length === 0 && (!v || v.canView) ? <Empty title="No debates yet" /> : null}
        </>
      ) : null}
    </Screen>
  );
}
