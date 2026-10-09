import { handler } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { supportMotion } from "@/lib/server/domain/communities";

export const POST = handler({ auth: "required", requireOnboarded: true }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid motion");
  await supportMotion(viewer, params.id, true);
  return { supported: true };
});
export const DELETE = handler({ auth: "required" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid motion");
  await supportMotion(viewer, params.id, false);
  return { supported: false };
});
