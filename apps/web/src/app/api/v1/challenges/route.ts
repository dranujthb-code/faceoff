import { createChallengeSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { createChallenge, listChallenges } from "@/lib/server/domain/challenges";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";

export const GET = handler({ auth: "required" }, async ({ viewer }) => listChallenges(viewer.userId));

export const POST = handler({ auth: "required", requireOnboarded: true, requireVerified: true, body: createChallengeSchema }, async ({ viewer, body }) => {
  await enforceRateLimit(RATE_RULES.challengeBurst, viewer.userId);
  await enforceRateLimit(RATE_RULES.challenge, viewer.userId);
  return createChallenge(viewer, body);
});
