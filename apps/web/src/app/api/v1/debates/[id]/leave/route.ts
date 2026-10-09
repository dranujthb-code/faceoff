import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { leaveSession } from "@/lib/server/domain/debates";

export const POST = handler({ auth: "required", requireActive: false }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  await leaveSession(params.id, viewer);
  return { ok: true };
});
