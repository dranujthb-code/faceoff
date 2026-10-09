import { Linking, Switch, View } from "react-native";
import { router } from "expo-router";
import { api, API_URL } from "@/api";
import { useAuth } from "@/auth";
import { useApi } from "@/useApi";
import { Button, Card, ErrorBox, Loading, Screen, T, styles } from "@/components/ui";

const PREFS: Array<[string, string]> = [
  ["notifyChallenges", "Challenges"], ["notifyReminders", "Debate reminders"], ["notifyFollowers", "New followers"],
  ["notifyCommunity", "Community activity"], ["notifyReplays", "Results and replays"], ["emailNotifications", "Email me too"],
];

export default function Settings() {
  const { signOut, me } = useAuth();
  const prefs = useApi<Record<string, boolean>>("/me/preferences");
  return (
    <Screen>
      <View style={styles.between}><T variant="title">Settings</T><Button small variant="ghost" title="Close" onPress={() => router.back()} /></View>
      <T variant="muted">Signed in as {me?.email}</T>
      <ErrorBox message={prefs.error} />
      <Card>
        <T variant="heading">Notifications</T>
        {!prefs.data ? <Loading /> : PREFS.map(([k, label]) => (
          <View key={k} style={styles.between}>
            <T>{label}</T>
            <Switch accessibilityLabel={label} value={!!prefs.data![k]} onValueChange={async (v) => { prefs.setData({ ...prefs.data!, [k]: v }); await api("/me/preferences", { method: "PATCH", body: { [k]: v } }).catch(() => prefs.reload()); }} />
          </View>
        ))}
        <T variant="small">Push notifications arrive in a later release; in-app notifications are in Activity.</T>
      </Card>
      <Card>
        <T variant="heading">Profile, privacy and account</T>
        <T variant="muted">Edit your Wall, privacy, blocked people, password and account deletion on the web.</T>
        <Button variant="secondary" title="Open settings on the web" onPress={() => Linking.openURL(`${API_URL}/settings`)} />
        <Button variant="secondary" title="Community guidelines" onPress={() => Linking.openURL(`${API_URL}/guidelines`)} />
      </Card>
      <Button variant="danger" title="Sign out" onPress={signOut} />
    </Screen>
  );
}
