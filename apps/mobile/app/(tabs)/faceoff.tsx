import { useRef, useState } from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import type { OpponentCard } from "@faceoff/shared";
import { REGION_LABELS } from "@faceoff/shared";
import { api } from "@/api";
import { useApi } from "@/useApi";
import { Avatar, Badge, Button, Empty, ErrorBox, Loading, Screen, T, styles } from "@/components/ui";
import { radii, useTheme } from "@/theme";
import { useAuth } from "@/auth";

const THRESHOLD = 110;

/** Swipe right to challenge, left to skip — with buttons as the accessible alternative. */
export default function FaceOffDeck() {
  const t = useTheme();
  const { me } = useAuth();
  const [availableOnly, setAvailableOnly] = useState(false);
  const deck = useApi<OpponentCard[]>(`/discover/opponents${availableOnly ? "?available=1" : ""}`);
  const [index, setIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const cards = deck.data ?? [];
  const top = cards[index];

  const advance = () => { pan.setValue({ x: 0, y: 0 }); setIndex((i) => i + 1); };
  const skip = () => {
    if (!top) return;
    api("/discover/skip", { body: { userId: top.profile.userId } }).catch(() => {});
    Animated.timing(pan, { toValue: { x: -500, y: 0 }, duration: 200, useNativeDriver: false }).start(advance);
  };
  const challenge = () => {
    if (!top) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const target = top;
    Animated.timing(pan, { toValue: { x: 500, y: 0 }, duration: 200, useNativeDriver: false }).start(() => {
      advance();
      router.push(`/challenge/${target.profile.userId}${target.motion ? `?motion=${target.motion.id}` : ""}`);
    });
  };
  const handlers = useRef({ skip, challenge });
  handlers.current = { skip, challenge };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > THRESHOLD) handlers.current.challenge();
        else if (g.dx < -THRESHOLD) handlers.current.skip();
        else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    }),
  ).current;
  const rotate = pan.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ["-12deg", "0deg", "12deg"] });

  return (
    <Screen>
      <T variant="title">Start a FaceOff</T>
      <T variant="muted">Swipe right to challenge, left to skip.</T>
      {me && !me.emailVerified ? <ErrorBox message="Confirm your email before sending challenges." /> : null}
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: availableOnly }} onPress={() => { setIndex(0); setAvailableOnly(!availableOnly); }}
        style={{ alignSelf: "flex-start", borderRadius: radii.pill, borderWidth: 1, borderColor: availableOnly ? t.success : t.borderStrong, paddingHorizontal: 14, paddingVertical: 7 }}>
        <T variant="label" color={availableOnly ? t.success : t.text}>Available now</T>
      </Pressable>
      <ErrorBox message={deck.error} />
      {!deck.data && !deck.error ? <Loading label="Finding opponents" /> : null}
      {deck.data && !top ? <Empty title="You've seen everyone for now" body="Try again later, or post a motion so challengers can find you." action={<Button title="Refresh" variant="secondary" onPress={() => { setIndex(0); deck.reload(); }} />} /> : null}
      {top ? (
        <>
          <Animated.View
            {...responder.panHandlers}
            accessible
            accessibilityLabel={`${top.profile.displayName}. ${top.motion ? `Will defend: ${top.motion.title}.` : ""} ${top.reasons.join(", ")}`}
            accessibilityActions={[{ name: "activate", label: "Challenge" }, { name: "escape", label: "Skip" }]}
            onAccessibilityAction={(e) => (e.nativeEvent.actionName === "activate" ? challenge() : skip())}
            style={{ transform: [{ translateX: pan.x }, { rotate }], backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: radii.xl, overflow: "hidden" }}
          >
            <View style={{ alignItems: "center", padding: 24, gap: 6 }}>
              <Avatar profile={top.profile} size="xl" />
              <T variant="title" style={{ textAlign: "center" }}>{top.profile.displayName}</T>
              <T variant="small">@{top.profile.username}{top.profile.region ? ` — ${REGION_LABELS[top.profile.region]}` : ""}</T>
              <View style={[styles.row, { flexWrap: "wrap", justifyContent: "center" }]}>
                {top.availableNow ? <Badge label="Available now" tone="success" /> : null}
                {top.profile.isDemo ? <Badge label="Demo" tone="demo" /> : null}
                <Badge label={`${top.debatesCompleted} debates`} />
              </View>
              {top.profile.bio ? <T style={{ textAlign: "center" }}>{top.profile.bio}</T> : null}
            </View>
            {top.motion ? (
              <View style={{ borderTopWidth: 1, borderColor: t.border, backgroundColor: t.surfaceSunken, padding: 18, gap: 4 }}>
                <T variant="small">Will defend</T>
                <T variant="proposition">{top.motion.title}</T>
                {top.motion.authorSide ? <T variant="small">They argue {top.motion.authorSide} — you&apos;d argue {top.motion.authorSide === "for" ? "against" : "for"}.</T> : null}
              </View>
            ) : null}
            {top.reasons.length ? <T variant="small" style={{ padding: 14 }}>Why you&apos;re seeing this: {top.reasons.join(", ").toLowerCase()}</T> : null}
          </Animated.View>
          <View style={[styles.row, { justifyContent: "center", gap: 16 }]}>
            <Button title="Skip" variant="secondary" onPress={skip} />
            <Button title="Challenge" onPress={challenge} disabled={!me?.emailVerified} />
          </View>
          {top.profile.isDemo ? <T variant="small" style={{ textAlign: "center" }}>Demo accounts never respond — challenges to them will expire.</T> : null}
        </>
      ) : null}
    </Screen>
  );
}
