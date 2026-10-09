import { View } from "react-native";
import { router } from "expo-router";
import type { DebateCard } from "@faceoff/shared";
import { Avatar, Badge, Card, InkDivider, T, styles } from "./ui";
import { useTheme } from "../theme";

function statusLabel(d: DebateCard): { label: string; tone: "live" | "for" | "neutral" } {
  if (d.status === "live") return { label: "Live", tone: "live" };
  if (d.status === "scheduled" || d.status === "ready") return { label: d.scheduledStart ? new Date(d.scheduledStart).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "Starting soon", tone: "for" };
  if (d.status === "interrupted") return { label: "Interrupted", tone: "neutral" };
  return { label: d.replayStatus === "ready" ? "Replay" : "Completed", tone: "neutral" };
}

export function DebateCardView({ d }: { d: DebateCard }) {
  const t = useTheme();
  const s = statusLabel(d);
  return (
    <Card onPress={() => router.push(`/d/${d.id}`)} accessibilityLabel={`${d.proposition}. ${d.forSide.displayName} for, ${d.againstSide.displayName} against. ${s.label}`}>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        <Badge label={s.label} tone={s.tone} />
        {d.community ? <T variant="small">{d.community.name}</T> : null}
        {d.isDemo ? <Badge label="Demo" tone="demo" /> : null}
      </View>
      <T variant="proposition">{d.proposition}</T>
      <View style={styles.between}>
        <View style={[styles.row, { flex: 1 }]}>
          <Avatar profile={d.forSide} size="sm" side="for" />
          <View style={{ flexShrink: 1 }}>
            <T variant="label" numberOfLines={1}>{d.forSide.displayName}</T>
            <T variant="small" color={t.sideFor}>For</T>
          </View>
        </View>
        <InkDivider height={34} />
        <View style={[styles.row, { flex: 1, justifyContent: "flex-end" }]}>
          <View style={{ flexShrink: 1, alignItems: "flex-end" }}>
            <T variant="label" numberOfLines={1}>{d.againstSide.displayName}</T>
            <T variant="small" color={t.sideAgainst}>Against</T>
          </View>
          <Avatar profile={d.againstSide} size="sm" side="against" />
        </View>
      </View>
    </Card>
  );
}
