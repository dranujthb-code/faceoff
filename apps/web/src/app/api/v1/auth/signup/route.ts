import { signUpSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { signUp } from "@/lib/server/domain/accounts";
import { createSession, setSessionCookie } from "@/lib/server/auth";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";
import { clientKey } from "@/lib/server/request";

export const POST = handler({ auth: "none", body: signUpSchema }, async ({ req, body }) => {
  await enforceRateLimit(RATE_RULES.signUp, clientKey(req));
  const ua = req.headers.get("user-agent");
  const { userId } = await signUp(body, ua);
  const client = req.headers.get("x-faceoff-client") === "mobile" ? "mobile" : "web";
  const s = await createSession(userId, client, ua);
  if (client === "web") await setSessionCookie(s.token, s.expiresAt);
  return { userId, ...(client === "mobile" ? { token: s.token, expiresAt: s.expiresAt.toISOString() } : {}) };
});
