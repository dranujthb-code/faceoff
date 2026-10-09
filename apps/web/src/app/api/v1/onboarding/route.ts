import { onboardingSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { completeOnboarding } from "@/lib/server/domain/accounts";

export const POST = handler({ auth: "required", body: onboardingSchema }, async ({ viewer, body }) => {
  await completeOnboarding(viewer.userId, body);
  return { onboarded: true, username: body.username };
});
