import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { getSessionState } from "@/lib/server/domain/debates";

export const GET = handler({ auth: "optional" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  const s = await getSessionState(params.id, viewer);
  if (!s) throw notFound("Debate not found");
  return s;
});
