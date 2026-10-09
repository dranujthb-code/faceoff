import { voteSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { vote } from "@/lib/server/domain/audience";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";

export const POST = handler({ auth: "required", requireOnboarded: true, body: voteSchema }, async ({ viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  await enforceRateLimit(RATE_RULES.vote, viewer.userId);
  await vote(viewer, params.id, body.poll, body.choice);
  return { voted: true };
});
