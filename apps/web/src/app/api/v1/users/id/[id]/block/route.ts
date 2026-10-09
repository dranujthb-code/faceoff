import { handler } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { block, unblock } from "@/lib/server/domain/profiles";

export const POST = handler({ auth: "required", requireActive: false }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid user");
  await block(viewer.userId, params.id);
  return { blocked: true };
});
export const DELETE = handler({ auth: "required", requireActive: false }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid user");
  await unblock(viewer.userId, params.id);
  return { blocked: false };
});
