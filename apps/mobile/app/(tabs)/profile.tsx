import { View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth";
import { WallView } from "@/components/WallView";
import { Button, Loading } from "@/components/ui";

export default function MyWall() {
  const { me } = useAuth();
  if (!me?.profile) return <Loading />;
  return (
    <WallView
      username={me.profile.username}
      header={
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
          <Button small variant="secondary" title="Settings" onPress={() => router.push("/settings")} />
        </View>
      }
    />
  );
}
