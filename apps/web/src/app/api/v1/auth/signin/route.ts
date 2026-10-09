import { signInSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { authenticate } from "@/lib/server/domain/accounts";
import { createSession, setSessionCookie } from "@/lib/server/auth";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";
import { clientKey } from "@/lib/server/request";

export const POST = handler({ auth: "none", body: signInSchema }, async ({ req, body }) => {
  await enforceRateLimit(RATE_RULES.signIn, `${clientKey(req)}:${body.email}`);
  const { userId } = await authenticate(body.email, body.password);
  const ua = req.headers.get("user-agent");
  const client = req.headers.get("x-faceoff-client") === "mobile" ? "mobile" : "web";
  const s = await createSession(userId, client, ua);
  if (client === "web") await setSessionCookie(s.token, s.expiresAt);
  return { userId, ...(client === "mobile" ? { token: s.token, expiresAt: s.expiresAt.toISOString() } : {}) };
});
