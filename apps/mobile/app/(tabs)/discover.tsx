import { useState } from "react";
import { Pressable, RefreshControl, TextInput, View } from "react-native";
import type { DebateCard } from "@faceoff/shared";
import { useApi } from "@/useApi";
import { DebateCardView } from "@/components/DebateCardView";
import { Empty, ErrorBox, Loading, Screen, T } from "@/components/ui";
import { fonts, radii, useTheme } from "@/theme";

const TABS = [["recent", "All"], ["live", "Live"], ["upcoming", "Upcoming"], ["replays", "Replays"]] as const;

export default function Discover() {
  const t = useTheme();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("recent");
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const path = submitted.length >= 2 ? `/debates?filter=all&q=${encodeURIComponent(submitted)}` : `/debates?filter=${tab}`;
  const list = useApi<DebateCard[]>(path);
  return (
    <Screen refresh={<RefreshControl refreshing={list.refreshing} onRefresh={list.reload} />}>
      <T variant="title">Discover</T>
      <TextInput
        accessibilityLabel="Search debates"
        placeholder="Search debates"
        placeholderTextColor={t.textSubtle}
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => setSubmitted(q.trim())}
        returnKeyType="search"
        style={{ borderWidth: 1, borderColor: t.borderStrong, borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 12, color: t.text, backgroundColor: t.surface, fontFamily: fonts.sans, fontSize: 16 }}
      />
      {!submitted && (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }} accessibilityRole="tablist">
          {TABS.map(([k, l]) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)}
              style={{ borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: tab === k ? t.text : "transparent", borderWidth: 1, borderColor: tab === k ? t.text : t.borderStrong }}>
              <T variant="label" color={tab === k ? t.bg : t.text}>{l}</T>
            </Pressable>
          ))}
        </View>
      )}
      <ErrorBox message={list.error} />
      {!list.data && !list.error ? <Loading /> : null}
      {list.data?.map((d) => <DebateCardView key={d.id} d={d} />)}
      {list.data && list.data.length === 0 ? <Empty title="No debates here yet" body="Debates appear the moment two people agree to a FaceOff." /> : null}
    </Screen>
  );
}
