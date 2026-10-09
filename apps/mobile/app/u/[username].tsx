import { useLocalSearchParams, router } from "expo-router";
import { WallView } from "@/components/WallView";
import { Button } from "@/components/ui";

export default function UserWall() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <WallView username={String(username).toLowerCase()} header={<Button small variant="ghost" title="Back" onPress={() => router.back()} style={{ alignSelf: "flex-start" }} />} />;
}
