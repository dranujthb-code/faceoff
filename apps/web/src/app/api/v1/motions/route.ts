import { motionSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { isUuid } from "@/lib/server/db";
import { createMotion, listMotions } from "@/lib/server/domain/communities";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";

export const GET = handler({ auth: "optional" }, async ({ viewer, query }) => {
  const communityId = query.get("community");
  const authorId = query.get("author");
  const status = query.get("status");
  return listMotions(viewer?.userId ?? null, {
    communityId: communityId && isUuid(communityId) ? communityId : undefined,
    authorId: authorId && isUuid(authorId) ? authorId : undefined,
    status: status === "proposed" || status === "listed" ? status : undefined,
    trending: query.get("sort") === "trending",
  });
});

export const POST = handler({ auth: "required", requireOnboarded: true, requireVerified: true, body: motionSchema }, async ({ viewer, body }) => {
  await enforceRateLimit(RATE_RULES.motion, viewer.userId);
  return createMotion(viewer, body);
});
