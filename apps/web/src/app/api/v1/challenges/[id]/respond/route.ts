import { respondChallengeSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { respondToChallenge } from "@/lib/server/domain/challenges";

export const POST = handler({ auth: "required", requireOnboarded: true, body: respondChallengeSchema }, async ({ viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  return respondToChallenge(viewer, params.id, body);
});
