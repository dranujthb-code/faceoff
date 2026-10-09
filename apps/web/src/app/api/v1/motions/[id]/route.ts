import { handler } from "@/lib/server/api";
import { badRequest, notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { archiveMotion, getMotion } from "@/lib/server/domain/communities";

export const GET = handler({ auth: "optional" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  const m = await getMotion(params.id, viewer?.userId ?? null);
  if (!m) throw notFound("Motion not found");
  return m;
});
export const DELETE = handler({ auth: "required" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw badRequest("Invalid motion");
  await archiveMotion(viewer, params.id);
  return { archived: true };
});
