import { handler } from "@/lib/server/api";
import { clearSessionCookie, revokeSession } from "@/lib/server/auth";

export const POST = handler({ auth: "optional", requireActive: false }, async ({ viewer }) => {
  if (viewer) await revokeSession(viewer.sessionId);
  await clearSessionCookie();
  return { signedOut: true };
});
