import { View } from "react-native";
import { router } from "expo-router";
import type { MotionView } from "@faceoff/shared";
import { Avatar, Badge, Button, Card, T, styles } from "./ui";
import { useTheme } from "../theme";
import { useAuth } from "../auth";

export function MotionCardView({ m }: { m: MotionView }) {
  const t = useTheme();
  const { me } = useAuth();
  const opposite = m.authorSide === "for" ? "against" : "for";
  return (
    <Card>
      <View style={styles.row}>
        <Avatar profile={m.author} size="xs" side={m.authorSide} />
        <T variant="label" style={{ flexShrink: 1 }} numberOfLines={1}>{m.author.displayName}</T>
        {m.authorSide ? <T variant="small" color={m.authorSide === "for" ? t.sideFor : t.sideAgainst}>argues {m.authorSide}</T> : null}
        {m.isDemo ? <Badge label="Demo" tone="demo" /> : null}
      </View>
      <T variant="proposition">{m.title}</T>
      {me && me.id !== m.author.userId && m.status === "listed" ? (
        <Button small title={m.authorSide ? `Challenge (argue ${opposite})` : "Challenge"} onPress={() => router.push(`/challenge/${m.author.userId}?motion=${m.id}`)} />
      ) : null}
    </Card>
  );
}
