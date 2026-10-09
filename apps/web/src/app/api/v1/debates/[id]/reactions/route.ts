import { reactionSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { react } from "@/lib/server/domain/audience";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";

export const POST = handler({ auth: "required", requireOnboarded: true, body: reactionSchema }, async ({ viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  await enforceRateLimit(RATE_RULES.reaction, viewer.userId);
  await react(viewer, params.id, body.kind, body.side);
  return { reacted: true };
});
