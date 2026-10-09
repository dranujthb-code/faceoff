import { requireViewer } from "@/lib/server/page-guards";
import { asUser } from "@/lib/server/db";
import { getPreferences, listBlocked } from "@/lib/server/domain/profiles";
import { listTopics } from "@/lib/server/domain/communities";
import { publicUrl } from "@/lib/server/storage";
import { Settings } from "./Settings";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const v = await requireViewer("/settings");
  const [[p], prefs, blocked, topics, interests] = await Promise.all([
    asUser(v.userId, (tx) => tx`select username, display_name, bio, location, region, visibility, challenge_eligibility, avatar_key from faceoff.profiles where user_id = ${v.userId}`),
    getPreferences(v.userId),
    listBlocked(v.userId),
    listTopics(),
    asUser(v.userId, (tx) => tx<{ topic_id: string }[]>`select topic_id from faceoff.user_interests where user_id = ${v.userId}`),
  ]);
  return (
    <Settings
      profile={{
        username: p!.username,
        displayName: p!.display_name,
        bio: p!.bio ?? "",
        location: p!.location ?? "",
        region: p!.region ?? "global",
        visibility: p!.visibility,
        challengeEligibility: p!.challenge_eligibility,
        avatarUrl: publicUrl(p!.avatar_key),
      }}
      prefs={prefs}
      blocked={blocked}
      topics={topics}
      interests={interests.map((i) => i.topic_id)}
      account={{ email: v.email, verified: v.emailVerified, status: v.status }}
    />
  );
}
