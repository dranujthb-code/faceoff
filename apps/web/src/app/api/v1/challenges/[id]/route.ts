import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { getChallenge } from "@/lib/server/domain/challenges";

export const GET = handler({ auth: "required" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  const c = await getChallenge(params.id, viewer.userId);
  if (!c) throw notFound("Challenge not found");
  return c;
});
