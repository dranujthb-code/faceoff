import type { Me } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { publicUrl } from "@/lib/server/storage";

export const GET = handler({ auth: "optional" }, async ({ viewer }): Promise<Me | null> => {
  if (!viewer) return null;
  return {
    id: viewer.userId,
    email: viewer.email,
    emailVerified: viewer.emailVerified,
    role: viewer.role,
    onboarded: viewer.onboarded,
    profile: viewer.username
      ? { userId: viewer.userId, username: viewer.username, displayName: viewer.displayName ?? viewer.username, avatarUrl: publicUrl(viewer.avatarKey), isDemo: viewer.isDemo }
      : null,
  };
});
