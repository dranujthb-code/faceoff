import { commentSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { listComments, postComment } from "@/lib/server/domain/audience";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";

export const GET = handler({ auth: "optional" }, async ({ viewer, params, query }) => {
  if (!isUuid(params.id)) throw notFound();
  return listComments(params.id, viewer?.userId ?? null, query.get("after") ?? undefined);
});
export const POST = handler({ auth: "required", requireOnboarded: true, body: commentSchema }, async ({ viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  await enforceRateLimit(RATE_RULES.comment, viewer.userId);
  return postComment(viewer, params.id, body.body);
});
