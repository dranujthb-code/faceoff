import { handler } from "@/lib/server/api";
import { sendVerificationEmail } from "@/lib/server/domain/accounts";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";

export const POST = handler({ auth: "required", requireActive: false }, async ({ viewer }) => {
  if (viewer.emailVerified) return { alreadyVerified: true };
  await enforceRateLimit(RATE_RULES.verifyResend, viewer.userId);
  await sendVerificationEmail(viewer.userId, viewer.email);
  return { sent: true };
});
