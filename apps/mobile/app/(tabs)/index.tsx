import { RefreshControl, View } from "react-native";
import { router } from "expo-router";
import type { DebateCard, MotionView } from "@faceoff/shared";
import { useApi } from "@/useApi";
import { useAuth } from "@/auth";
import { DebateCardView } from "@/components/DebateCardView";
import { MotionCardView } from "@/components/MotionCardView";
import { Button, Empty, ErrorBox, Loading, Screen, T } from "@/components/ui";
import { LogoMark } from "@/components/Logo";

interface Feed { live: DebateCard[]; forYou: DebateCard[]; motions: MotionView[] }

export default function Home() {
  const { me } = useAuth();
  const feed = useApi<Feed>("/feed");
  return (
    <Screen refresh={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.reload} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <LogoMark size={30} />
        <T variant="title">FaceOff</T>
      </View>
      {me && !me.emailVerified ? <T variant="muted">Confirm your email (check your inbox) to send challenges.</T> : null}
      <ErrorBox message={feed.error} />
      {!feed.data && !feed.error ? <Loading /> : null}
      {feed.data && feed.data.live.length > 0 ? (
        <>
          <T variant="heading">Live now</T>
          {feed.data.live.map((d) => <DebateCardView key={d.id} d={d} />)}
        </>
      ) : null}
      {feed.data ? (
        <>
          <T variant="heading">For you</T>
          {feed.data.forYou.length ? feed.data.forYou.map((d) => <DebateCardView key={d.id} d={d} />) : (
            <Empty title="Nothing here yet" body="Join communities or start the first debate yourself." action={<Button title="Start a FaceOff" onPress={() => router.push("/faceoff")} />} />
          )}
          {feed.data.motions.length > 0 ? <T variant="heading">Open motions</T> : null}
          {feed.data.motions.map((m) => <MotionCardView key={m.id} m={m} />)}
        </>
      ) : null}
    </Screen>
  );
}
