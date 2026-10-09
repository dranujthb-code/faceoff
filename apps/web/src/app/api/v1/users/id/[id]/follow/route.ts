import { handler } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { follow, unfollow } from "@/lib/server/domain/profiles";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";

export const POST = handler({ auth: "required", requireOnboarded: true }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid user");
  await enforceRateLimit(RATE_RULES.follow, viewer.userId);
  await follow(viewer.userId, params.id);
  return { following: true };
});
export const DELETE = handler({ auth: "required" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid user");
  await unfollow(viewer.userId, params.id);
  return { following: false };
});
