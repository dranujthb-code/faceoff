import { handler } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { mute } from "@/lib/server/domain/profiles";

export const POST = handler({ auth: "required", requireActive: false }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid user");
  await mute(viewer.userId, params.id, true);
  return { muted: true };
});
export const DELETE = handler({ auth: "required", requireActive: false }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid user");
  await mute(viewer.userId, params.id, false);
  return { muted: false };
});
