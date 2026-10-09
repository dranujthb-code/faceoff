import { handler } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { joinCommunity, leaveCommunity } from "@/lib/server/domain/communities";

export const POST = handler({ auth: "required", requireOnboarded: true }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid community");
  await joinCommunity(viewer, params.id);
  return { member: true };
});
export const DELETE = handler({ auth: "required" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid community");
  await leaveCommunity(viewer, params.id);
  return { member: false };
});
