import { forgotPasswordSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { requestPasswordReset } from "@/lib/server/domain/accounts";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";
import { clientKey } from "@/lib/server/request";

export const POST = handler({ auth: "none", body: forgotPasswordSchema }, async ({ req, body }) => {
  await enforceRateLimit(RATE_RULES.passwordReset, `${clientKey(req)}:${body.email}`);
  await requestPasswordReset(body.email);
  // Same response whether or not the account exists.
  return { message: "If an account exists for that email, we've sent a reset link." };
});
